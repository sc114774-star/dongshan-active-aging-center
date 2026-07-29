import { MapPin, Phone, School } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/70">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 md:grid-cols-2 md:px-6">
        <div>
          <div className="text-lg font-black">臺南市東山區樂齡學習中心</div>
          <div className="mt-2 text-sm text-muted-foreground">
            由臺南市東山區青山國民小學（Tainan Municipal Dongshan District Cingshan Elementary School）
            負責。
          </div>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" />
              <span>733 臺南市東山區青山里16號</span>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-primary" />
              <span>
                電話：(06)6861041 傳真：(06)6860045
              </span>
            </div>
            <div className="flex items-start gap-2">
              <School className="mt-0.5 h-4 w-4 text-primary" />
              <span>承辦單位：青山國民小學</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="text-sm font-bold">小提醒</div>
          <div className="mt-2 text-sm text-muted-foreground">
            本站資料由管理後台維護。若你是學員或家屬，歡迎常來看看最新課程與花絮！
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} 臺南市東山區樂齡學習中心
          </div>
        </div>
      </div>
    </footer>
  );
}
