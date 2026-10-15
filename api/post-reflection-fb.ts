/**
 * 後台「同步到 FB」按鈕呼叫的 Vercel Function：把一則學員心得發佈到 Facebook 粉絲專頁。
 *
 * 驗證：必須帶登入者的 Supabase access token（Authorization: Bearer ...）。
 *       只有「總管理員」或「該心得所屬據點的帳號」可以發。
 * 環境變數與 api/sync-fb.ts 相同（SUPABASE_SERVICE_ROLE_KEY、FB_PAGE_ID、FB_PAGE_ACCESS_TOKEN、FB_GRAPH_VERSION、FB_DRY_RUN）。
 */

type Reflection = {
  id: string;
  title: string;
  content: string;
  quote: string | null;
  author: string | null;
  image_url: string | null;
  community_id: string | null;
  course_id: string | null;
  fb_post_id: string | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

function baseUrl() {
  const base = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  return { base: base.replace(/\/$/, ""), key };
}

function sb(path: string, init: RequestInit = {}) {
  const { base, key } = baseUrl();
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

async function getOne<T>(table: string, filter: string, select: string): Promise<T | null> {
  const res = await sb(`${table}?${filter}&select=${select}&limit=1`);
  if (!res.ok) throw new Error(`讀取 ${table} 失敗：${res.status} ${await res.text()}`);
  return (((await res.json()) as T[])[0] ?? null) as T | null;
}

// 以登入者的 token 向 Supabase Auth 查出使用者 id
async function userIdFromToken(token: string) {
  const { base, key } = baseUrl();
  const res = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return ((await res.json()) as { id?: string }).id ?? null;
}

// 2026-10-01 → 115/10/1（民國年）
function rocDate(iso: string) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[1]) - 1911}/${Number(m[2])}/${Number(m[3])}` : iso;
}

function buildMessage(r: Reflection, ev: { title: string; date: string; teacher: string | null } | null, site: string | null) {
  const lines: string[] = [`🌟 ${r.title}`, ""];
  if (ev?.date) lines.push(`📅日期：${rocDate(ev.date)}`);
  if (ev?.teacher) lines.push(`✏️講師：${ev.teacher}`);
  if (ev?.title) lines.push(`📖課程：${ev.title}`);
  if (site) lines.push(`📍據點：${site}`);
  lines.push("", "💬學員心得", r.content.trim());
  if (r.quote?.trim()) lines.push("", `✨${r.quote.trim()}`);
  if (r.author?.trim()) lines.push("", `—— ${r.author.trim()}`);
  return lines.join("\n");
}

async function postToFacebook(message: string, imageUrl: string | null) {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error("缺少 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN");
  const version = process.env.FB_GRAPH_VERSION || "v25.0";
  // 有大圖：發圖文貼文；沒有大圖：發純文字貼文
  const params: Record<string, string> = imageUrl
    ? { url: imageUrl, message, published: "true", access_token: token }
    : { message, access_token: token };
  const res = await fetch(`https://graph.facebook.com/${version}/${pageId}/${imageUrl ? "photos" : "feed"}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string; code?: number } };
  if (!res.ok || data.error) throw new Error(`Facebook 發文失敗：${data.error?.message ?? res.status}（code ${data.error?.code ?? "?"}）`);
  return data.post_id ?? data.id ?? "";
}

export async function POST(request: Request) {
  try {
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "請先登入後台" }, 401);
    const uid = await userIdFromToken(token);
    if (!uid) return json({ error: "登入已過期，請重新登入" }, 401);

    const { id, force } = (await request.json().catch(() => ({}))) as { id?: string; force?: boolean };
    if (!id) return json({ error: "缺少心得 id" }, 400);

    const profile = await getOne<{ role: string; community_id: string | null }>("profiles", `id=eq.${uid}`, "role,community_id");
    const r = await getOne<Reflection>(
      "reflections",
      `id=eq.${encodeURIComponent(id)}`,
      "id,title,content,quote,author,image_url,community_id,course_id,fb_post_id"
    );
    if (!r) return json({ error: "找不到這則心得" }, 404);

    const allowed = profile?.role === "admin" || (profile?.role === "community" && !!profile.community_id && profile.community_id === r.community_id);
    if (!allowed) return json({ error: "沒有權限同步這則心得" }, 403);
    if (r.fb_post_id && !force) return json({ error: "這則心得已經同步過了" }, 409);

    const [ev, site] = await Promise.all([
      r.course_id ? getOne<{ title: string; date: string; teacher: string | null }>("events", `id=eq.${r.course_id}`, "title,date,teacher") : null,
      r.community_id ? getOne<{ name: string }>("communities", `id=eq.${r.community_id}`, "name") : null,
    ]);
    const message = buildMessage(r, ev, site?.name ?? null);

    if (process.env.FB_DRY_RUN === "true") return json({ dryRun: true, message, image: r.image_url });

    const postId = await postToFacebook(message, r.image_url);
    const upd = await sb(`reflections?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ fb_post_id: postId || "posted", fb_posted_at: new Date().toISOString() }),
    });
    if (!upd.ok) console.error("[post-reflection-fb] 更新同步狀態失敗", await upd.text());
    return json({ ok: true, postId });
  } catch (err) {
    console.error("[post-reflection-fb]", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
}
