import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { listPhotos } from "@/lib/db";
import type { DbPhoto } from "@/lib/types";
import { cn } from "@/lib/utils";
import MascotSticker from "@/components/MascotSticker";

function Masonry({ photos, onOpen }: { photos: DbPhoto[]; onOpen: (p: DbPhoto) => void }) {
  return (
    <div className="columns-1 gap-4 [column-fill:_balance] sm:columns-2 lg:columns-3">
      {photos.map((p) => (
        <button
          key={p.id}
          type="button"
          className="group mb-4 block w-full break-inside-avoid overflow-hidden rounded-4xl border border-border bg-card shadow-sm outline-none ring-ring/50 focus-visible:ring-2"
          onClick={() => onOpen(p)}
        >
          <img
            src={p.image_url}
            alt={p.caption ?? "活動照片"}
            loading="lazy"
            className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="line-clamp-1 text-left text-sm font-semibold">
              {p.caption ?? "活動花絮"}
            </div>
            <Badge variant="secondary" className="rounded-full">
              點擊放大
            </Badge>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Gallery() {
  const [photos, setPhotos] = useState<DbPhoto[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<DbPhoto | null>(null);

  const hasSupabase = useMemo(
    () => Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
    []
  );

  useEffect(() => {
    let mounted = true;
    listPhotos()
      .then((rows) => {
        if (mounted) setPhotos(rows);
      })
      .catch(() => {
        if (mounted) setPhotos([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function openPhoto(p: DbPhoto) {
    setActive(p);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-4xl border border-border bg-card p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div className="min-w-0">
          <div className="text-3xl font-black sm:text-4xl">活動花絮</div>
          <div className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">
            瀑布流展示照片，點擊可放大觀看，用於展示樂齡中心的熱鬧氣氛。
          </div>
          {!hasSupabase && (
            <div className="mt-2 text-sm text-muted-foreground">
              目前顯示示範資料（尚未設定 Supabase）。
            </div>
          )}
        </div>
        <div className="justify-self-center rounded-[2rem] bg-secondary/45 p-3 sm:justify-self-end">
          <MascotSticker variant="camera" className="h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44" />
        </div>
      </div>

      <Card className="rounded-4xl border-border bg-card p-4 shadow-sm">
        {photos === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className={cn("h-48 w-full rounded-4xl", i % 2 ? "h-64" : "")} />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-3xl bg-muted p-6 text-sm text-muted-foreground">
            目前還沒有照片。請到 /admin 後台上傳活動花絮。
          </div>
        ) : (
          <Masonry photos={photos} onOpen={openPhoto} />
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl rounded-4xl">
          <DialogHeader>
            <DialogTitle className="text-left">{active?.caption ?? "活動花絮"}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="overflow-hidden rounded-3xl border border-border bg-card">
              <img src={active.image_url} alt={active.caption ?? "活動照片"} className="h-auto w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
