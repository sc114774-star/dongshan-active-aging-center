// 課表匯入：支援 .odt（LibreOffice 文件）、.xlsx、.csv / .tsv。
// 不依賴任何額外套件：.odt 與 .xlsx 本質上是 zip，這裡用瀏覽器內建的解壓縮功能讀取。

export type ParsedCourse = {
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // 例如 08:00-12:00（沒有則空字串）
  location: string;
  teacher: string;
  fee: string;
  note: string;
};

export type ParseResult = { courses: ParsedCourse[]; skipped: string[]; detectedYear: number | null };

// ---------- zip 讀取 ----------
async function readZipText(buf: ArrayBuffer, wanted: string[]): Promise<Record<string, string>> {
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("檔案格式不正確（不是有效的 odt / xlsx）");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOff = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.slice(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted.includes(name)) continue;
    const lhNameLen = view.getUint16(localOff + 26, true);
    const lhExtraLen = view.getUint16(localOff + 28, true);
    const start = localOff + 30 + lhNameLen + lhExtraLen;
    const data = bytes.slice(start, start + compSize);
    let raw: Uint8Array;
    if (method === 0) raw = data;
    else if (method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      raw = new Uint8Array(await new Response(stream).arrayBuffer());
    } else throw new Error("不支援的壓縮格式");
    out[name] = new TextDecoder("utf-8").decode(raw);
  }
  return out;
}

// ---------- 各格式 → 二維表格 ----------
function parseOdt(xml: string): { rows: string[][]; fullText: string } {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const fullText = doc.documentElement.textContent ?? "";
  const table = doc.getElementsByTagName("table:table")[0];
  if (!table) throw new Error("文件中找不到表格");
  const rows: string[][] = [];
  for (const tr of Array.from(table.getElementsByTagName("table:table-row"))) {
    const row: string[] = [];
    for (const cell of Array.from(tr.children)) {
      if (cell.tagName !== "table:table-cell" && cell.tagName !== "table:covered-table-cell") continue;
      const text = Array.from(cell.getElementsByTagName("text:p")).map((x) => x.textContent ?? "").join("\n").trim();
      const repeat = Math.min(Number(cell.getAttribute("table:number-columns-repeated") ?? "1"), 12);
      for (let i = 0; i < repeat; i++) row.push(text);
    }
    rows.push(row);
  }
  return { rows, fullText };
}

function colIndex(ref: string) {
  let n = 0;
  for (const ch of ref.replace(/[0-9]/g, "")) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function parseXlsx(files: Record<string, string>): string[][] {
  const shared: string[] = [];
  if (files["xl/sharedStrings.xml"]) {
    const d = new DOMParser().parseFromString(files["xl/sharedStrings.xml"], "application/xml");
    for (const si of Array.from(d.getElementsByTagName("si"))) shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
  }
  const sheet = new DOMParser().parseFromString(files["xl/worksheets/sheet1.xml"] ?? "", "application/xml");
  const rows: string[][] = [];
  for (const r of Array.from(sheet.getElementsByTagName("row"))) {
    const row: string[] = [];
    for (const c of Array.from(r.getElementsByTagName("c"))) {
      const idx = colIndex(c.getAttribute("r") ?? "A1");
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      row[idx] = t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? c.getElementsByTagName("t")[0]?.textContent ?? "" : v;
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return rows;
}

function parseDelimited(text: string): string[][] {
  const delim = text.split("\n", 1)[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const t = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ---------- 欄位辨識 ----------
function pad(n: number | string) { return String(n).padStart(2, "0"); }
function hm(h: string, m?: string) { return `${pad(h)}:${m ?? "00"}`; }

function parseTime(s: string): string {
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*[-~–—至到]\s*(\d{1,2})(?::(\d{2}))?/);
  return m ? `${hm(m[1], m[2])}-${hm(m[3], m[4])}` : "";
}

function parseDate(raw: string, defaultYear: number): string | null {
  const s = raw.replace(/\s+/g, " ").trim();
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000); // Excel 序號
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  let m = s.match(/(\d{2,4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
  if (m) {
    let y = Number(m[1]);
    if (y < 1000) y += 1911; // 民國年
    return `${y}-${pad(m[2])}-${pad(m[3])}`;
  }
  m = s.match(/(\d{1,2})\s*[\/月]\s*(\d{1,2})/);
  if (m) return `${defaultYear}-${pad(m[1])}-${pad(m[2])}`;
  return null;
}

const HEADERS: Record<string, RegExp> = {
  title: /活動名稱|課程名稱|課程|名稱/,
  date: /日期/,
  location: /地點|據點/,
  teacher: /講師|老師|授課/,
  fee: /費用|報名/,
  note: /備註/,
};

export async function parseScheduleFile(file: File, defaultYear?: number): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  let rows: string[][];
  let fullText = "";
  if (name.endsWith(".odt")) {
    const files = await readZipText(await file.arrayBuffer(), ["content.xml"]);
    ({ rows, fullText } = parseOdt(files["content.xml"] ?? ""));
  } else if (name.endsWith(".xlsx")) {
    const files = await readZipText(await file.arrayBuffer(), ["xl/sharedStrings.xml", "xl/worksheets/sheet1.xml"]);
    rows = parseXlsx(files);
  } else if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    rows = parseDelimited(await file.text());
  } else {
    throw new Error("目前支援 .odt、.xlsx、.csv 檔案（Word 的 .docx 請先另存成 .odt 或 .xlsx / .csv）");
  }

  const headerIdx = rows.findIndex((r) => r.some((c) => HEADERS.title.test(c)) && r.some((c) => HEADERS.date.test(c)));
  if (headerIdx < 0) throw new Error("找不到標題列（需要有「活動名稱」與「日期」欄位）");
  const header = rows[headerIdx];
  const col = (key: keyof typeof HEADERS) => header.findIndex((c) => HEADERS[key].test(c));
  const idx = { title: col("title"), date: col("date"), location: col("location"), teacher: col("teacher"), fee: col("fee"), note: col("note") };

  const rocYear = fullText.match(/(\d{2,3})\s*年/);
  const detectedYear = rocYear ? Number(rocYear[1]) + 1911 : null;
  const year = defaultYear ?? detectedYear ?? new Date().getFullYear();

  const courses: ParsedCourse[] = [];
  const skipped: string[] = [];
  for (const r of rows.slice(headerIdx + 1)) {
    const get = (i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
    const title = get(idx.title);
    const dateCell = get(idx.date);
    if (!title && !dateCell) continue;
    const date = parseDate(dateCell, year);
    if (!title || !date) {
      skipped.push(r.filter(Boolean).join(" | "));
      continue;
    }
    const noteCell = get(idx.note);
    const fee = get(idx.fee);
    courses.push({
      title,
      date,
      time: parseTime(dateCell.replace(/(\d{2,4})\s*[\/\-.年]\s*\d{1,2}\s*[\/\-.月]\s*\d{1,2}/, "").replace(/\d{1,2}\s*[\/月]\s*\d{1,2}/, "")),
      location: get(idx.location),
      teacher: get(idx.teacher),
      fee: /^(無|免|免費|免報名費)/.test(fee) ? "" : fee,
      note: noteCell,
    });
  }
  return { courses, skipped, detectedYear };
}

// 把「青山國小」「東山關懷」「青山社區活動中心」對應到系統中的據點
export function matchSite<T extends { id: string; name: string }>(location: string, sites: T[]): T | null {
  const loc = location.replace(/\s+/g, "").replace(/活動中心$/, "");
  if (!loc) return null;
  const exact = sites.find((s) => s.name === loc);
  if (exact) return exact;
  const loose = sites.filter((s) => s.name.includes(loc) || loc.includes(s.name));
  return loose.length === 1 ? loose[0] : null;
}
