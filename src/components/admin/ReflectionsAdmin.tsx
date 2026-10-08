import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Edit3, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

  // AI 小幫手
  const [keywords, setKeywords] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

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
    setKeywords("");
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
      toast.error(err instanceof Error ? err.message : "上傳失敗");
    } finally {
      setUploading(false);
    }
  }

  async function aiWrite() {
    if (!selectedCourse) {
      toast.error("請先選擇課程");
      return;
    }
    if (!keywords.trim()) {
      toast.error("請先輸入幾個心得關鍵字");
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-reflection", {
        body: { courseName: selectedCourse.title, keywords: keywords.trim() },
      });
      if (error) {
        let msg = "AI 生成失敗，請稍後再試";
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null);
          if (body?.error) msg = body.error;
        }
        throw new Error(msg);
      }
      if (!data?.content) throw new Error("AI 沒有回傳內容，請重試");
      setForm((f) => ({ ...f, content: data.content }));
      toast.success("已幫您寫好，請檢查並修改後再儲存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI 生成失敗");
    } finally {
      setAiLoading(false);
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
      toast.error(err instanceof Error ? err.message : "儲存失敗");
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
      toast.error(err instanceof Error ? err.message : "刪除失敗");
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

          <div className="rounded-3xl border border-border bg-secondary/25 p-4">
            <div className="text-sm font-bold">AI 擴寫心得小幫手</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="請輸入幾個簡單詞彙，如：做手工皂、老師很細心、很有成就感"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={aiLoading}
              />
              <Button type="button" className="shrink-0 rounded-full font-bold" onClick={aiWrite} disabled={aiLoading}>
                {aiLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中…
                  </>
                ) : (
                  "✨ AI 幫我寫心得"
                )}
              </Button>
            </div>
          </div>

          <Textarea placeholder="心得內容" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
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
                <div className="mt-3 flex gap-1">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => edit(item)}>
                    <Edit3 className="mr-2 h-4 w-4" />修改
                  </Button>
                  <Button size="sm" variant="destructive" className="rounded-full" onClick={() => remove(item.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />刪除
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
