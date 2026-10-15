-- 心得「同步到 FB」：記錄是否已發佈（可重複執行）
alter table public.reflections add column if not exists fb_post_id text;
alter table public.reflections add column if not exists fb_posted_at timestamptz;
