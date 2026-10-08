-- ============================================================
-- 快速上傳花絮（免登入）遷移腳本
-- 前置條件：已執行 supabase_init.sql 與 supabase_migration_rbac.sql
-- 可重複執行。
--
-- 說明：
-- 1. 「課程」資料表在本專案叫 events（即你說的 courses），新增 teacher 授課老師欄位
-- 2. photos 新增 is_approved（匿名上傳一律 false，需後台核准才會在前台顯示）、
--    community_id、event_id
-- 3. anon 只能：INSERT 一筆「未核准、屬於有效據點、檔案位於 quick-upload/」的照片
-- ============================================================

alter table public.events add column if not exists teacher text;

-- 先以 default true 加欄位（既有照片視為已核准），再把預設值改回 false
alter table public.photos add column if not exists is_approved boolean not null default true;
alter table public.photos alter column is_approved set default false;

alter table public.photos add column if not exists community_id uuid references public.communities(id);
alter table public.photos add column if not exists event_id uuid references public.events(id) on delete set null;
create index if not exists photos_event_id_idx on public.photos(event_id);
create index if not exists photos_approved_idx on public.photos(is_approved, created_at desc);

-- 前台只看得到已核准；管理員 / 該社區帳號可看到自己範圍內全部（含待審）
drop policy if exists photos_select_public on public.photos;
create policy photos_select_public
on public.photos for select
to anon, authenticated
using (is_approved = true or public.is_admin() or community_id = public.my_community_id());

-- 匿名快速上傳：強制未核准、據點與課程必須對得上、圖片網址必須在 quick-upload/ 底下
grant insert on public.photos to anon;
drop policy if exists photos_insert_quick_upload on public.photos;
create policy photos_insert_quick_upload
on public.photos for insert
to anon
with check (
  is_approved = false
  and photos.community_id is not null
  and exists (select 1 from public.communities c where c.id = photos.community_id)
  and (
    photos.event_id is null
    or exists (
      select 1 from public.events e
      where e.id = photos.event_id and e.community_id = photos.community_id
    )
  )
  and photos.image_url like '%/storage/v1/object/public/senior-center-images/quick-upload/%'
);

-- Storage：匿名只能把圖片放進 quick-upload/ 資料夾（bucket 本身已限制圖片格式與 10MB）
drop policy if exists senior_images_insert_quick_upload on storage.objects;
create policy senior_images_insert_quick_upload
on storage.objects for insert
to anon
with check (
  bucket_id = 'senior-center-images'
  and (storage.foldername(name))[1] = 'quick-upload'
);

-- 管理員 / 社區帳號後台核准（update 政策沿用 photos_update_scoped，不需額外新增）
