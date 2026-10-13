import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAboutPage, listIntroImages } from "@/lib/db";
import type { DbIntroImage } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import CommunityTabs from "@/components/CommunityTabs";

export default function Intro() {
  const { communities } = useAuth();
  const [about, setAbout] = useState<{ title: string; content: string } | null>(null);
  const [images, setImages] = useState<DbIntroImage[] | null>(null);
  const [tab, setTab] = useState("all");
  const [active, setActive] = useState<DbIntroImage | null>(null);

  useEffect(() => {
    getAboutPage().then(setAbout).catch(() => undefined);
    listIntroImages().then(setImages).catch(() => setImages([]));
  }, []);

  const tabs = useMemo(() => {
    const list = [{ id: "all", name: "中心介紹", count: (images ?? []).filter((i) => !i.community_id).length }];
    for (const c of communities) {
      list.push({ id: c.id, name: c.name, count: (images ?? []).filter((i) => i.community_id === c.id).length });
    }
    return list;
  }, [communities, images]);

  const shown = (images ?? []).filter((i) => (tab === "all" ? !i.community_id : i.community_id === tab));
  const hasText = Boolean(about?.content?.trim());

  return (
    <div className="space-y-5">
      <div className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="text-3xl font-black sm:text-4xl">{about?.title || "認識樂齡學習中心"}</div>
        {hasText && <div className="mt-3 max-w-3xl whitespace-pre-line text-base leading-8">{about?.content}</div>}
      </div>

      <Card className="space-y-4 rounded-4xl border-border bg-card p-4 shadow-sm">
        <CommunityTabs tabs={tabs} active={tab} onChange={setTab} />
        {images === null ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-72 w-full rounded-4xl" />
            <Skeleton className="h-72 w-full rounded-4xl" />
          </div>
        ) : shown.length === 0 ? (
          <div className="rounded-3xl bg-muted p-6 text-sm text-muted-foreground">這裡還沒有介紹圖片。</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {shown.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActive(img)}
                className="overflow-hidden rounded-4xl border border-border bg-background text-left outline-none ring-ring/50 focus-visible:ring-2"
              >
                <img src={img.image_url} alt={img.caption ?? "據點介紹"} loading="lazy" className="h-auto w-full" />
                {img.caption && <div className="p-3 text-sm font-bold">{img.caption}</div>}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={Boolean(active)} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-4xl">
          <DialogHeader>
            <DialogTitle className="text-left">{active?.caption || "據點介紹"}</DialogTitle>
          </DialogHeader>
          {active && <img src={active.image_url} alt={active.caption ?? "據點介紹"} className="h-auto w-full rounded-3xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
