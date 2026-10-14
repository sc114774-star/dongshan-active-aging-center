import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { zhTW } from "date-fns/locale";
import { nanoid } from "nanoid";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? "senior-center-images";

type Center = { id: string; name: string; slug: string };
type Course = { id: string; title: string; teacher: string | null; date: string };
type Item = { blob: Blob; url: string };

// 網址可寫成 https://網站/#/upload?center=qingshan 或 https://網站/?center=qingshan#/upload
// 直接用正規表示式掃整條網址（含 # 之後的部分），並先解碼 %3F 這類被轉碼的符號；
// 同時保留載入當下的原始網址，避免路由初始化後網址被改寫而抓不到。
const INITIAL_HREF = typeof window !== "undefined" ? window.location.href : "";

function readCenterParam(): string {
  for (const href of [window.location.href, INITIAL_HREF]) {
    let text = href;
    try {
      text = decodeURIComponent(href);
    } catch {
      /* 保留原字串 */
    }
    const m = text.match(/[?&]center=([^&#\s]+)/i);
    if (m) return m[1].trim();
  }
  return "";
}

// 縮圖壓縮：長邊 1920、JPEG 0.85，省流量也加快上傳；失敗就用原檔
async function compressImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

// 讓「加入主畫面」的捷徑開啟時帶著該據點的專屬網址，並以全螢幕 APP 樣式顯示
function useInstallableApp(center: Center | null) {
  useEffect(() => {
    document.title = center ? `${center.name}花絮上傳` : "花絮上傳";
    const added: HTMLElement[] = [];
    const add = (tag: "meta" | "link", attrs: Record<string, string>) => {
      const el = document.createElement(tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      document.head.appendChild(el);
      added.push(el);
    };
    add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
    add("meta", { name: "mobile-web-app-capable", content: "yes" });
    add("meta", { name: "apple-mobile-web-app-title", content: center ? `${center.name}上傳` : "花絮上傳" });
    add("meta", { name: "theme-color", content: "#16a34a" });
    add("link", { rel: "apple-touch-icon", href: "/favicon.png" });

    let manifestUrl: string | null = null;
    if (center) {
      const manifest = {
        name: `${center.name}花絮上傳`,
        short_name: `${center.name}上傳`,
        start_url: window.location.href,
        scope: window.location.origin + "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#16a34a",
        icons: [{ src: window.location.origin + "/favicon.png", sizes: "256x256", type: "image/png" }],
      };
      manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }));
      add("link", { rel: "manifest", href: manifestUrl });
    }
    return () => {
      added.forEach((el) => el.remove());
      if (manifestUrl) URL.revokeObjectURL(manifestUrl);
    };
  }, [center]);
}

export default function QuickUpload() {
  const centerParam = readCenterParam();
  const [center, setCenter] = useState<Center | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [courses, setCourses] = useState<Course[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({}); // 課程 id → 已上傳張數
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(Boolean(centerParam));
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Course | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [doneCount, setDoneCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);

  useInstallableApp(center);

  // 1. 讀取據點
  useEffect(() => {
    if (!centerParam) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: communities, error } = await supabase.from("communities").select("*");
        if (error) throw error;
        const found = (communities ?? []).find((c) => c.slug.toLowerCase() === centerParam.toLowerCase() && c.is_active !== false);
        if (!found) {
          if (!cancelled) {
            setLoadError("找不到這個據點，請確認連結是否正確。");
            setLoading(false);
          }
          return;
        }
        if (!cancelled) setCenter(found as Center);
      } catch {
        if (!cancelled) {
          setLoadError("讀取失敗，請確認網路後重新開啟。");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [centerParam]);

  // 2. 讀取整個月的課程，以及每堂課已上傳的照片張數
  useEffect(() => {
    if (!center) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data: events, error } = await supabase
          .from("events")
          .select("id,title,teacher,date")
          .eq("community_id", center.id)
          .gte("date", format(startOfMonth(month), "yyyy-MM-dd"))
          .lte("date", format(endOfMonth(month), "yyyy-MM-dd"))
          .order("date", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) throw error;
        const list = (events ?? []) as Course[];
        const map: Record<string, number> = {};
        if (list.length > 0) {
          const { data: photos } = await supabase.from("photos").select("event_id").in("event_id", list.map((c) => c.id));
          for (const ph of photos ?? []) if (ph.event_id) map[ph.event_id] = (map[ph.event_id] ?? 0) + 1;
        }
        if (!cancelled) {
          setCourses(list);
          setCounts(map);
          setLoadError(null);
        }
      } catch {
        if (!cancelled) setLoadError("讀取失敗，請確認網路後重新開啟。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [center, month, refreshKey]);

  // 第一次顯示時自動捲到今天
  useEffect(() => {
    if (!loading && !scrolled.current && todayRef.current) {
      todayRef.current.scrollIntoView({ block: "center" });
      scrolled.current = true;
    }
  }, [loading, courses]);

  function clearItems() {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
  }

  function pickCourse(course: Course) {
    setSelected(course);
    setUploadError(null);
    inputRef.current?.click(); // 手機會詢問：拍照 / 相簿
  }

  async function onFilesChosen(e: ChangeEvent<HTMLInputElement>) {
    const chosen = Array.from(e.target.files ?? []);
    e.target.value = ""; // 允許重複選同一張
    if (chosen.length === 0) return;
    const added: Item[] = [];
    for (const f of chosen) {
      const blob = await compressImage(f);
      added.push({ blob, url: URL.createObjectURL(blob) });
    }
    setItems((prev) => [...prev, ...added]);
  }

  function cancelPreview() {
    clearItems();
    setSelected(null);
    setUploadError(null);
  }

  async function confirmUpload() {
    if (items.length === 0 || !selected || !center) return;
    setUploading(true);
    setUploadError(null);
    let ok = 0;
    try {
      for (const it of items) {
        const path = `quick-upload/${center.slug}/${Date.now()}-${nanoid(8)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, it.blob, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
        if (upErr) throw upErr;
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        // 直接公開（免審核）；不加 .select()，避免匿名讀取回傳被 RLS 擋下
        const { error: insErr } = await supabase.from("photos").insert({
          image_url: data.publicUrl,
          caption: selected.title,
          community_id: center.id,
          event_id: selected.id,
          is_approved: true,
        });
        if (insErr) throw insErr;
        ok += 1;
      }
      setDoneCount(ok);
      cancelPreview();
      setRefreshKey((k) => k + 1);
    } catch {
      // 已成功的從清單移除，重按時只會補傳失敗的，不會重複
      items.slice(0, ok).forEach((i) => URL.revokeObjectURL(i.url));
      setItems(items.slice(ok));
      setUploadError(ok > 0 ? `已上傳 ${ok} 張，還有 ${items.length - ok} 張失敗，請再按一次。` : "上傳失敗，請確認網路後再按一次。");
      if (ok > 0) setRefreshKey((k) => k + 1);
    } finally {
      setUploading(false);
    }
  }

  const shell = "fixed inset-0 z-50 flex flex-col overflow-auto bg-background";
  const picker = <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFilesChosen} />;

  // 1. 沒有專屬連結
  if (!centerParam) {
    return (
      <div className={`${shell} items-center justify-center p-8 text-center`}>
        <div className="text-5xl font-black leading-tight">請使用專屬連結進入</div>
        <div className="mt-8 break-all text-xs text-muted-foreground">目前網址：{window.location.href}</div>
      </div>
    );
  }

  if (loading && !center) {
    return (
      <div className={`${shell} items-center justify-center`}>
        <Loader2 className="h-16 w-16 animate-spin text-green-600" />
      </div>
    );
  }

  if ((loadError && !center) || !center) {
    return (
      <div className={`${shell} items-center justify-center p-8 text-center`}>
        <div className="text-4xl font-black leading-snug">{loadError ?? "找不到這個據點"}</div>
      </div>
    );
  }

  // 2. 上傳成功
  if (doneCount > 0 && items.length === 0 && !selected) {
    return (
      <div className={`${shell} items-center justify-center gap-10 bg-green-600 p-8 text-center text-white`}>
        <div className="text-[9rem] leading-none">✅</div>
        <div className="text-5xl font-black">上傳成功！</div>
        <div className="text-3xl font-bold">共 {doneCount} 張</div>
        <button
          type="button"
          onClick={() => setDoneCount(0)}
          className="w-[80%] rounded-3xl bg-white py-8 text-4xl font-black text-green-700 shadow-lg active:scale-95"
        >
          繼續上傳
        </button>
      </div>
    );
  }

  // 3. 預覽 + 確認上傳
  if (items.length > 0 && selected) {
    return (
      <div className={shell}>
        {picker}
        <div className="p-4 text-center">
          <div className="text-2xl font-black">{selected.title}</div>
          <div className="mt-1 text-lg text-muted-foreground">{format(new Date(selected.date + "T00:00:00"), "M月d日", { locale: zhTW })}・共 {items.length} 張</div>
        </div>
        <div className={`mx-auto grid w-full gap-2 px-3 ${items.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {items.map((it) => (
            <img key={it.url} src={it.url} alt="預覽" className={`w-full rounded-2xl object-cover ${items.length === 1 ? "max-h-[45vh] object-contain" : "aspect-square"}`} />
          ))}
        </div>
        {uploadError && <div className="p-3 text-center text-2xl font-bold text-red-600">{uploadError}</div>}
        <button
          type="button"
          onClick={confirmUpload}
          disabled={uploading}
          className="m-4 flex min-h-[24vh] items-center justify-center rounded-3xl bg-green-600 text-5xl font-black text-white shadow-lg active:scale-95 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-16 w-16 animate-spin" /> : "⬆️ 確認上傳"}
        </button>
        <div className="mx-4 mb-6 flex gap-3">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="flex-1 rounded-2xl border-2 border-border py-4 text-2xl font-bold">
            ＋ 再加照片
          </button>
          <button type="button" onClick={cancelPreview} disabled={uploading} className="flex-1 rounded-2xl border-2 border-border py-4 text-2xl font-bold">
            取消
          </button>
        </div>
      </div>
    );
  }

  // 4. 整個月的課程大按鈕
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const days = Array.from(new Set(courses.map((c) => c.date)));
  return (
    <div className={`${shell} items-center gap-3 px-4 pb-10 pt-6`}>
      {picker}
      <div className="text-center">
        <div className="text-3xl font-black">{center.name}</div>
        <div className="mt-1 text-xl text-muted-foreground">點課程，選拍照或相簿上傳</div>
      </div>

      <div className="flex w-full items-center justify-between gap-3">
        <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))} className="rounded-2xl border-2 border-border px-5 py-3 text-xl font-bold active:scale-95">
          ◀ 上個月
        </button>
        <div className="text-2xl font-black">{format(month, "yyyy年M月")}</div>
        <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))} className="rounded-2xl border-2 border-border px-5 py-3 text-xl font-bold active:scale-95">
          下個月 ▶
        </button>
      </div>

      {loading ? (
        <Loader2 className="mt-10 h-14 w-14 animate-spin text-green-600" />
      ) : loadError ? (
        <div className="mt-10 text-center text-3xl font-black text-red-600">{loadError}</div>
      ) : courses.length === 0 ? (
        <div className="mt-10 text-center text-4xl font-black leading-snug text-muted-foreground">這個月沒有排課</div>
      ) : (
        days.map((d) => {
          const isToday = d === todayStr;
          return (
            <div key={d} ref={isToday ? todayRef : undefined} className="flex w-full flex-col items-center gap-3">
              <div className={`mt-3 w-full border-b-2 pb-1 text-2xl font-black ${isToday ? "border-primary text-primary" : "border-border"}`}>
                {format(new Date(d + "T00:00:00"), "M月d日 EEE", { locale: zhTW })}
                {isToday && <span className="ml-2 rounded-full bg-primary px-3 py-0.5 text-lg text-primary-foreground">今天</span>}
              </div>
              {courses
                .filter((c) => c.date === d)
                .map((c) => {
                  const n = counts[c.id] ?? 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickCourse(c)}
                      className={`w-[80%] rounded-3xl px-4 py-8 text-center shadow-lg active:scale-95 ${
                        n > 0 ? "border-4 border-green-600 bg-green-100 text-green-900" : "bg-primary text-primary-foreground"
                      }`}
                    >
                      {c.teacher && <div className="text-2xl font-bold opacity-90">授課老師：{c.teacher}</div>}
                      <div className="mt-2 text-4xl font-black leading-snug">{c.title}</div>
                      {n > 0 ? (
                        <div className="mt-3 text-2xl font-black text-green-700">✅ 已上傳 {n} 張（還可以再傳）</div>
                      ) : d <= todayStr ? (
                        <div className="mt-3 text-2xl font-black">⚠️ 尚未上傳</div>
                      ) : null}
                    </button>
                  );
                })}
            </div>
          );
        })
      )}
    </div>
  );
}
