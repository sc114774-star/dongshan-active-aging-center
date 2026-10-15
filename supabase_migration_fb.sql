-- ============================================================
-- Facebook 自動發文：防重複紀錄表 + Webhook 觸發器
-- 請在 Supabase → SQL Editor 執行（可重複執行）
-- ============================================================

-- 1) 發文紀錄（同時當作防重複鎖）。只有 service_role（Vercel Function）能讀寫
create table if not exists public.fb_post_log (
  dedupe_key text primary key,          -- event:<課程id> 或 photo:<照片id>
  photo_id uuid,
  event_id uuid,
  fb_post_id text,
  status text not null default 'claimed',
  created_at timestamptz not null default timezone('utc', now())
);
alter table public.fb_post_log enable row level security;
revoke all on public.fb_post_log from anon, authenticated;

-- 2) Webhook 觸發器（等同於在 Dashboard → Database → Webhooks 手動建立）
--    ★ 執行前請把兩處 CHANGE_ME 換成 Vercel 上 WEBHOOK_SECRET 的同一串值
--    ★ 若網址不是 dongshan-active-aging-center.vercel.app，請一併修改
--    需要先在 Dashboard → Database → Webhooks 按「Enable webhooks」一次，supabase_functions.http_request 才會存在
drop trigger if exists sync_fb_on_photo_insert on public.photos;
create trigger sync_fb_on_photo_insert
after insert on public.photos
for each row
when (new.is_approved is true)
execute function supabase_functions.http_request(
  'https://dongshan-active-aging-center.vercel.app/api/sync-fb', 'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"CHANGE_ME"}', '{}', '5000');

drop trigger if exists sync_fb_on_photo_approved on public.photos;
create trigger sync_fb_on_photo_approved
after update on public.photos
for each row
when (old.is_approved is distinct from new.is_approved and new.is_approved is true)
execute function supabase_functions.http_request(
  'https://dongshan-active-aging-center.vercel.app/api/sync-fb', 'POST',
  '{"Content-Type":"application/json","x-webhook-secret":"CHANGE_ME"}', '{}', '5000');
