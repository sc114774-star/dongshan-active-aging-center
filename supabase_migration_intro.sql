-- ============================================================
-- 「介紹」分頁：據點介紹圖片
-- 請在 Supabase → SQL Editor 貼上執行一次
-- community_id 為空 = 中心總覽圖片；有值 = 該社區據點圖片
-- ============================================================
create table if not exists public.site_intro_images (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete cascade,
  image_url text not null,
  caption text,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists site_intro_images_community_idx on public.site_intro_images(community_id);

alter table public.site_intro_images enable row level security;
grant select on public.site_intro_images to anon, authenticated;
grant insert, update, delete on public.site_intro_images to authenticated;

drop policy if exists site_intro_select_public on public.site_intro_images;
create policy site_intro_select_public on public.site_intro_images
for select to anon, authenticated using (true);

drop policy if exists site_intro_admin_write on public.site_intro_images;
create policy site_intro_admin_write on public.site_intro_images
for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Storage：只有總管理員可以把圖片上傳到 intro 資料夾
drop policy if exists senior_images_insert_intro_admin on storage.objects;
create policy senior_images_insert_intro_admin on storage.objects
for insert to authenticated
with check (
  bucket_id = 'senior-center-images'
  and (storage.foldername(name))[1] = 'intro'
  and public.is_admin()
);
