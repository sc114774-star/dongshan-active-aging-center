import { useEffect, useMemo, useState } from "react";
import { addMonths, format, isSameDay, isSameMonth, subMonths } from "date-fns";
import { zhTW } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, MapPin } from "lucide-react";
import MascotSticker from "@/components/MascotSticker";

import { listEventsBetween } from "@/lib/db";
import type { DbEvent } from "@/lib/types";
import { humanDate, monthRange, ymd } from "@/lib/date";
import { cn } from "@/lib/utils";

const weekLabels = ["一", "二", "三", "四", "五", "六", "日"];

function groupByDay(events: DbEvent[]) {
  const map = new Map<string, DbEvent[]>();
  for (const e of events) {
    const arr = map.get(e.date) ?? [];
    arr.push(e);
    map.set(e.date, arr);
  }
  return map;
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<DbEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const hasSupabase = useMemo(
    () => Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY),
    []
  );

  const days = useMemo(() => {
    const { start } = monthRange(month, 1);
    const d = new Date(start.getTime());
    const safe: Date[] = [];
    for (let i = 0; i < 42; i++) {
      safe.push(new Date(d.getTime()));
      d.setDate(d.getDate() + 1);
    }
    return safe;
  }, [month]);

  useEffect(() => {
    let mounted = true;
    setEvents(null);
    const { start, end } = monthRange(month, 1);
    const startYmd = ymd(start);
    const endYmd = ymd(end);

    listEventsBetween(startYmd, endYmd)
      .then((rows) => {
        if (mounted) setEvents(rows);
      })
      .catch(() => {
        if (mounted) setEvents([]);
      });

    return () => {
      mounted = false;
    };
  }, [month]);

  const eventsByDay = useMemo(() => groupByDay(events ?? []), [events]);

  function onPickDate(d: Date) {
    const dateKey = ymd(d);
    setActiveDate(dateKey);
    setOpen(true);
  }

  const title = format(month, "yyyy 年 M 月", { locale: zhTW });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-3xl font-black">課程行事曆</div>
          <div className="mt-2 text-sm text-muted-foreground">
            以月曆形式呈現每日課程名稱。點擊日期會彈出視窗顯示課程細節與地點。
          </div>
          {!hasSupabase && (
            <div className="mt-2 text-xs text-muted-foreground">目前顯示示範資料（尚未設定 Supabase）。</div>
          )}
        </div>
        <div className="hidden sm:block">
          <MascotSticker variant="calendar" className="h-16 w-16" />
        </div>
      </div>

      <Card className="rounded-4xl border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div className="text-xl font-black">{title}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => setMonth((m) => subMonths(m, 1))}>
              上個月
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => setMonth(() => new Date())}>
              本月
            </Button>
            <Button variant="outline" className="rounded-full" onClick={() => setMonth((m) => addMonths(m, 1))}>
              下個月
            </Button>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto pb-2">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-7 gap-2">
              {weekLabels.map((w) => (
                <div key={w} className="text-center text-xs font-bold text-muted-foreground">
                  {w}
                </div>
              ))}
            </div>

            {events === null ? (
              <div className="mt-3 grid grid-cols-7 gap-2">
                {Array.from({ length: 14 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-3xl" />
                ))}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-7 gap-2">
                {days.map((d) => {
                  const inMonth = isSameMonth(d, month);
                  const key = ymd(d);
                  const dayEvents = eventsByDay.get(key) ?? [];

                  return (
                    <button
                      key={key}
                      type="button"
                      className={cn(
                        "group min-h-28 rounded-3xl border border-border bg-background px-2 py-2 text-left shadow-sm outline-none ring-ring/50 transition hover:-translate-y-[1px] hover:shadow-md focus-visible:ring-2",
                        !inMonth && "opacity-55",
                        isSameDay(d, new Date()) && "border-primary"
                      )}
                      onClick={() => onPickDate(d)}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn("text-sm font-black", !inMonth && "text-muted-foreground")}>{d.getDate()}</div>
                        {dayEvents.length > 0 && (
                          <Badge className="rounded-full" variant="secondary">
                            {dayEvents.length}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((e) => (
                          <div
                            key={e.id}
                            className="line-clamp-1 rounded-2xl bg-secondary/55 px-2 py-1 text-[12px] font-semibold text-secondary-foreground"
                          >
                            {e.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[12px] font-semibold text-muted-foreground">＋{dayEvents.length - 2} 筆</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-4xl">
          <DialogHeader>
            <DialogTitle className="text-left">{activeDate ? humanDate(activeDate) : "課程詳情"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {(activeDate ? eventsByDay.get(activeDate) ?? [] : []).length === 0 ? (
              <div className="rounded-3xl bg-muted p-5 text-sm text-muted-foreground">這天沒有安排課程。</div>
            ) : (
              (eventsByDay.get(activeDate ?? "") ?? []).map((e) => (
                <div key={e.id} className="rounded-3xl border border-border bg-card p-4">
                  <div className="text-base font-black">{e.title}</div>
                  {e.location && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      <span>{e.location}</span>
                    </div>
                  )}
                  {e.content && <div className="mt-2 text-sm leading-7 text-foreground/90">{e.content}</div>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
