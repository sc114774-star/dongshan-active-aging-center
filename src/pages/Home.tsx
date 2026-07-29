import HeroCarousel from "@/components/HeroCarousel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import MascotSticker from "@/components/MascotSticker";
import { BookOpen, Camera, CalendarDays } from "lucide-react";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="space-y-5">
        <HeroCarousel />
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="paper-edge rounded-4xl border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-black">中心簡介</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  我們在東山區青山里，提供多元課程與活動，陪伴學員持續學習、維持活力。
                </div>
              </div>
              <MascotSticker variant="wave" className="h-20 w-20 sm:h-24 sm:w-24" />
            </div>
          </Card>

          <Card className="paper-edge rounded-4xl border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-black">本站功能</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge className="rounded-full" variant="secondary">
                    <CalendarDays className="mr-1 h-3.5 w-3.5" />
                    行事曆
                  </Badge>
                  <Badge className="rounded-full" variant="secondary">
                    <Camera className="mr-1 h-3.5 w-3.5" />
                    花絮
                  </Badge>
                  <Badge className="rounded-full" variant="secondary">
                    <BookOpen className="mr-1 h-3.5 w-3.5" />
                    心得
                  </Badge>
                </div>
              </div>
              <MascotSticker variant="camera" className="h-20 w-20 sm:h-24 sm:w-24" />
            </div>
          </Card>
        </div>
      </section>

      <Separator />

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-4xl border border-border bg-card p-6 shadow-sm">
          <div className="text-xl font-black">為什麼是「樂齡學習」？</div>
          <div className="mt-3 text-sm leading-7 text-muted-foreground">
            我們相信學習不受年齡限制。透過課程、互動、分享，讓身心保持活力，也讓日常更有期待。
            這裡會持續更新每月課程、活動照片與學員心得。
          </div>
        </div>

        <div className="rounded-4xl border border-border bg-secondary/50 p-6 shadow-sm">
          <div className="text-xl font-black">今天想看哪一區？</div>
          <div className="mt-3 text-sm leading-7 text-secondary-foreground/80">
            你可以先從「課程行事曆」開始安排，或到「活動花絮」看看大家的笑容。
            若想被感動一下，就去「成果心得」讀一段真實分享。
          </div>
        </div>
      </section>
    </div>
  );
}
