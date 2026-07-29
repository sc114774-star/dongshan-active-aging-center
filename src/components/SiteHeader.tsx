/*
STYLE NOTE
- Navigation must feel simple and elder-friendly: large tap targets, clear labels, no crowded mascot in mobile header.
- Desktop = one-line pill navigation; Mobile = full-width menu rows.
*/

import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CalendarDays, Camera, HeartHandshake, Home, Menu, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";

const nav = [
  { href: "/", label: "首頁", icon: Home },
  { href: "/gallery", label: "花絮", icon: Camera },
  { href: "/calendar", label: "課程", icon: CalendarDays },
  { href: "/reflections", label: "心得", icon: HeartHandshake },
];

function NavLinks({ onClick, mobile = false }: { onClick?: () => void; mobile?: boolean }) {
  const [location] = useLocation();
  return (
    <nav className={cn(mobile ? "grid gap-3" : "flex items-center gap-2")}>
      {nav.map((item) => {
        const active = location === item.href;
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={onClick}>
            <Button
              variant={active ? "secondary" : "ghost"}
              className={cn(
                "rounded-full font-black transition",
                mobile
                  ? "h-14 w-full justify-start gap-3 px-5 text-lg"
                  : "h-12 min-w-20 gap-2 px-5 text-base",
                active && "shadow-sm ring-1 ring-border"
              )}
            >
              <Icon className={cn(mobile ? "h-5 w-5" : "h-4 w-4")} />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/88 backdrop-blur supports-[backdrop-filter]:bg-background/78">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <motion.div
            initial={{ rotate: -6, y: -2 }}
            animate={{ rotate: [-6, 4, -6], y: [-2, 1, -2] }}
            transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
            className="hidden shrink-0 sm:block"
          >
            <img
              src={logo}
              alt="臺南市東山區樂齡中心 標誌"
              className="h-14 w-14 rounded-full border border-border/60 bg-background object-cover shadow-sm md:h-16 md:w-16"
            />
          </motion.div>

          <Link href="/">
            <div className="group block min-w-0 cursor-pointer">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className="rounded-2xl bg-secondary px-3 py-1.5 shadow-sm">
                  <span className="text-[13px] font-black tracking-wide text-secondary-foreground sm:text-[14px]">
                    臺南市東山區
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-1">
                  <span className="truncate text-lg font-black sm:text-xl">樂齡學習中心</span>
                  <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                </div>
              </div>
              <div className="mt-0.5 hidden text-xs font-medium text-muted-foreground group-hover:text-foreground sm:block">
                青山國小承辦 · 一起學習、一起更健康
              </div>
            </div>
          </Link>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <NavLinks />
          <Link href="/admin">
            <Button className="h-12 rounded-full px-5 text-base font-black">
              <Sparkles className="mr-2 h-4 w-4" />
              後台
            </Button>
          </Link>
        </div>

        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-12 w-12 rounded-full">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(92vw,380px)] overflow-y-auto p-5">
              <SheetHeader>
                <SheetTitle className="text-left text-2xl font-black">網站選單</SheetTitle>
              </SheetHeader>
              <div className="mt-5 rounded-4xl border border-border bg-secondary/35 p-4">
                <div className="flex items-center gap-4">
                  <img
                    src={logo}
                    alt="臺南市東山區樂齡中心 標誌"
                    className="h-20 w-20 shrink-0 rounded-full border border-border/60 bg-background object-cover shadow-sm"
                  />
                  <div className="min-w-0">
                    <div className="text-xl font-black">樂齡學習中心</div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">
                      東山區 · 青山國小承辦
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <NavLinks mobile />
                <Link href="/admin">
                  <Button className="mt-3 h-14 w-full rounded-full text-lg font-black">
                    <Sparkles className="mr-2 h-5 w-5" />
                    管理後台
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
