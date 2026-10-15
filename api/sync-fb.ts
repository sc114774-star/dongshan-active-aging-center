/**
 * Supabase Database Webhook → Facebook 粉絲專頁自動發文
 *
 * 觸發：photos 資料表「新增一筆已公開的照片」，或「照片由未公開變成公開」。
 * 動作：用照片網址 + 課程資訊（日期 / 講師 / 課程）發一則圖文貼文到粉絲專頁。
 *
 * 需要的環境變數（Vercel → Settings → Environment Variables）：
 *   WEBHOOK_SECRET             自訂一串長亂數，要和 Supabase Webhook 的 x-webhook-secret 標頭相同
 *   SUPABASE_SERVICE_ROLE_KEY  Supabase service_role 金鑰（只能放在這裡，千萬不要加 VITE_ 前綴）
 *   FB_PAGE_ID                 粉絲專頁 ID
 *   FB_PAGE_ACCESS_TOKEN       粉絲專頁的長期存取權杖（需有 pages_manage_posts 權限）
 * 選填：
 *   SUPABASE_URL               預設沿用 VITE_SUPABASE_URL
 *   FB_GRAPH_VERSION           預設 v25.0
 *   FB_POST_MODE               per_course（預設，同一堂課只發第一張）｜ per_photo（每張照片各發一則）
 *   FB_DRY_RUN                 設為 true 時只回傳「會發的內容」，不真的發文（測試用）
 */
import { timingSafeEqual } from "node:crypto";

type PhotoRow = {
  id: string;
  image_url: string | null;
  caption: string | null;
  community_id: string | null;
  event_id: string | null;
  is_approved: boolean | null;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: PhotoRow | null;
  old_record: Partial<PhotoRow> | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------- Supabase REST（用 service_role，不需要額外套件） ----------
function sb(path: string, init: RequestInit = {}) {
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  return fetch(`${base.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

async function getOne<T>(table: string, id: string | null, select: string): Promise<T | null> {
  if (!id) return null;
  const res = await sb(`${table}?id=eq.${encodeURIComponent(id)}&select=${select}&limit=1`);
  if (!res.ok) throw new Error(`讀取 ${table} 失敗：${res.status} ${await res.text()}`);
  const rows = (await res.json()) as T[];
  return rows[0] ?? null;
}

// 用唯一鍵「搶佔」：只有第一個成功寫入的請求能發文，避免同時上傳多張照片或 Webhook 重送造成重複貼文
async function claim(dedupeKey: string, photoId: string, eventId: string | null) {
  const res = await sb("fb_post_log?on_conflict=dedupe_key", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ dedupe_key: dedupeKey, photo_id: photoId, event_id: eventId }),
  });
  if (!res.ok) throw new Error(`寫入 fb_post_log 失敗：${res.status} ${await res.text()}`);
  const rows = (await res.json()) as unknown[];
  return rows.length > 0;
}

async function release(dedupeKey: string) {
  await sb(`fb_post_log?dedupe_key=eq.${encodeURIComponent(dedupeKey)}`, { method: "DELETE" }).catch(() => undefined);
}

async function markPosted(dedupeKey: string, fbPostId: string) {
  await sb(`fb_post_log?dedupe_key=eq.${encodeURIComponent(dedupeKey)}`, {
    method: "PATCH",
    body: JSON.stringify({ fb_post_id: fbPostId, status: "posted" }),
  }).catch(() => undefined);
}

// ---------- 貼文內容 ----------
// 2026-10-01 → 115/10/1（民國年）
function rocDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[1]) - 1911}/${Number(m[2])}/${Number(m[3])}`;
}

function buildMessage(input: { date?: string | null; teacher?: string | null; title?: string | null; site?: string | null; caption?: string | null }) {
  const lines: string[] = [];
  if (input.date) lines.push(`📅日期：${rocDate(input.date)}`);
  if (input.teacher) lines.push(`✏️講師：${input.teacher}`);
  if (input.title) lines.push(`📖課程：${input.title}`);
  if (input.site) lines.push(`📍據點：${input.site}`); // 不想顯示據點，刪掉這一行即可
  if (lines.length === 0 && input.caption) lines.push(input.caption); // 沒有課程資料時，退而使用照片說明
  return lines.join("\n");
}

// ---------- Facebook ----------
async function postPhotoToFacebook(imageUrl: string, message: string) {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error("缺少 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN");
  const version = process.env.FB_GRAPH_VERSION || "v25.0";
  const body = new URLSearchParams({ url: imageUrl, message, published: "true", access_token: token });
  const res = await fetch(`https://graph.facebook.com/${version}/${pageId}/photos`, { method: "POST", body });
  const data = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string; code?: number } };
  if (!res.ok || data.error) throw new Error(`Facebook 發文失敗：${data.error?.message ?? res.status}（code ${data.error?.code ?? "?"}）`);
  return data.post_id ?? data.id ?? "";
}

// ---------- 入口 ----------
export async function POST(request: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return json({ error: "伺服器未設定 WEBHOOK_SECRET" }, 500);
  if (!safeEqual(request.headers.get("x-webhook-secret") ?? "", secret)) return json({ error: "unauthorized" }, 401);

  let payload: WebhookPayload;
  try {
    payload = (await request.json()) as WebhookPayload;
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const row = payload.record;
  if (payload.table !== "photos" || !row) return json({ skipped: "not a photos event" });

  // 只處理「新增且已公開」或「剛從未公開變成公開」
  const becamePublic = payload.type === "UPDATE" && row.is_approved === true && payload.old_record?.is_approved !== true;
  const newPublic = payload.type === "INSERT" && row.is_approved === true;
  if (!becamePublic && !newPublic) return json({ skipped: "not a newly public photo" });
  if (!row.image_url) return json({ skipped: "no image_url" });

  const perCourse = (process.env.FB_POST_MODE || "per_course") !== "per_photo";
  const dedupeKey = perCourse && row.event_id ? `event:${row.event_id}` : `photo:${row.id}`;

  try {
    const [event, site] = await Promise.all([
      getOne<{ title: string; date: string; teacher: string | null }>("events", row.event_id, "title,date,teacher"),
      getOne<{ name: string }>("communities", row.community_id, "name"),
    ]);
    const message = buildMessage({ date: event?.date, teacher: event?.teacher, title: event?.title, site: site?.name, caption: row.caption });

    if (process.env.FB_DRY_RUN === "true") return json({ dryRun: true, image: row.image_url, message, dedupeKey });

    if (!(await claim(dedupeKey, row.id, row.event_id))) return json({ skipped: "already posted for this course/photo", dedupeKey });

    try {
      const postId = await postPhotoToFacebook(row.image_url, message);
      await markPosted(dedupeKey, postId);
      return json({ ok: true, postId });
    } catch (err) {
      await release(dedupeKey); // 發文失敗就釋放，之後重送 / 重新核准時可再試
      throw err;
    }
  } catch (err) {
    console.error("[sync-fb]", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
}

// 瀏覽器直接開網址時的健康檢查（不洩漏任何設定）
export function GET() {
  return json({ ok: true, service: "sync-fb" });
}
