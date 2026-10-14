// Supabase 回傳的錯誤是一般物件（不是 Error），直接判斷會讀不到訊息，這裡統一取出可讀的錯誤文字
export function errMsg(err: unknown, fallback = "操作失敗") {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    if (parts.length) return parts.join("｜") + (e.code ? `（${e.code}）` : "");
  }
  return fallback;
}
