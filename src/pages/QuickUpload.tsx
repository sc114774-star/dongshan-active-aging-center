import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { format } from "date-fns";
import { nanoid } from "nanoid";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? "senior-center-images";

type Center = { id: string; name: string; slug: string };
type Course = { id: string; title: string; teacher: string | null };

// 網址可寫成 https://網站/?center=qingshan#/upload 或 https://網站/#/upload?center=qingshan
function readCenterParam(): string {
  const fromSearch = new URLSearchParams(window.location.search).get("center");
  if (fromSearch) return fromSearch.trim();
  const hash = window.location.hash;
  const q = hash.indexOf("?");
  if (q >= 0) return new URLSearchParams(hash.slice(q + 1)).get("center")?.trim() ?? "";
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(Boolean(centerParam));
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Course | null>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useInstallableApp(center);

  useEffect(() => {
    if (!centerParam) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: communities, error } = await supabase.from("communities").select("id,name,slug");
        if (error) throw error;
        const found = (communities ?? []).find((c) => c.slug.toLowerCase() === centerParam.toLowerCase());
        if (!found) {
          if (!cancelled) setLoadError("找不到這個據點，請確認連結是否正確。");
          return;
        }
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: events, error: evErr } = await supabase
          .from("events")
          .select("id,title,teacher")
          .eq("community_id", found.id)
          .eq("date", today)
          .order("created_at", { ascending: true });
        if (evErr) throw evErr;
        if (!cancelled) {
          setCenter(found as Center);
          setCourses((events ?? []) as Course[]);
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
  }, [centerParam]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickCourse(course: Course) {
    setSelected(course);
    setUploadError(null);
    inputRef.current?.click(); // 直接開啟手機相機 / 相簿
  }

  async function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = ""; // 允許重複選同一張
    if (!chosen) return;
    const blob = await compressImage(chosen);
    setFile(blob);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  function cancelPreview() {
    setFile(null);
    setPreviewUrl(null);
    setSelected(null);
    setUploadError(null);
  }

  async function confirmUpload() {
    if (!file || !selected || !center) return;
    setUploading(true);
    setUploadError(null);
    try {
      const path = `quick-upload/${center.slug}/${Date.now()}-${nanoid(8)}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { contentType: "image/jpeg", cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

      // 不加 .select()：匿名者看不到待審核資料，回傳會被 RLS 擋下
      const { error: insErr } = await supabase.from("photos").insert({
        image_url: data.publicUrl,
        caption: selected.title,
        community_id: center.id,
        event_id: selected.id,
        is_approved: false,
      });
      if (insErr) throw insErr;

      cancelPreview();
      setDone(true);
    } catch {
      setUploadError("上傳失敗，請確認網路後再按一次。");
    } finally {
      setUploading(false);
    }
  }

  const shell = "fixed inset-0 z-50 flex flex-col overflow-auto bg-background";

  // 1. 沒有專屬連結
  if (!centerParam) {
    return (
      <div className={`${shell} items-center justify-center p-8 text-center`}>
        <div className="text-5xl font-black leading-tight">請使用專屬連結進入</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${shell} items-center justify-center`}>
        <Loader2 className="h-16 w-16 animate-spin text-green-600" />
      </div>
    );
  }

  if (loadError || !center) {
    return (
      <div className={`${shell} items-center justify-center p-8 text-center`}>
        <div className="text-4xl font-black leading-snug">{loadError ?? "找不到這個據點"}</div>
      </div>
    );
  }

  // 2. 上傳成功
  if (done) {
    return (
      <div className={`${shell} items-center justify-center gap-10 bg-green-600 p-8 text-center text-white`}>
        <div className="text-[9rem] leading-none">✅</div>
        <div className="text-5xl font-black">上傳成功！</div>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="w-[80%] rounded-3xl bg-white py-8 text-4xl font-black text-green-700 shadow-lg active:scale-95"
        >
          繼續上傳
        </button>
      </div>
    );
  }

  // 3. 預覽 + 確認上傳
  if (previewUrl && file && selected) {
    return (
      <div className={shell}>
        <div className="p-4 text-center text-2xl font-black">{selected.title}</div>
        <img src={previewUrl} alt="預覽" className="mx-auto max-h-[45vh] w-full object-contain" />
        {uploadError && <div className="p-3 text-center text-2xl font-bold text-red-600">{uploadError}</div>}
        <button
          type="button"
          onClick={confirmUpload}
          disabled={uploading}
          className="m-4 flex min-h-[28vh] flex-1 items-center justify-center rounded-3xl bg-green-600 text-5xl font-black text-white shadow-lg active:scale-95 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-16 w-16 animate-spin" /> : "⬆️ 確認上傳"}
        </button>
        <button
          type="button"
          onClick={cancelPreview}
          disabled={uploading}
          className="mx-4 mb-6 rounded-2xl border-2 border-border py-4 text-2xl font-bold"
        >
          重選照片
        </button>
      </div>
    );
  }

  // 4. 今日課程大按鈕
  return (
    <div className={`${shell} items-center gap-5 px-4 py-8`}>
      <div className="text-center">
        <div className="text-3xl font-black">{center.name}</div>
        <div className="mt-1 text-xl text-muted-foreground">今天 {format(new Date(), "M月d日")}・點課程拍照上傳</div>
      </div>

      {courses.length === 0 ? (
        <div className="mt-10 text-center text-4xl font-black leading-snug text-muted-foreground">今天沒有排課</div>
      ) : (
        courses.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pickCourse(c)}
            className="w-[80%] rounded-3xl bg-primary px-4 py-10 text-center text-primary-foreground shadow-lg active:scale-95"
          >
            {c.teacher && <div className="text-2xl font-bold opacity-90">授課老師：{c.teacher}</div>}
            <div className="mt-2 text-4xl font-black leading-snug">{c.title}</div>
          </button>
        ))
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChosen}
      />
    </div>
  );
}
