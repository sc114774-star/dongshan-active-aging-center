import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { listAllCourses, listPhotos } from "@/lib/db";
import type { DbCourse, DbPhoto } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import CommunityTabs from "@/components/CommunityTabs";
import { cn } from "@/lib/utils";
import MascotSticker from "@/components/MascotSticker";

function Masonry({ photos, onOpen, label }: { photos: DbPhoto[]; onOpen: (p: DbPhoto) => void; label: (p: DbPhoto) => string }) {
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
            alt={label(p)}
            loading="lazy"
            className="h-auto w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="line-clamp-1 text-left text-sm font-semibold">
              {label(p)}
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
  const { communities } = useAuth();
  const [photos, setPhotos] = useState<DbPhoto[] | null>(null);
  const [courses, setCourses] = useState<DbCourse[]>([]);
  const [tab, setTab] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>("all");
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
    listAllCourses()
      .then((rows) => mounted && setCourses(rows))
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  // 只顯示已核准的照片（待審核照片不公開）
  const approved = useMemo(() => (photos ?? []).filter((p) => p.is_approved !== false), [photos]);
  const courseTitle = (id?: string | null) => courses.find((c) => c.id === id)?.title ?? "";
  const label = (p: DbPhoto) => p.caption || courseTitle(p.event_id) || "活動花絮";

  const tabs = useMemo(() => {
    const list = communities.map((c) => ({ id: c.id, name: c.name, count: approved.filter((p) => p.community_id === c.id).length }));
    const orphan = approved.filter((p) => !p.community_id || !communities.some((c) => c.id === p.community_id));
    if (orphan.length) list.push({ id: "none", name: "其他", count: orphan.length });
    return list;
  }, [communities, approved]);

  const activeTab = tab ?? tabs.find((t) => (t.count ?? 0) > 0)?.id ?? tabs[0]?.id ?? "none";
  const inTab = useMemo(
    () =>
      approved.filter((p) =>
        activeTab === "none" ? !p.community_id || !communities.some((c) => c.id === p.community_id) : p.community_id === activeTab
      ),
    [approved, activeTab, communities]
  );

  // 課程篩選標籤：只列出這個社區有照片的課程
  const courseChips = useMemo(() => {
    const m = new Map<string, number>();
    let none = 0;
    for (const p of inTab) {
      if (p.event_id) m.set(p.event_id, (m.get(p.event_id) ?? 0) + 1);
      else none += 1;
    }
    const chips = [{ id: "all", name: "全部課程", count: inTab.length }];
    for (const [id, count] of m) chips.push({ id, name: courseTitle(id) || "未命名課程", count });
    if (none) chips.push({ id: "none", name: "未分類", count: none });
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTab, courses]);

  const shown = inTab.filter((p) =>
    courseFilter === "all" ? true : courseFilter === "none" ? !p.event_id : p.event_id === courseFilter
  );

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
            先選社區，再選課程，點擊照片可放大觀看。
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
        ) : approved.length === 0 ? (
          <div className="rounded-3xl bg-muted p-6 text-sm text-muted-foreground">
            目前還沒有照片。請到 /admin 後台上傳活動花絮。
          </div>
        ) : (
          <div className="space-y-4">
            <CommunityTabs
              tabs={tabs}
              active={activeTab}
              onChange={(id) => {
                setTab(id);
                setCourseFilter("all");
              }}
            />
            <div className="flex flex-wrap gap-2">
              {courseChips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCourseFilter(c.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-bold transition",
                    courseFilter === c.id ? "border-primary bg-primary/15 text-foreground" : "border-border bg-background hover:bg-secondary/60"
                  )}
                >
                  {c.name}
                  <span className="ml-1.5 text-muted-foreground">{c.count}</span>
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <div className="rounded-3xl bg-muted p-6 text-sm text-muted-foreground">這個社區目前還沒有照片。</div>
            ) : (
              <Masonry photos={shown} onOpen={openPhoto} label={label} />
            )}
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl rounded-4xl">
          <DialogHeader>
            <DialogTitle className="text-left">{active ? label(active) : "活動花絮"}</DialogTitle>
          </DialogHeader>
          {active && (
            <div className="overflow-hidden rounded-3xl border border-border bg-card">
              <img src={active.image_url} alt={label(active)} className="h-auto w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
