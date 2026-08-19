-- ============================================================
-- 樂齡網站 v2：社區帳號 + RBAC + 資料隔離 遷移腳本
-- 請在 supabase_init.sql 執行「之後」，於 Supabase SQL Editor 執行本檔
-- 可重複執行（皆用 if not exists / drop policy if exists）
--
-- 架構總覽：
-- 1. communities  社區清單（不含管理員）
-- 2. profiles     對應 auth.users，記錄 role（admin / community）與所屬社區
-- 3. events / photos / reflections 新增 community_id 做資料隔離
-- 4. reflections  移除 school_year / location，改用 community_id + course_id
-- 5. announcements（活動公告）、qna（Q&A）、about_page（認識中心）
-- 6. 所有寫入類 RLS 政策改為「必須登入 + 角色/社區比對」
--
-- 登入機制說明：
-- 前端「選擇社區」下拉選單其實對應每個社區在 communities.login_email
-- 的一組『內部帳號』，實際仍是標準 Supabase Auth（email+password）。
-- 使用者選社區 → 前端查出 login_email → supabase.auth.signInWithPassword()
-- 管理員則走固定的「管理員登入」選項（不在 communities 清單內）。
-- ============================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------
-- 1. communities：社區清單（管理員不算在內）
-- ----------------------------------------------------------
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- 顯示名稱，例如「青山社區」
  slug text not null unique,          -- 英數代碼，例如 qingshan
  login_email text not null unique,   -- 對應 Supabase Auth 帳號 email
  display_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.communities (name, slug, login_email, display_order) values
  ('青山社區', 'qingshan', 'qingshan@member.dongshan-leling.tw', 1),
  ('高原社區', 'gaoyuan',  'gaoyuan@member.dongshan-leling.tw', 2),
  ('東原社區', 'dongyuan', 'dongyuan@member.dongshan-leling.tw', 3),
  ('嶺南社區', 'lingnan',  'lingnan@member.dongshan-leling.tw', 4),
  ('東山社區', 'dongshan', 'dongshan@member.dongshan-leling.tw', 5),
  ('頂窩社區', 'dingwo',   'dingwo@member.dongshan-leling.tw', 6),
  ('南勢社區', 'nanshi',   'nanshi@member.dongshan-leling.tw', 7)
on conflict (slug) do nothing;

-- ----------------------------------------------------------
-- 2. profiles：對應 auth.users，記錄角色與所屬社區
--    注意：這裡「不」用 trigger 自動塞入完整資料，
--    因為新帳號一開始並不知道要對到哪個社區 / 是否為 admin，
--    請在 Supabase Dashboard 建立帳號後，手動執行本檔最下方的
--    UPDATE 範例，把 role / community_id 設定正確。
-- ----------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'community' check (role in ('admin', 'community')),
  community_id uuid references public.communities(id),
  display_name text,
  created_at timestamptz not null default timezone('utc', now())
);

-- 新使用者註冊時，自動建立一筆空白 profile（role 預設 community，
-- community_id 先留空，需管理員手動指定）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, community_id)
  values (new.id, 'community', null)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------
-- Helper functions（RLS 共用，用 security definer 避免遞迴查詢卡住）
-- ----------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_community_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select community_id from public.profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------
-- 3. events（課程）：加上 community_id 做歸屬
-- ----------------------------------------------------------
alter table public.events add column if not exists community_id uuid references public.communities(id);
create index if not exists events_community_id_idx on public.events(community_id);
create index if not exists events_community_month_idx on public.events(community_id, date);

-- ----------------------------------------------------------
-- 4. photos（花絮）：加上 community_id
-- ----------------------------------------------------------
alter table public.photos add column if not exists community_id uuid references public.communities(id);
create index if not exists photos_community_id_idx on public.photos(community_id);

-- ----------------------------------------------------------
-- 5. reflections（成果心得）：移除學年度／地點，改用 community_id + course_id
-- ----------------------------------------------------------
drop index if exists reflections_school_year_idx;
drop index if exists reflections_location_idx;
alter table public.reflections drop column if exists school_year;
alter table public.reflections drop column if exists location;

alter table public.reflections add column if not exists community_id uuid references public.communities(id);
alter table public.reflections add column if not exists course_id uuid references public.events(id) on delete set null;

create index if not exists reflections_community_id_idx on public.reflections(community_id);
create index if not exists reflections_course_id_idx on public.reflections(course_id);

-- ----------------------------------------------------------
-- 6. announcements（活動公告）— 僅管理員可寫，前台公開閱讀
-- ----------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_published boolean not null default true,
  published_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists announcements_published_at_idx on public.announcements(published_at desc);

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- 7. qna（Q&A）— 僅管理員可寫，前台公開閱讀
-- ----------------------------------------------------------
create table if not exists public.qna (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_qna_updated_at on public.qna;
create trigger trg_qna_updated_at
before update on public.qna
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- 8. about_page（認識中心）— 單筆內容，僅管理員可編輯
-- ----------------------------------------------------------
create table if not exists public.about_page (
  id int primary key default 1,
  title text not null default '認識中心',
  content text not null default '',
  updated_at timestamptz not null default timezone('utc', now()),
  constraint about_page_singleton check (id = 1)
);
insert into public.about_page (id, title, content)
values (1, '認識中心', '請在後台「認識中心分頁」填寫介紹內容。')
on conflict (id) do nothing;

drop trigger if exists trg_about_page_updated_at on public.about_page;
create trigger trg_about_page_updated_at
before update on public.about_page
for each row execute function public.set_updated_at();

-- ============================================================
-- Grants（PostgREST 需要先有 grant，RLS 才會真正生效地限制細節）
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select on public.communities to anon, authenticated;
grant all on public.communities to authenticated;

grant select on public.profiles to authenticated;
grant all on public.profiles to authenticated;

grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

grant select on public.photos to anon, authenticated;
grant insert, update, delete on public.photos to authenticated;

grant select on public.reflections to anon, authenticated;
grant insert, update, delete on public.reflections to authenticated;

grant select on public.announcements to anon, authenticated;
grant all on public.announcements to authenticated;

grant select on public.qna to anon, authenticated;
grant all on public.qna to authenticated;

grant select on public.about_page to anon, authenticated;
grant all on public.about_page to authenticated;

-- ============================================================
-- RLS 全面改寫：不再允許 anon 寫入，一律要求登入 + 角色/社區比對
-- ============================================================

-- ---------- communities ----------
alter table public.communities enable row level security;

drop policy if exists communities_select_public on public.communities;
create policy communities_select_public
on public.communities for select
to anon, authenticated
using (true);

drop policy if exists communities_admin_write on public.communities;
create policy communities_admin_write
on public.communities for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- profiles ----------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_write on public.profiles;
create policy profiles_admin_write
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- events（課程行事曆） ----------
alter table public.events enable row level security;

drop policy if exists events_select_public on public.events;
drop policy if exists events_insert_public_admin on public.events;
drop policy if exists events_update_public_admin on public.events;
drop policy if exists events_delete_public_admin on public.events;

create policy events_select_public
on public.events for select
to anon, authenticated
using (true);

create policy events_insert_scoped
on public.events for insert
to authenticated
with check (public.is_admin() or community_id = public.my_community_id());

create policy events_update_scoped
on public.events for update
to authenticated
using (public.is_admin() or community_id = public.my_community_id())
with check (public.is_admin() or community_id = public.my_community_id());

create policy events_delete_scoped
on public.events for delete
to authenticated
using (public.is_admin() or community_id = public.my_community_id());

-- ---------- photos（花絮） ----------
alter table public.photos enable row level security;

drop policy if exists photos_select_public on public.photos;
drop policy if exists photos_insert_public_admin on public.photos;
drop policy if exists photos_update_public_admin on public.photos;
drop policy if exists photos_delete_public_admin on public.photos;

create policy photos_select_public
on public.photos for select
to anon, authenticated
using (true);

create policy photos_insert_scoped
on public.photos for insert
to authenticated
with check (public.is_admin() or community_id = public.my_community_id());

create policy photos_update_scoped
on public.photos for update
to authenticated
using (public.is_admin() or community_id = public.my_community_id())
with check (public.is_admin() or community_id = public.my_community_id());

create policy photos_delete_scoped
on public.photos for delete
to authenticated
using (public.is_admin() or community_id = public.my_community_id());

-- ---------- reflections（成果心得） ----------
alter table public.reflections enable row level security;

drop policy if exists reflections_select_public on public.reflections;
drop policy if exists reflections_insert_public_admin on public.reflections;
drop policy if exists reflections_update_public_admin on public.reflections;
drop policy if exists reflections_delete_public_admin on public.reflections;

create policy reflections_select_public
on public.reflections for select
to anon, authenticated
using (true);

create policy reflections_insert_scoped
on public.reflections for insert
to authenticated
with check (public.is_admin() or community_id = public.my_community_id());

create policy reflections_update_scoped
on public.reflections for update
to authenticated
using (public.is_admin() or community_id = public.my_community_id())
with check (public.is_admin() or community_id = public.my_community_id());

create policy reflections_delete_scoped
on public.reflections for delete
to authenticated
using (public.is_admin() or community_id = public.my_community_id());

-- ---------- announcements（活動公告，僅 admin） ----------
alter table public.announcements enable row level security;

drop policy if exists announcements_select_public on public.announcements;
create policy announcements_select_public
on public.announcements for select
to anon, authenticated
using (is_published = true or public.is_admin());

drop policy if exists announcements_admin_write on public.announcements;
create policy announcements_admin_write
on public.announcements for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- qna（僅 admin） ----------
alter table public.qna enable row level security;

drop policy if exists qna_select_public on public.qna;
create policy qna_select_public
on public.qna for select
to anon, authenticated
using (true);

drop policy if exists qna_admin_write on public.qna;
create policy qna_admin_write
on public.qna for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ---------- about_page（僅 admin） ----------
alter table public.about_page enable row level security;

drop policy if exists about_page_select_public on public.about_page;
create policy about_page_select_public
on public.about_page for select
to anon, authenticated
using (true);

drop policy if exists about_page_admin_write on public.about_page;
create policy about_page_admin_write
on public.about_page for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ============================================================
-- Storage：圖片上傳改為僅限登入者
-- ============================================================
drop policy if exists senior_images_insert_public_admin on storage.objects;
create policy senior_images_insert_authenticated
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'senior-center-images'
  and (storage.foldername(name))[1] in ('photos', 'reflections')
);

drop policy if exists senior_images_update_public_admin on storage.objects;
create policy senior_images_update_authenticated
on storage.objects for update
to authenticated
using (bucket_id = 'senior-center-images')
with check (bucket_id = 'senior-center-images');

drop policy if exists senior_images_delete_public_admin on storage.objects;
create policy senior_images_delete_authenticated
on storage.objects for delete
to authenticated
using (bucket_id = 'senior-center-images');
-- select 政策（公開讀取）維持 supabase_init.sql 裡的 senior_images_select_public 不變

-- ============================================================
-- 【手動步驟】建立帳號後，請依序執行：
--
-- 1. 到 Supabase Dashboard → Authentication → Users → Add user，
--    建立管理員帳號，例如 email: admin@dongshan-leling.tw
--
-- 2. 同樣方式，依 communities 資料表裡的 login_email 逐一建立
--    7 個社區帳號（email 需與 communities.login_email 完全一致）
--
-- 3. 回到 SQL Editor，執行以下語法把角色設定正確
--    （UUID 請從 Authentication → Users 頁面複製）：
--
--    update public.profiles set role = 'admin', community_id = null
--    where id = '<admin 帳號的 UUID>';
--
--    update public.profiles set role = 'community',
--      community_id = (select id from public.communities where slug = 'qingshan')
--    where id = '<青山社區帳號的 UUID>';
--
--    -- 其餘 6 個社區依此類推
-- ============================================================
