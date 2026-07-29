import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";

export function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export function monthRange(date: Date, weekStartsOn: 0 | 1 = 1) {
  const start = startOfWeek(startOfMonth(date), { weekStartsOn });
  // ensure 6 rows (42 cells)
  const end = addDays(start, 41);
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  return { start, end, monthStart, monthEnd };
}

export function clampToMonth(date: Date, month: Date) {
  const ms = startOfMonth(month);
  const me = endOfMonth(month);
  if (date < ms) return ms;
  if (date > me) return me;
  return date;
}

export function humanDate(isoYmd: string) {
  // isoYmd: YYYY-MM-DD
  const [y, m, d] = isoYmd.split("-").map((s) => Number(s));
  if (!y || !m || !d) return isoYmd;
  return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}

export function isProbablyAcademicYearTag(tag: string) {
  return /學年度/.test(tag) || /^\d{3}學年度$/.test(tag);
}
