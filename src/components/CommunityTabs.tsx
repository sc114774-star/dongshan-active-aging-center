import { cn } from "@/lib/utils";

export type TabItem = { id: string; name: string; count?: number };

// 社區分頁列：手機可橫向捲動，字大、點擊範圍大（長輩友善）
export default function CommunityTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "h-12 shrink-0 rounded-full border px-5 text-base font-black transition outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              on ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card hover:bg-secondary/60"
            )}
          >
            {t.name}
            {t.count !== undefined && <span className={cn("ml-2 text-sm font-bold", on ? "opacity-90" : "text-muted-foreground")}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
