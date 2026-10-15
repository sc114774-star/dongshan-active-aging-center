import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Edit3, ImagePlus, Loader2, Save, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { listReflections } from "@/lib/db";
import {
  createReflection,
  deleteReflection,
  updateReflection,
  uploadImage,
  type ReflectionInput,
} from "@/lib/adminDb";
import type { DbReflection } from "@/lib/types";
import { errMsg } from "@/lib/errors";

type CourseOption = { id: string; title: string; date: string; teacher: string | null };

type FormState = {
  title: string;
  content: string;
  quote: string;
  author: string;
  image_url: string;
};

const emptyForm: FormState = { title: "", content: "", quote: "", author: "", image_url: "" };

const monthLabel = (ym: string) => `${ym.slice(0, 4)}年${Number(ym.slice(5, 7))}月`;

// 第一層：月份（近 11 個月到未來 2 個月，新的在前）
function buildMonthOptions(extra?: string) {
  const now = new Date();
  const list = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return format(d, "yyyy-MM");
  }).reverse();
  if (extra && !list.includes(extra)) list.push(extra);
  return list.map((value) => ({ value, label: monthLabel(value) }));
}

export default function ReflectionsAdmin() {
  const { isAdmin, myCommunityId, communities, communityName } = useAuth();

  const [items, setItems] = useState<DbReflection[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 連動下拉選單狀態
  const [communityId, setCommunityId] = useState(myCommunityId ?? "");
  const [month, setMonth] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  const [guideOpen, setGuideOpen] = useState(false); // 「觀看操作範例」對話框
  const [syncingId, setSyncingId] = useState<string | null>(null); // 正在同步到 FB 的心得

  const monthOptions = useMemo(() => buildMonthOptions(month || undefined), [month]);
  const selectedCourse = courses.find((c) => c.id === courseId) ?? null;

  async function refresh() {
    setItems(await listReflections());
  }

  useEffect(() => {
    refresh().catch(() => toast.error("心得資料讀取失敗"));
  }, []);

  // 第二層：依「社區 + 月份」動態抓取 events（課程）
  useEffect(() => {
    if (!communityId || !month) {
      setCourses([]);
      return;
    }
    let cancelled = false;
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const end = format(new Date(y, m, 0), "yyyy-MM-dd");
    setCoursesLoading(true);
    supabase
      .from("events")
      .select("id,title,date,teacher")
      .eq("community_id", communityId)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setCourses(error ? [] : ((data ?? []) as CourseOption[]));
        setCoursesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [communityId, month]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setMonth("");
    setCourseId("");
    setCommunityId(myCommunityId ?? "");
  }

  async function edit(row: DbReflection) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      content: row.content,
      quote: row.quote ?? "",
      author: row.author ?? "",
      image_url: row.image_url ?? "",
    });
    setCommunityId(row.community_id ?? myCommunityId ?? "");
    setCourseId(row.course_id ?? "");
    setMonth("");
    if (row.course_id) {
      const { data } = await supabase.from("events").select("date").eq("id", row.course_id).maybeSingle();
      if (data?.date) setMonth(String(data.date).slice(0, 7));
    }
  }

  async function uploadCover(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "reflections");
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("大圖已上傳");
    } catch (err) {
      toast.error(errMsg(err, "上傳失敗"));
    } finally {
      setUploading(false);
    }
  }

  // 外部 AI 修正：複製「提示語 + 目前的心得內容」，再開啟 AI 網站，貼上即可
  const AI_SITES = {
    monica: "https://monica.im/",
    gemini: "https://gemini.google.com/app",
    chatgpt: "https://chatgpt.com/",
  } as const;

  async function openAi(site: keyof typeof AI_SITES) {
    const draft = form.content.trim();
    if (!draft) {
      toast.error("請先在下方「心得內容」輸入文字，再使用 AI 修正");
      return;
    }
    window.open(AI_SITES[site], "_blank", "noopener"); // 先開分頁，避免被瀏覽器擋下
    const prompt = [
      "請幫我修正以下樂齡學習中心學員的心得文章：",
      "・改成通順、沒有錯字的繁體中文，語氣親切自然，適合長輩閱讀",
      "・保留原意，不要新增不存在的內容",
      "・內文如果有網址，請改成文字說明（不要直接貼網址）",
      "",
      "【原文】",
      draft,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("已複製！請到剛開啟的 AI 網站貼上，取得結果後貼回「心得內容」");
    } catch {
      toast.error("複製失敗，請自行複製心得內容貼到 AI 網站");
    }
  }

  // 手動把這則心得發佈到 Facebook 粉絲專頁（需要先設定好 api/post-reflection-fb）
  async function syncFb(item: DbReflection) {
    const again = Boolean(item.fb_post_id);
    const ok = confirm(again ? "這則心得已經同步過了，確定要再發一次到 Facebook 嗎？" : "確定要把這則心得發佈到 Facebook 粉絲專頁嗎？");
    if (!ok) return;
    setSyncingId(item.id);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/post-reflection-fb", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ id: item.id, force: again }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; dryRun?: boolean };
      if (!res.ok) throw new Error(body.error ?? `同步失敗（${res.status}）`);
      toast.success(body.dryRun ? "測試模式：沒有真的發文" : "已發佈到 Facebook");
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, "同步失敗"));
    } finally {
      setSyncingId(null);
    }
  }

  async function submit() {
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("請填寫標題與心得內容");
      return;
    }
    if (!communityId) {
      toast.error("請選擇社區");
      return;
    }
    if (!month || !selectedCourse) {
      toast.error("請選擇月份與課程");
      return;
    }
    setSaving(true);
    try {
      const payload: ReflectionInput = {
        title: form.title.trim(),
        content: form.content.trim(),
        quote: form.quote.trim() || null,
        author: form.author.trim() || null,
        image_url: form.image_url.trim() || null,
        community_id: communityId,
        course_id: selectedCourse.id,
        tags: [communityName(communityId), selectedCourse.title].filter(Boolean),
      };
      if (editingId) {
        await updateReflection(editingId, payload);
        toast.success("心得已更新");
      } else {
        await createReflection(payload);
        toast.success("心得已新增");
      }
      resetForm();
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, "儲存失敗"));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("確定刪除此心得？")) return;
    try {
      await deleteReflection(id);
      toast.success("心得已刪除");
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, "刪除失敗"));
    }
  }

  const visibleItems = isAdmin ? items : items.filter((r) => r.community_id === myCommunityId);
  const coursePlaceholder = !month
    ? "請先選擇月份"
    : coursesLoading
      ? "讀取課程中…"
      : courses.length === 0
        ? "該月無課程"
        : "選擇課程";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">{editingId ? "修改成果心得" : "新增成果心得"}</div>
        <div className="mt-4 space-y-3">
          <Input placeholder="心得標題" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />

          {isAdmin && (
            <Select
              value={communityId}
              onValueChange={(v) => {
                setCommunityId(v);
                setCourseId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選擇社區" />
              </SelectTrigger>
              <SelectContent>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={month}
              onValueChange={(v) => {
                setMonth(v);
                setCourseId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選擇月份" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={courseId}
              onValueChange={setCourseId}
              disabled={!communityId || !month || coursesLoading || courses.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={coursePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}（{c.date.slice(5).replace("-", "/")}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea placeholder="心得內容" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />

          <div className="rounded-3xl border border-amber-300 bg-amber-100/70 p-4">
            <div className="text-base font-black">
              ✨ AI 文章修正工具
              <span className="font-medium">：先在上面輸入心得 → 按下方按鈕（會自動複製內容並開啟 AI）→ 貼上取得結果 → 把修正後的文字貼回「心得內容」。</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" className="rounded-xl bg-sky-500 font-bold text-white hover:bg-sky-600" onClick={() => openAi("monica")}>
                🤖 使用 Monica 修正 (推薦)
              </Button>
              <Button type="button" className="rounded-xl bg-green-700 font-bold text-white hover:bg-green-800" onClick={() => openAi("gemini")}>
                🤖 使用 Gemini 修正 (推薦)
              </Button>
              <Button type="button" className="rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700" onClick={() => openAi("chatgpt")}>
                🤖 使用 ChatGPT 修正 (備用)
              </Button>
              <Button type="button" variant="outline" className="rounded-xl border-black/70 bg-white font-bold" onClick={() => setGuideOpen(true)}>
                🎬 觀看操作範例
              </Button>
            </div>
          </div>
          <Textarea placeholder="重點金句" rows={3} value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} />
          <Input placeholder="學員署名（例：學員｜陳○○）" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />

          <div className="rounded-3xl border border-border bg-secondary/25 p-4">
            <div className="text-sm font-bold">上傳左側 4:3 大圖</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-sm">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                選擇大圖
                <input className="hidden" type="file" accept="image/*" onChange={(e) => uploadCover(e.target.files)} />
              </label>
              {form.image_url && <Badge variant="secondary" className="rounded-full">已設定圖片</Badge>}
            </div>
            {form.image_url && <img src={form.image_url} alt="心得大圖預覽" className="mt-3 aspect-[4/3] w-full max-w-sm rounded-3xl object-cover" />}
          </div>

          <div className="flex gap-2">
            <Button className="rounded-full font-bold" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingId ? "儲存修改" : "新增心得"}
            </Button>
            {editingId && (
              <Button variant="outline" className="rounded-full" onClick={resetForm}>
                取消
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">心得列表</div>
        <div className="mt-4 space-y-3">
          {visibleItems.length === 0 ? (
            <div className="rounded-3xl bg-muted p-4 text-sm text-muted-foreground">尚無心得。</div>
          ) : (
            visibleItems.map((item) => (
              <div key={item.id} className="rounded-3xl border border-border bg-background p-4">
                <div className="font-black">{item.title}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(item.tags ?? []).map((t) => (
                    <Badge key={t} variant="secondary" className="rounded-full">
                      {t}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => edit(item)}>
                    <Edit3 className="mr-2 h-4 w-4" />修改
                  </Button>
                  <Button size="sm" variant="destructive" className="rounded-full" onClick={() => remove(item.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />刪除
                  </Button>
                  <Button size="sm" variant="secondary" className="rounded-full" disabled={syncingId === item.id} onClick={() => syncFb(item)}>
                    {syncingId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
                    {item.fb_post_id ? "再同步到 FB" : "同步到 FB"}
                  </Button>
                  {item.fb_post_id && (
                    <Badge variant="secondary" className="self-center rounded-full bg-green-100 text-green-800">
                      ✓ 已同步 FB
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-4xl">
          <DialogHeader>
            <DialogTitle>AI 文章修正：操作範例</DialogTitle>
            <DialogDescription>
              1. 在「心得內容」輸入草稿　2. 按 Monica / Gemini / ChatGPT 其中一個按鈕（內容會自動複製）　3. 在 AI 網站貼上並送出　4. 把修正後的文字複製回「心得內容」，檢查後再儲存。
            </DialogDescription>
          </DialogHeader>
          <img src="/accessibility-guide.png" alt="如何做出符合無障礙標準的文章" className="h-auto w-full rounded-3xl border border-border" />
          <div className="text-xs text-muted-foreground">圖：製作符合無障礙標準文章的小技巧（網址改成文字說明、附圖請附替代文字、附檔使用中文檔名等）。</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
