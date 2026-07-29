import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import MascotSticker from "@/components/MascotSticker";
import { motion } from "framer-motion";

function Slide({
  title,
  subtitle,
  tone,
  mascot,
}: {
  title: string;
  subtitle: string;
  tone: "coral" | "sky" | "leaf";
  mascot: "wave" | "calendar" | "camera";
}) {
  const bg =
    tone === "coral"
      ? "from-primary/25 via-background to-secondary/40"
      : tone === "sky"
        ? "from-secondary/60 via-background to-accent/25"
        : "from-accent/35 via-background to-secondary/40";

  return (
    <div className="relative min-h-[360px] overflow-hidden rounded-4xl border border-border bg-card shadow-sticker sm:min-h-[390px] md:min-h-[430px]">
      <div className={`absolute inset-0 bg-gradient-to-br ${bg}`} />
      <div className="absolute inset-0 opacity-[0.18] bg-notebook" />

      <div className="absolute left-5 top-5 z-10 max-w-[86%] sm:left-7 sm:top-7 sm:max-w-[68%]">
        <div className="inline-flex items-center rounded-full bg-background/85 px-3 py-1 text-xs font-bold text-foreground shadow-sm sm:text-sm">
          臺南市東山區 · 樂齡學習中心
        </div>
        <div className="mt-3 text-2xl font-black leading-tight sm:text-4xl md:text-5xl">{title}</div>
        <div className="mt-3 max-w-xl text-sm font-medium leading-7 text-muted-foreground sm:text-base md:text-lg">
          {subtitle}
        </div>
      </div>

      <motion.div
        initial={{ rotate: 8, y: 6 }}
        animate={{ rotate: [8, -6, 8], y: [6, -2, 6] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-28px] right-[-26px] h-[190px] w-[190px] sm:bottom-[-38px] sm:right-[-18px] sm:h-[280px] sm:w-[280px] md:h-[330px] md:w-[330px]"
      >
        <MascotSticker variant={mascot} className="h-full w-full" />
      </motion.div>
    </div>
  );
}

export default function HeroCarousel() {
  return (
    <div className="relative">
      <Carousel opts={{ loop: true }}>
        <CarouselContent>
          <CarouselItem>
            <Slide
              title="一起學、一起笑、一起更健康"
              subtitle="課程、活動、分享都在這裡 — 歡迎你加入樂齡學習！"
              tone="coral"
              mascot="wave"
            />
          </CarouselItem>
          <CarouselItem>
            <Slide
              title="課程行事曆一目了然"
              subtitle="點日期就能看到課程細節與地點，安排時間更輕鬆。"
              tone="sky"
              mascot="calendar"
            />
          </CarouselItem>
          <CarouselItem>
            <Slide
              title="把熱鬧的回憶收藏起來"
              subtitle="活動花絮瀑布流 + 點擊放大，馬上重回現場氛圍。"
              tone="leaf"
              mascot="camera"
            />
          </CarouselItem>
        </CarouselContent>
        <CarouselPrevious className="left-2 h-12 w-12 border-2 bg-background/90 shadow-lg sm:left-4 sm:h-14 sm:w-14" />
        <CarouselNext className="right-2 h-12 w-12 border-2 bg-background/90 shadow-lg sm:right-4 sm:h-14 sm:w-14" />
      </Carousel>
    </div>
  );
}
