import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import MascotSticker from "@/components/MascotSticker";
import type { DbEvent, DbPhoto, DbReflection } from "@/lib/types";
import { LOCATIONS, SCHOOL_YEARS } from "@/lib/constants";
import { listEventsBetween, listPhotos, listReflections } from "@/lib/db";
import {
  createEvent,
  createPhoto,
  createReflection,
  deleteEvent,
  deletePhoto,
  setPhotoApproved,
  deleteReflection,
  updateEvent,
  updateReflection,
  uploadImage,
  type EventInput,
  type ReflectionInput,
} from "@/lib/adminDb";
import { Edit3, ImagePlus, Loader2, Plus, Save, Trash2 } from "lucide-react";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "114774";
const emptyEvent: EventInput = { title: "", date: format(new Date(), "yyyy-MM-dd"), location: "", content: "", teacher: "" };
const emptyReflection: ReflectionInput = {
  title: "",
  content: "",
  quote: "",
  author: "",
  image_url: "",
  tags: [],
  school_year: "",
  location: "",
};

function hasSupabaseConfig() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [pwd, setPwd] = useState("");

  function login() {
    if (pwd.trim() === ADMIN_PASSWORD) {
      onLogin();
      toast.success("已進入管理後台");
    } else {
      toast.error("密碼錯誤");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <div className="flex items-center gap-3">
        <MascotSticker variant="calendar" className="h-16 w-16" />
        <div>
          <div className="text-3xl font-black">管理後台</div>
          <div className="mt-1 text-sm text-muted-foreground">請輸入固定密碼以進入。</div>
        </div>
      </div>

      <Card className="rounded-4xl border-border bg-card p-6 shadow-sm">
        <div className="text-sm font-bold">登入</div>
        <div className="mt-3 flex gap-2">
          <Input
            type="password"
            placeholder="請輸入密碼"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") login();
            }}
          />
          <Button className="rounded-full font-bold" onClick={login}>
            進入
          </Button>
        </div>
        <div className="mt-3 text-xs leading-6 text-muted-foreground">
          注意：這是「靜態網站 + 固定密碼」簡易方案。為了符合此需求，Supabase SQL 會開放 anon
          key 寫入；若未來要更嚴格權限，建議升級 Supabase Auth 或 Edge Functions。
        </div>
      </Card>
    </div>
  );
}

function EventsAdmin() {
  const [items, setItems] = useState<DbEvent[]>([]);
  const [form, setForm] = useState<EventInput>(emptyEvent);
  const [eventDates, setEventDates] = useState<string[]>([emptyEvent.date]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const rows = await listEventsBetween("2020-01-01", "2035-12-31");
    setItems(rows);
  }

  useEffect(() => {
    refresh().catch(() => toast.error("課程資料讀取失敗"));
  }, []);

  function resetEventForm() {
    setForm(emptyEvent);
    setEventDates([format(new Date(), "yyyy-MM-dd")]);
    setEditingId(null);
  }

  function edit(row: DbEvent) {
    setEditingId(row.id);
    setForm({ title: row.title, date: row.date, location: row.location ?? "", content: row.content ?? "", teacher: row.teacher ?? "" });
    setEventDates([row.date]);
  }

  function updateEventDate(index: number, value: string) {
    setEventDates((prev) => prev.map((date, i) => (i === index ? value : date)));
  }

  function addEventDate() {
    setEventDates((prev) => [...prev, prev[prev.length - 1] || format(new Date(), "yyyy-MM-dd")]);
  }

  function removeEventDate(index: number) {
    setEventDates((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function submit() {
    const dates = editingId
      ? [form.date]
      : Array.from(new Set(eventDates.map((d) => d.trim()).filter(Boolean)));

    if (!form.title.trim() || dates.length === 0) {
      toast.error("請填寫課程標題與至少一個日期");
      return;
    }
    setLoading(true);
    try {
      const basePayload = {
        title: form.title.trim(),
        location: form.location?.trim() || null,
        content: form.content?.trim() || null,
        teacher: form.teacher?.trim() || null,
      };
      if (editingId) {
        await updateEvent(editingId, { ...basePayload, date: dates[0] });
        toast.success("課程已更新");
      } else {
        for (const date of dates) {
          await createEvent({ ...basePayload, date });
        }
        toast.success(`已新增 ${dates.length} 筆課程日期`);
      }
      resetEventForm();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("確定刪除此課程？")) return;
    try {
      await deleteEvent(id);
      toast.success("課程已刪除");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刪除失敗");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">{editingId ? "修改課程" : "新增課程"}</div>
        <div className="mt-4 space-y-3">
          <Input placeholder="課程標題" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Input placeholder="授課老師（快速上傳頁會顯示）" value={form.teacher ?? ""} onChange={(e) => setForm({ ...form, teacher: e.target.value })} />
          {editingId ? (
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          ) : (
            <div className="rounded-3xl border border-border bg-secondary/25 p-4">
              <div className="mb-3 text-sm font-black">課程日期（可新增多個日期）</div>
              <div className="space-y-2">
                {eventDates.map((date, index) => (
                  <div key={`${date}-${index}`} className="flex gap-2">
                    <Input type="date" value={date} onChange={(e) => updateEventDate(index, e.target.value)} />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 rounded-full"
                      onClick={() => removeEventDate(index)}
                      disabled={eventDates.length <= 1}
                      title="移除此日期"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" className="mt-3 h-11 rounded-full font-bold" onClick={addEventDate}>
                <Plus className="mr-2 h-4 w-4" />
                新增另一個日期
              </Button>
            </div>
          )}
          <Select
            value={form.location ?? ""}
            onValueChange={(value) => setForm({ ...form, location: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選擇地點" />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea placeholder="課程內容 / 備註" rows={5} value={form.content ?? ""} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <div className="flex gap-2">
            <Button className="rounded-full font-bold" onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {editingId ? "儲存修改" : "新增課程"}
            </Button>
            {editingId && (
              <Button variant="outline" className="rounded-full" onClick={resetEventForm}>
                取消
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">課程列表</div>
        <div className="mt-4 space-y-2">
          {items.length === 0 ? (
            <div className="rounded-3xl bg-muted p-4 text-sm text-muted-foreground">尚無課程。</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="secondary" className="rounded-full">{item.date}</Badge>
                    <div className="mt-2 font-black">{item.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.location || "未填地點"}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" className="rounded-full" onClick={() => edit(item)}><Edit3 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="destructive" className="rounded-full" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function PhotosAdmin() {
  const [items, setItems] = useState<DbPhoto[]>([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function refresh() {
    setItems(await listPhotos());
  }

  useEffect(() => {
    refresh().catch(() => toast.error("照片資料讀取失敗"));
  }, []);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      toast.error("請拖拉或選擇圖片檔");
      return;
    }
    setUploading(true);
    try {
      for (const file of list) {
        const url = await uploadImage(file, "photos");
        await createPhoto({ image_url: url, caption: caption.trim() || null });
      }
      setCaption("");
      toast.success(`已上傳 ${list.length} 張照片`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上傳失敗");
    } finally {
      setUploading(false);
      setDragging(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  async function toggleApproved(p: DbPhoto) {
    try {
      await setPhotoApproved(p.id, !(p.is_approved ?? true));
      toast.success(p.is_approved === false ? "已核准，前台可見" : "已改為待審，前台隱藏");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失敗");
    }
  }

  async function remove(id: string) {
    if (!confirm("確定刪除此照片紀錄？（不會自動刪除 Storage 檔案）")) return;
    try {
      await deletePhoto(id);
      toast.success("照片紀錄已刪除");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "刪除失敗");
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">拖拉上傳圖片</div>
        <Input className="mt-4" placeholder="照片說明（可留空，多張上傳會共用此說明）" value={caption} onChange={(e) => setCaption(e.target.value)} />
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-4 rounded-4xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-primary bg-primary/10" : "border-border bg-secondary/25"}`}
        >
          <ImagePlus className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-2 font-black">把圖片拖到這裡</div>
          <div className="mt-1 text-sm text-muted-foreground">或點下方按鈕選擇檔案，可一次上傳多張。</div>
          <label className="mt-4 inline-flex cursor-pointer items-center rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground shadow-sm">
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
            選擇照片
            <input className="hidden" type="file" accept="image/*" multiple onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && handleFiles(e.target.files)} />
          </label>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Card key={p.id} className="overflow-hidden rounded-4xl">
            <img src={p.image_url} alt={p.caption ?? "活動照片"} className="aspect-[4/3] w-full object-cover" />
            <div className="p-3">
              <div className="line-clamp-1 text-sm font-bold">{p.caption || "活動花絮"}</div>
              <Badge variant={p.is_approved === false ? "destructive" : "secondary"} className="mt-2 rounded-full">
                {p.is_approved === false ? "待審核" : "已公開"}
              </Badge>
              <Button variant="outline" size="sm" className="ml-2 mt-3 rounded-full" onClick={() => toggleApproved(p)}>
                {p.is_approved === false ? "核准公開" : "取消公開"}
              </Button>
              <Button variant="destructive" size="sm" className="ml-2 mt-3 rounded-full" onClick={() => remove(p.id)}>
                <Trash2 className="mr-2 h-4 w-4" />刪除紀錄
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ReflectionsAdmin() {
  const [items, setItems] = useState<DbReflection[]>([]);
  const [form, setForm] = useState<ReflectionInput>(emptyReflection);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function refresh() {
    setItems(await listReflections());
  }

  useEffect(() => {
    refresh().catch(() => toast.error("心得資料讀取失敗"));
  }, []);

  function edit(row: DbReflection) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      content: row.content,
      quote: row.quote ?? "",
      author: row.author ?? "",
      image_url: row.image_url ?? "",
      tags: row.tags ?? [],
      school_year: row.school_year ?? "",
      location: row.location ?? "",
    });
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

  async function submit() {
    if (!form.title?.trim() || !form.content?.trim()) {
      toast.error("請填寫標題與心得內容");
      return;
    }
    if (!form.school_year || !form.location) {
      toast.error("請選擇學年度與地點");
      return;
    }
    setLoading(true);
    try {
      const payload: ReflectionInput = {
        title: form.title.trim(),
        content: form.content.trim(),
        quote: form.quote?.trim() || null,
        author: form.author?.trim() || null,
        image_url: form.image_url?.trim() || null,
        school_year: form.school_year,
        location: form.location,
        tags: [form.school_year, form.location].filter(Boolean) as string[],
      };
      if (editingId) {
        await updateReflection(editingId, payload);
        toast.success("心得已更新");
      } else {
        await createReflection(payload);
        toast.success("心得已新增");
      }
      setEditingId(null);
      setForm(emptyReflection);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setLoading(false);
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">{editingId ? "修改成果心得" : "新增成果心得"}</div>
        <div className="mt-4 space-y-3">
          <Input placeholder="心得標題" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={form.school_year ?? ""}
              onValueChange={(value) => setForm({ ...form, school_year: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選擇學年度" />
              </SelectTrigger>
              <SelectContent>
                {SCHOOL_YEARS.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={form.location ?? ""}
              onValueChange={(value) => setForm({ ...form, location: value })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選擇地點" />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea placeholder="心得內容" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          <Textarea placeholder="重點金句" rows={3} value={form.quote ?? ""} onChange={(e) => setForm({ ...form, quote: e.target.value })} />
          <Input placeholder="學員署名（例：學員｜陳○○）" value={form.author ?? ""} onChange={(e) => setForm({ ...form, author: e.target.value })} />
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
            <Button className="rounded-full font-bold" onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingId ? "儲存修改" : "新增心得"}
            </Button>
            {editingId && (
              <Button variant="outline" className="rounded-full" onClick={() => { setEditingId(null); setForm(emptyReflection); }}>
                取消
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">心得列表</div>
        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-3xl bg-muted p-4 text-sm text-muted-foreground">尚無心得。</div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-border bg-background p-4">
                <div className="font-black">{item.title}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(item.tags ?? []).map((t) => <Badge key={t} variant="secondary" className="rounded-full">{t}</Badge>)}
                </div>
                <div className="mt-3 flex gap-1">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => edit(item)}><Edit3 className="mr-2 h-4 w-4" />修改</Button>
                  <Button size="sm" variant="destructive" className="rounded-full" onClick={() => remove(item.id)}><Trash2 className="mr-2 h-4 w-4" />刪除</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

export default function Admin() {
  const storageKey = useMemo(() => "ds-aac-admin-authed", []);
  const [authed, setAuthed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  function onLogin() {
    localStorage.setItem(storageKey, "1");
    setAuthed(true);
  }

  function logout() {
    localStorage.removeItem(storageKey);
    setAuthed(false);
    toast.success("已登出");
  }

  if (!authed) return <AdminLogin onLogin={onLogin} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-black">管理後台</div>
          <div className="mt-2 text-sm text-muted-foreground">
            管理課程行事曆、活動花絮照片與成果心得。
          </div>
        </div>
        <Button variant="outline" className="rounded-full font-bold" onClick={logout}>登出</Button>
      </div>

      {!hasSupabaseConfig() && (
        <Card className="rounded-4xl border-primary/25 bg-primary/10 p-4 text-sm leading-7">
          尚未設定 Supabase 環境變數，因此後台無法真正寫入資料。請在 Vercel 設定
          <code className="mx-1 rounded bg-background px-1">VITE_SUPABASE_URL</code>
          與
          <code className="mx-1 rounded bg-background px-1">VITE_SUPABASE_ANON_KEY</code>。
        </Card>
      )}

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-3xl bg-secondary/60 p-1">
          <TabsTrigger value="events" className="rounded-2xl font-bold">課程行事曆</TabsTrigger>
          <TabsTrigger value="photos" className="rounded-2xl font-bold">照片管理</TabsTrigger>
          <TabsTrigger value="reflections" className="rounded-2xl font-bold">成果心得</TabsTrigger>
        </TabsList>
        <Separator />
        <TabsContent value="events"><EventsAdmin /></TabsContent>
        <TabsContent value="photos"><PhotosAdmin /></TabsContent>
        <TabsContent value="reflections"><ReflectionsAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}
