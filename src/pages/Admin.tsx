import { useEffect, useState } from "react";
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
import type { DbEvent, DbPhoto } from "@/lib/types";
import { LOCATIONS } from "@/lib/constants";
import { useAuth } from "@/lib/auth";
import LoginPanel from "@/components/admin/LoginPanel";
import ReflectionsAdmin from "@/components/admin/ReflectionsAdmin";
import { AboutAdmin, AnnouncementsAdmin, QnaAdmin } from "@/components/admin/ContentAdmin";
import { listEventsBetween, listPhotos } from "@/lib/db";
import {
  createEvent,
  createPhoto,
  deleteEvent,
  deletePhoto,
  setPhotoApproved,
  updateEvent,
  uploadImage,
  type EventInput,
} from "@/lib/adminDb";
import { Edit3, ImagePlus, Loader2, Plus, Save, Trash2 } from "lucide-react";

const emptyEvent: EventInput = { title: "", date: format(new Date(), "yyyy-MM-dd"), location: "", content: "", teacher: "", community_id: "" };
function hasSupabaseConfig() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function EventsAdmin() {
  const { communities, communityName } = useAuth();
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
    setForm({ ...emptyEvent, community_id: form.community_id });
    setEventDates([format(new Date(), "yyyy-MM-dd")]);
    setEditingId(null);
  }

  function edit(row: DbEvent) {
    setEditingId(row.id);
    setForm({ title: row.title, date: row.date, location: row.location ?? "", content: row.content ?? "", teacher: row.teacher ?? "", community_id: row.community_id ?? "" });
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
    if (!form.community_id) {
      toast.error("請選擇課程所屬社區");
      return;
    }
    setLoading(true);
    try {
      const basePayload = {
        community_id: form.community_id,
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
          <Select value={form.community_id ?? ""} onValueChange={(value) => setForm({ ...form, community_id: value })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選擇所屬社區" />
            </SelectTrigger>
            <SelectContent>
              {communities.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                    <div className="mt-1 text-sm text-muted-foreground">{[communityName(item.community_id), item.location || "未填地點"].filter(Boolean).join("・")}</div>
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
  const { isAdmin, myCommunityId, communities, communityName } = useAuth();
  const [communityId, setCommunityId] = useState(myCommunityId ?? "");
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
    if (!communityId) {
      toast.error("請先選擇社區");
      return;
    }
    setUploading(true);
    try {
      for (const file of list) {
        const url = await uploadImage(file, "photos");
        await createPhoto({ image_url: url, caption: caption.trim() || null, community_id: communityId });
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

  const visibleItems = isAdmin ? items : items.filter((p) => p.community_id === myCommunityId);

  return (
    <div className="space-y-4">
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">拖拉上傳圖片</div>
        {isAdmin ? (
          <div className="mt-4">
            <Select value={communityId} onValueChange={setCommunityId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="選擇照片所屬社區" />
              </SelectTrigger>
              <SelectContent>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">照片將發佈到「{communityName(myCommunityId)}」。</div>
        )}
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
        {visibleItems.map((p) => (
          <Card key={p.id} className="overflow-hidden rounded-4xl">
            <img src={p.image_url} alt={p.caption ?? "活動照片"} className="aspect-[4/3] w-full object-cover" />
            <div className="p-3">
              <div className="line-clamp-1 text-sm font-bold">{p.caption || "活動花絮"}</div>
              {isAdmin && p.community_id && <div className="text-xs text-muted-foreground">{communityName(p.community_id)}</div>}
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

export default function Admin() {
  const { loading, profile, isAdmin, myCommunityId, communityName, signOut } = useAuth();

  async function logout() {
    await signOut();
    toast.success("已登出");
  }

  if (!hasSupabaseConfig()) {
    return (
      <Card className="rounded-4xl border-primary/25 bg-primary/10 p-4 text-sm leading-7">
        尚未設定 Supabase 環境變數，因此後台無法登入或寫入資料。請在 Vercel 設定
        <code className="mx-1 rounded bg-background px-1">VITE_SUPABASE_URL</code>
        與
        <code className="mx-1 rounded bg-background px-1">VITE_SUPABASE_ANON_KEY</code>。
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return <LoginPanel />;

  // 已登入，但帳號尚未被設定角色／社區
  if (!isAdmin && !myCommunityId) {
    return (
      <Card className="mx-auto max-w-lg space-y-3 rounded-4xl p-6">
        <div className="text-lg font-black">帳號尚未完成設定</div>
        <div className="text-sm text-muted-foreground">此帳號還沒有指定角色或所屬社區，請聯絡總管理員協助設定。</div>
        <Button variant="outline" className="rounded-full font-bold" onClick={logout}>登出</Button>
      </Card>
    );
  }

  const tabs = isAdmin
    ? [
        { value: "events", label: "課程行事曆", node: <EventsAdmin /> },
        { value: "photos", label: "照片管理", node: <PhotosAdmin /> },
        { value: "reflections", label: "成果心得", node: <ReflectionsAdmin /> },
        { value: "announcements", label: "活動公告", node: <AnnouncementsAdmin /> },
        { value: "qna", label: "Q&A頁面", node: <QnaAdmin /> },
        { value: "about", label: "認識中心", node: <AboutAdmin /> },
      ]
    : [
        { value: "photos", label: "照片管理", node: <PhotosAdmin /> },
        { value: "reflections", label: "成果心得", node: <ReflectionsAdmin /> },
      ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-black">管理後台</div>
          <div className="mt-2 text-sm text-muted-foreground">
            目前登入：{isAdmin ? "總管理員" : communityName(myCommunityId)}
          </div>
        </div>
        <Button variant="outline" className="rounded-full font-bold" onClick={logout}>登出</Button>
      </div>

      <Tabs defaultValue={tabs[0].value} className="space-y-4">
        <TabsList className={`grid h-auto w-full rounded-3xl bg-secondary/60 p-1 ${isAdmin ? "grid-cols-3 lg:grid-cols-6" : "grid-cols-2"}`}>
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="rounded-2xl font-bold">{t.label}</TabsTrigger>
          ))}
        </TabsList>
        <Separator />
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>{t.node}</TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
