import { useEffect, useState } from "react";
import { Edit3, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

function errMsg(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : (err as { message?: string })?.message || fallback;
}

/* ───────────── 活動公告 ───────────── */
type Announcement = { id: string; title: string; content: string; is_published: boolean; published_at: string };

export function AnnouncementsAdmin() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [published, setPublished] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data, error } = await supabase
      .from("announcements")
      .select("id,title,content,is_published,published_at")
      .order("published_at", { ascending: false });
    if (error) throw error;
    setItems((data ?? []) as Announcement[]);
  }
  useEffect(() => {
    refresh().catch(() => toast.error("公告讀取失敗"));
  }, []);

  function reset() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setPublished(true);
  }

  async function submit() {
    if (!title.trim() || !content.trim()) return toast.error("請填寫標題與內容");
    setBusy(true);
    try {
      const payload = { title: title.trim(), content: content.trim(), is_published: published };
      const { error } = editingId
        ? await supabase.from("announcements").update(payload).eq("id", editingId)
        : await supabase.from("announcements").insert(payload);
      if (error) throw error;
      toast.success(editingId ? "公告已更新" : "公告已新增");
      reset();
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, "儲存失敗"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("確定刪除此公告？")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(errMsg(error, "刪除失敗"));
    toast.success("公告已刪除");
    await refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">{editingId ? "修改公告" : "新增活動公告"}</div>
        <div className="mt-4 space-y-3">
          <Input placeholder="公告標題" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="公告內容" rows={7} value={content} onChange={(e) => setContent(e.target.value)} />
          <label className="flex items-center gap-2 text-sm font-bold">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            立即公開（取消勾選則存為草稿）
          </label>
          <div className="flex gap-2">
            <Button className="rounded-full font-bold" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingId ? "儲存修改" : "新增公告"}
            </Button>
            {editingId && <Button variant="outline" className="rounded-full" onClick={reset}>取消</Button>}
          </div>
        </div>
      </Card>
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">公告列表</div>
        <div className="mt-4 space-y-2">
          {items.length === 0 && <div className="rounded-3xl bg-muted p-4 text-sm text-muted-foreground">尚無公告。</div>}
          {items.map((a) => (
            <div key={a.id} className="rounded-3xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant={a.is_published ? "secondary" : "outline"} className="rounded-full">{a.is_published ? "已公開" : "草稿"}</Badge>
                  <div className="mt-2 font-black">{a.title}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{a.content}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" className="rounded-full" onClick={() => { setEditingId(a.id); setTitle(a.title); setContent(a.content); setPublished(a.is_published); }}><Edit3 className="h-4 w-4" /></Button>
                  <Button size="icon" variant="destructive" className="rounded-full" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ───────────── Q&A ───────────── */
type Qna = { id: string; question: string; answer: string; display_order: number };

export function QnaAdmin() {
  const [items, setItems] = useState<Qna[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [order, setOrder] = useState("0");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data, error } = await supabase
      .from("qna")
      .select("id,question,answer,display_order")
      .order("display_order", { ascending: true });
    if (error) throw error;
    setItems((data ?? []) as Qna[]);
  }
  useEffect(() => {
    refresh().catch(() => toast.error("Q&A 讀取失敗"));
  }, []);

  function reset() {
    setEditingId(null);
    setQuestion("");
    setAnswer("");
    setOrder("0");
  }

  async function submit() {
    if (!question.trim() || !answer.trim()) return toast.error("請填寫問題與回答");
    setBusy(true);
    try {
      const payload = { question: question.trim(), answer: answer.trim(), display_order: Number(order) || 0 };
      const { error } = editingId
        ? await supabase.from("qna").update(payload).eq("id", editingId)
        : await supabase.from("qna").insert(payload);
      if (error) throw error;
      toast.success(editingId ? "Q&A 已更新" : "Q&A 已新增");
      reset();
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, "儲存失敗"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("確定刪除此 Q&A？")) return;
    const { error } = await supabase.from("qna").delete().eq("id", id);
    if (error) return toast.error(errMsg(error, "刪除失敗"));
    toast.success("Q&A 已刪除");
    await refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">{editingId ? "修改 Q&A" : "新增 Q&A"}</div>
        <div className="mt-4 space-y-3">
          <Input placeholder="問題" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <Textarea placeholder="回答" rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <Input type="number" placeholder="排序（數字越小越前面）" value={order} onChange={(e) => setOrder(e.target.value)} />
          <div className="flex gap-2">
            <Button className="rounded-full font-bold" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingId ? "儲存修改" : "新增 Q&A"}
            </Button>
            {editingId && <Button variant="outline" className="rounded-full" onClick={reset}>取消</Button>}
          </div>
        </div>
      </Card>
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">Q&A 列表</div>
        <div className="mt-4 space-y-2">
          {items.length === 0 && <div className="rounded-3xl bg-muted p-4 text-sm text-muted-foreground">尚無 Q&A。</div>}
          {items.map((q) => (
            <div key={q.id} className="rounded-3xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-black">Q：{q.question}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">A：{q.answer}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" className="rounded-full" onClick={() => { setEditingId(q.id); setQuestion(q.question); setAnswer(q.answer); setOrder(String(q.display_order)); }}><Edit3 className="h-4 w-4" /></Button>
                  <Button size="icon" variant="destructive" className="rounded-full" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ───────────── 認識中心 ───────────── */
export function AboutAdmin() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("about_page")
      .select("title,content")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTitle(data.title);
          setContent(data.content);
        }
      });
  }, []);

  async function save() {
    if (!title.trim()) return toast.error("請填寫標題");
    setBusy(true);
    try {
      const { error } = await supabase.from("about_page").upsert({ id: 1, title: title.trim(), content });
      if (error) throw error;
      toast.success("認識中心內容已儲存");
    } catch (err) {
      toast.error(errMsg(err, "儲存失敗"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-4xl p-5">
      <div className="text-lg font-black">認識中心分頁內容</div>
      <div className="mt-4 space-y-3">
        <Input placeholder="頁面標題" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="頁面內容（換行會保留）" rows={14} value={content} onChange={(e) => setContent(e.target.value)} />
        <Button className="rounded-full font-bold" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          儲存
        </Button>
      </div>
    </Card>
  );
}
