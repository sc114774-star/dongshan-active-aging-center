import { useEffect, useMemo, useState } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import MascotSticker from "@/components/MascotSticker";
import { listReflections } from "@/lib/db";
import type { DbReflection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BookOpen, MapPin, Quote } from "lucide-react";

export default function Reflections() {
  const [rows, setRows] = useState<DbReflection[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const hasSupabase = useMemo(
    () => Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
    []
  );

  useEffect(() => {
    let mounted = true;
    listReflections()
      .then((data) => {
        if (!mounted) return;
        setRows(data);
        setActiveId((current) => current ?? data[0]?.id ?? null);
      })
      .catch(() => {
        if (!mounted) return;
        setRows([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const active = useMemo(() => rows?.find((r) => r.id === activeId) ?? rows?.[0] ?? null, [rows, activeId]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-black">成果心得</div>
          <div className="mt-2 text-sm text-muted-foreground">
            用一張照片、一段文字與一句金句，記錄學員在樂齡學習中的真實收穫。
          </div>
          {!hasSupabase && (
            <div className="mt-2 text-xs text-muted-foreground">目前顯示示範資料（尚未設定 Supabase）。</div>
          )}
        </div>
        <div className="hidden sm:block">
          <MascotSticker variant="wave" className="h-16 w-16" />
        </div>
      </div>

      {rows === null ? (
        <Card className="rounded-4xl border-border bg-card p-5 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <Skeleton className="aspect-[4/3] rounded-4xl" />
            <div className="space-y-4">
              <Skeleton className="h-9 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="rounded-4xl border-border bg-card p-8 text-sm text-muted-foreground shadow-sm">
          目前尚未新增成果心得。請到 /admin 後台新增第一篇心得。
        </Card>
      ) : active ? (
        <>
          <Card className="overflow-hidden rounded-[2rem] border-border bg-card p-4 shadow-sticker md:p-6">
            <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
              <div className="relative">
                <AspectRatio ratio={4 / 3} className="overflow-hidden rounded-[1.65rem] border border-border bg-secondary/40">
                  {active.image_url ? (
                    <img
                      src={active.image_url}
                      alt={active.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-secondary/50">
                      <MascotSticker variant="camera" className="h-36 w-36" />
                    </div>
                  )}
                </AspectRatio>
                <div className="absolute -bottom-4 left-5 rounded-full border border-border bg-background px-4 py-2 text-xs font-black shadow-sm">
                  樂齡學習紀錄
                </div>
              </div>

              <div className="flex min-h-full flex-col rounded-[1.65rem] bg-background/75 p-5">
                <div className="flex flex-wrap gap-2">
                  {(active.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="secondary" className="rounded-full px-3 py-1">
                      {tag.includes("里") || tag.includes("國小") || tag.includes("區") ? (
                        <MapPin className="mr-1 h-3.5 w-3.5" />
                      ) : (
                        <BookOpen className="mr-1 h-3.5 w-3.5" />
                      )}
                      {tag}
                    </Badge>
                  ))}
                </div>

                <h1 className="mt-4 text-3xl font-black leading-tight md:text-4xl">{active.title}</h1>
                <Separator className="my-4" />
                <p className="text-base leading-8 text-foreground/88">{active.content}</p>

                {active.quote && (
                  <div className="mt-5 rounded-[1.5rem] border border-primary/20 bg-primary/10 p-5">
                    <div className="flex items-start gap-3">
                      <Quote className="mt-1 h-5 w-5 flex-none text-primary" />
                      <div className="text-lg font-black leading-8 text-foreground">「{active.quote}」</div>
                    </div>
                  </div>
                )}

                <div className="mt-auto pt-5 text-right text-sm font-black text-muted-foreground">
                  — {active.author || "樂齡學員"}
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2">
            {rows.map((r) => (
              <Button
                key={r.id}
                variant={r.id === active.id ? "default" : "outline"}
                className={cn("rounded-full font-bold", r.id === active.id && "shadow-sm")}
                onClick={() => setActiveId(r.id)}
              >
                {r.title}
              </Button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
