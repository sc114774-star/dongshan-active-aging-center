import { useEffect, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { listIntroImages } from "@/lib/db";
import { createIntroImage, deleteIntroImage, uploadImage } from "@/lib/adminDb";
import type { DbIntroImage } from "@/lib/types";
import { errMsg } from "@/lib/errors";

const GENERAL = "general"; // 中心總覽（不屬於任何社區）

// 總管理員專用：上傳「介紹」分頁顯示的據點介紹圖片
export default function IntroAdmin() {
  const { communities, communityName } = useAuth();
  const [target, setTarget] = useState(GENERAL);
  const [caption, setCaption] = useState("");
  const [items, setItems] = useState<DbIntroImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function refresh() {
    setItems(await listIntroImages());
  }
  useEffect(() => {
    refresh().catch(() => toast.error("介紹圖片讀取失敗（請確認已執行 supabase_migration_intro.sql）"));
  }, []);

  async function handleFiles(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return toast.error("請拖拉或選擇圖片檔");
    setUploading(true);
    try {
      for (const file of list) {
        const url = await uploadImage(file, "intro");
        await createIntroImage({ image_url: url, caption: caption.trim() || null, community_id: target === GENERAL ? null : target });
      }
      setCaption("");
      toast.success(`已上傳 ${list.length} 張介紹圖片`);
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, "上傳失敗"));
    } finally {
      setUploading(false);
      setDragging(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  async function remove(img: DbIntroImage) {
    if (!confirm("確定刪除這張介紹圖片？圖片檔案也會一併刪除。")) return;
    try {
      await deleteIntroImage(img);
      toast.success("已刪除");
      await refresh();
    } catch (err) {
      toast.error(errMsg(err, "刪除失敗"));
    }
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">上傳據點介紹圖片</div>
        <div className="mt-1 text-sm text-muted-foreground">圖片會顯示在網站「介紹」分頁，依所選的據點分頁。文字介紹請到「認識中心」分頁編輯。</div>
        <div className="mt-4">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選擇要放在哪個分頁" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GENERAL}>中心介紹（總覽）</SelectItem>
              {communities.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input className="mt-4" placeholder="圖片說明（可留空，多張上傳會共用此說明）" value={caption} onChange={(e) => setCaption(e.target.value)} />
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
            選擇圖片
            <input className="hidden" type="file" accept="image/*" multiple onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && handleFiles(e.target.files)} />
          </label>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((img) => (
          <Card key={img.id} className="overflow-hidden rounded-4xl">
            <img src={img.image_url} alt={img.caption ?? "據點介紹"} className="aspect-[4/3] w-full bg-secondary/30 object-contain" />
            <div className="p-3">
              <div className="text-sm font-bold">{img.community_id ? communityName(img.community_id) : "中心介紹（總覽）"}</div>
              {img.caption && <div className="line-clamp-1 text-xs text-muted-foreground">{img.caption}</div>}
              <Button variant="destructive" size="sm" className="mt-3 rounded-full" onClick={() => remove(img)}>
                <Trash2 className="mr-2 h-4 w-4" />刪除
              </Button>
            </div>
          </Card>
        ))}
        {items.length === 0 && <div className="rounded-3xl bg-muted p-6 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">還沒有介紹圖片。</div>}
      </div>
    </div>
  );
}
