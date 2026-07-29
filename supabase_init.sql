-- ============================================================
-- 臺南市東山區樂齡學習中心 Supabase 初始化腳本
-- 可直接貼到 Supabase Dashboard → SQL Editor 執行
--
-- 架構：
-- 1. events       課程行事曆
-- 2. photos       活動花絮
-- 3. reflections  成果心得
-- 4. Storage bucket: senior-center-images
--
-- 重要安全提醒：
-- 本網站需求為「靜態網站 + /admin 固定密碼」，沒有伺服器端 session。
-- 因此前端若要直接 CRUD Supabase，RLS 需允許 anon key 寫入。
-- 這符合簡易部署需求，但不等同高安全後台。
-- 若未來要更嚴格權限，建議改用 Supabase Auth + authenticated policies
-- 或 Vercel Serverless / Supabase Edge Functions 保護寫入 API。
-- ============================================================

create extension if not exists pgcrypto;

-- ----------------------------
-- updated_at trigger function
-- ----------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ----------------------------
-- events：課程行事曆
-- ----------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  location text,
  content text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists events_date_idx on public.events(date);

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- ----------------------------
-- photos：活動花絮
-- ----------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists photos_created_at_idx on public.photos(created_at desc);

-- ----------------------------
-- reflections：成果心得
-- ----------------------------
create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  quote text,
  author text,
  image_url text,
  tags text[] not null default '{}',
  school_year text,
  location text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 若資料表已存在（舊版本），補上學年度與地點欄位
alter table public.reflections add column if not exists school_year text;
alter table public.reflections add column if not exists location text;

create index if not exists reflections_created_at_idx on public.reflections(created_at desc);
create index if not exists reflections_tags_idx on public.reflections using gin(tags);
create index if not exists reflections_school_year_idx on public.reflections(school_year);
create index if not exists reflections_location_idx on public.reflections(location);

drop trigger if exists trg_reflections_updated_at on public.reflections;
create trigger trg_reflections_updated_at
before update on public.reflections
for each row execute function public.set_updated_at();

-- ----------------------------
-- Grants for PostgREST API
-- ----------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.events to anon, authenticated;
grant select, insert, update, delete on public.photos to anon, authenticated;
grant select, insert, update, delete on public.reflections to anon, authenticated;

-- ----------------------------
-- RLS policies
-- 靜態網站固定密碼方案：允許 anon select/insert/update/delete
-- ----------------------------
alter table public.events enable row level security;
alter table public.photos enable row level security;
alter table public.reflections enable row level security;

drop policy if exists "events_select_public" on public.events;
create policy "events_select_public"
on public.events for select
to anon, authenticated
using (true);

drop policy if exists "events_insert_public_admin" on public.events;
create policy "events_insert_public_admin"
on public.events for insert
to anon, authenticated
with check (true);

drop policy if exists "events_update_public_admin" on public.events;
create policy "events_update_public_admin"
on public.events for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "events_delete_public_admin" on public.events;
create policy "events_delete_public_admin"
on public.events for delete
to anon, authenticated
using (true);


drop policy if exists "photos_select_public" on public.photos;
create policy "photos_select_public"
on public.photos for select
to anon, authenticated
using (true);

drop policy if exists "photos_insert_public_admin" on public.photos;
create policy "photos_insert_public_admin"
on public.photos for insert
to anon, authenticated
with check (true);

drop policy if exists "photos_update_public_admin" on public.photos;
create policy "photos_update_public_admin"
on public.photos for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "photos_delete_public_admin" on public.photos;
create policy "photos_delete_public_admin"
on public.photos for delete
to anon, authenticated
using (true);


drop policy if exists "reflections_select_public" on public.reflections;
create policy "reflections_select_public"
on public.reflections for select
to anon, authenticated
using (true);

drop policy if exists "reflections_insert_public_admin" on public.reflections;
create policy "reflections_insert_public_admin"
on public.reflections for insert
to anon, authenticated
with check (true);

drop policy if exists "reflections_update_public_admin" on public.reflections;
create policy "reflections_update_public_admin"
on public.reflections for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "reflections_delete_public_admin" on public.reflections;
create policy "reflections_delete_public_admin"
on public.reflections for delete
to anon, authenticated
using (true);

-- ----------------------------
-- Supabase Storage Bucket
-- 圖片統一存儲於 senior-center-images
-- ----------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'senior-center-images',
  'senior-center-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Storage object policies
-- 允許公開讀取；允許 anon/authenticated 上傳、更新、刪除 bucket 內圖片。

drop policy if exists "senior_images_select_public" on storage.objects;
create policy "senior_images_select_public"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'senior-center-images');

drop policy if exists "senior_images_insert_public_admin" on storage.objects;
create policy "senior_images_insert_public_admin"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'senior-center-images'
  and (storage.foldername(name))[1] in ('photos', 'reflections')
);

drop policy if exists "senior_images_update_public_admin" on storage.objects;
create policy "senior_images_update_public_admin"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'senior-center-images')
with check (bucket_id = 'senior-center-images');

drop policy if exists "senior_images_delete_public_admin" on storage.objects;
create policy "senior_images_delete_public_admin"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'senior-center-images');

-- ----------------------------
-- Optional seed data（可保留；若不需要示範資料，可刪除以下 insert）
-- ----------------------------
insert into public.events (title, date, location, content)
values
  ('體適能：伸展與平衡', current_date + interval '1 day', '青山國小活動教室', '暖身、伸展與平衡訓練，請穿著舒適運動鞋。'),
  ('手作：花草小盆栽', current_date + interval '4 day', '青山國小自然教室', '材料由中心準備，也歡迎自帶喜歡的小植栽。')
on conflict do nothing;

insert into public.reflections (title, content, quote, author, image_url, tags, school_year, location)
values
  (
    '原來我也做得到',
    '以前總覺得學新東西很難，但老師一步一步帶著我們做，跟同學一起笑、一起完成，心情就亮起來了。',
    '慢慢來沒關係，只要願意開始，就已經很棒了。',
    '學員｜陳○○',
    null,
    array['114學年度', '青山社區活動中心'],
    '114學年度',
    '青山社區活動中心'
  )
on conflict do nothing;
