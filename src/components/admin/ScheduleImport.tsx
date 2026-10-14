import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { createEvents } from "@/lib/adminDb";
import { listAllCourses } from "@/lib/db";
import { matchSite, parseScheduleFile } from "@/lib/scheduleImport";
import type { ParsedCourse } from "@/lib/scheduleImport";

const SKIP = "skip";

// 總管理員專用：上傳課程活動表（.odt / .xlsx / .csv），預覽後一次匯入
export default function ScheduleImport({ onDone }: { onDone: () => void }) {
  const { communities } = useAuth();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [courses, setCourses] = useState<ParsedCourse[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [siteMap, setSiteMap] = useState<Record<string, string>>({}); // 原始地點文字 → 據點 id
  const [off, setOff] = useState<Set<number>>(new Set());
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const siteOf = (c: ParsedCourse) => siteMap[c.location] ?? SKIP;
  const key = (title: string, date: string, cid: string) => `${title}|${date}|${cid}`;
  const locations = useMemo(() => Array.from(new Set(courses.map((c) => c.location))), [courses]);

  async function parse(f: File, y: number | undefined) {
    setBusy(true);
    try {
      const res = await parseScheduleFile(f, y);
      if (y === undefined && res.detectedYear) setYear(String(res.detectedYear));
      const map: Record<string, string> = {};
      for (const loc of new Set(res.courses.map((c) => c.location))) map[loc] = matchSite(loc, communities)?.id ?? SKIP;
      const rows = await listAllCourses();
      setExisting(new Set(rows.map((r) => key(r.title, r.date, r.community_id ?? ""))));
      setCourses(res.courses);
      setSkipped(res.skipped);
      setSiteMap(map);
      setOff(new Set());
    } catch (err) {
      setCourses([]);
      toast.error(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setBusy(false);
    }
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    parse(f, undefined);
  }

  const rows = courses.map((c, i) => {
    const sid = siteOf(c);
    const dup = sid !== SKIP && existing.has(key(c.title, c.date, sid));
    return { c, i, sid, dup, selected: sid !== SKIP && !dup && !off.has(i) };
  });
  const importCount = rows.filter((r) => r.selected).length;

  async function doImport() {
    const payload = rows
      .filter((r) => r.selected)
      .map(({ c, sid }) => ({
        title: c.title,
        date: c.date,
        location: c.location || null,
        teacher: c.teacher || null,
        community_id: sid,
        content: [c.time && `上課時間：${c.time}`, c.fee && `報名費用：${c.fee}`, c.note].filter(Boolean).join("\n") || null,
      }));
    if (payload.length === 0) return toast.error("沒有可匯入的課程");
    setBusy(true);
    try {
      await createEvents(payload);
      toast.success(`已匯入 ${payload.length} 筆課程`);
      setOpen(false);
      setCourses([]);
      setFile(null);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "匯入失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" className="rounded-full font-bold" onClick={() => setOpen(true)}>
        <FileUp className="mr-2 h-4 w-4" />匯入課表檔案
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-4xl">
          <DialogHeader>
            <DialogTitle>匯入課程活動表</DialogTitle>
            <DialogDescription>支援 .odt、.xlsx、.csv。表格需有「活動名稱、日期、地點、講師」欄位，日期可寫成 6/1 08-12。</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm">
              <FileUp className="mr-2 h-4 w-4" />選擇檔案
              <input className="hidden" type="file" accept=".odt,.xlsx,.csv,.tsv,.txt" onChange={onPick} />
            </label>
            <span className="text-sm text-muted-foreground">{file?.name ?? "尚未選擇檔案"}</span>
            {courses.length > 0 && (
              <div className="ml-auto flex items-center gap-2 text-sm">
                <span className="font-bold">年份</span>
                <Input className="w-24" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} onBlur={() => file && /^\d{4}$/.test(year) && parse(file, Number(year))} />
              </div>
            )}
            {busy && <Loader2 className="h-5 w-5 animate-spin" />}
          </div>

          {courses.length > 0 && (
            <>
              <div className="rounded-3xl border border-border bg-secondary/25 p-4">
                <div className="mb-2 text-sm font-black">確認地點對應的據點（沒對應到的請自行選擇；選「不匯入」會略過該地點的課程）</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {locations.map((loc) => (
                    <div key={loc} className="flex items-center gap-2">
                      <div className="w-28 shrink-0 text-sm font-bold">{loc || "（未填地點）"}</div>
                      <Select value={siteMap[loc] ?? SKIP} onValueChange={(v) => setSiteMap({ ...siteMap, [loc]: v })}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP}>不匯入</SelectItem>
                          {communities.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/40 text-xs">
                    <tr>
                      <th className="p-2">匯入</th><th className="p-2">日期</th><th className="p-2">時間</th><th className="p-2">課程</th><th className="p-2">講師</th><th className="p-2">據點</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.i} className={r.selected ? "" : "text-muted-foreground"}>
                        <td className="p-2">
                          <Checkbox
                            checked={r.selected}
                            disabled={r.sid === SKIP || r.dup}
                            onCheckedChange={(v) => {
                              const n = new Set(off);
                              if (v) n.delete(r.i); else n.add(r.i);
                              setOff(n);
                            }}
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">{r.c.date}</td>
                        <td className="p-2 whitespace-nowrap">{r.c.time || "—"}</td>
                        <td className="p-2 font-bold">{r.c.title}</td>
                        <td className="p-2">{r.c.teacher || "—"}</td>
                        <td className="p-2 whitespace-nowrap">{r.sid === SKIP ? "未對應（略過）" : r.dup ? "已存在（略過）" : communities.find((c) => c.id === r.sid)?.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {skipped.length > 0 && <div className="text-xs text-muted-foreground">讀不懂而略過的列：{skipped.join("；")}</div>}
              <Button className="h-12 rounded-full text-base font-black" disabled={busy || importCount === 0} onClick={doImport}>
                匯入 {importCount} 筆課程
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
