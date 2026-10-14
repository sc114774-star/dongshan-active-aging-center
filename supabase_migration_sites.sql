-- ============================================================
-- 據點管理：停用/新增據點、新增「青山國小」、調整順序、帳號建立函式
-- 請在 Supabase → SQL Editor 貼上執行一次（可重複執行）
-- ============================================================

-- 1) 據點可「停用」（不刪資料，只是從選單與網站分頁隱藏）
alter table public.communities add column if not exists is_active boolean not null default true;

-- 2) 建立 / 重設據點登入帳號的函式
--    只有總管理員（或在 SQL Editor 以管理者身分）能執行
create or replace function public.create_site_account(p_slug text, p_name text, p_password text default '2026')
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(p_slug) || '@member.dongshan-leling.tw';
  v_cid uuid;
  v_uid uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception '只有總管理員可以新增據點';
  end if;
  if p_slug !~ '^[a-z0-9-]+$' then
    raise exception '代碼只能使用小寫英文、數字與 -';
  end if;
  if length(coalesce(p_password, '')) < 4 then
    raise exception '密碼至少 4 碼';
  end if;

  select id into v_cid from public.communities where slug = lower(p_slug);
  if v_cid is null then
    insert into public.communities (name, slug, login_email, display_order, is_active)
    values (p_name, lower(p_slug), v_email, coalesce((select max(display_order) from public.communities), 0) + 1, true)
    returning id into v_cid;
  end if;

  select id into v_uid from auth.users where email = v_email;
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token)
    values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_uid, v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', false, 'phone_verified', false),
      'email', now(), now(), now());
  else
    update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = v_uid;
  end if;

  insert into public.profiles (id, role, community_id, display_name)
  values (v_uid, 'community', v_cid, p_name)
  on conflict (id) do update set community_id = excluded.community_id;

  update public.communities set login_email = v_email where id = v_cid and login_email is distinct from v_email;
  return v_email;
end;
$$;

revoke all on function public.create_site_account(text, text, text) from public, anon;
grant execute on function public.create_site_account(text, text, text) to authenticated;

-- 3) 重設某據點的登入密碼（總管理員在後台「據點管理」使用）
create or replace function public.set_site_password(p_slug text, p_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception '只有總管理員可以重設密碼';
  end if;
  if length(coalesce(p_password, '')) < 4 then
    raise exception '密碼至少 4 碼';
  end if;
  update auth.users u set encrypted_password = crypt(p_password, gen_salt('bf')),
    email_confirmed_at = coalesce(u.email_confirmed_at, now()), updated_at = now()
  from public.communities c
  where c.slug = p_slug and u.email = c.login_email;
end;
$$;

revoke all on function public.set_site_password(text, text) from public, anon;
grant execute on function public.set_site_password(text, text) to authenticated;

-- 4) 新增「青山國小」據點與帳號（初始密碼 2026）
select public.create_site_account('qingshan-school', '青山國小', '2026');

-- 5) 依你提供的順序排列
update public.communities c set display_order = v.o
from (values ('qingshan-school',1),('qingshan',2),('gaoyuan',3),('dongyuan',4),('lingnan',5),('care',6),('linan',7),('dongshan',8)) as v(slug, o)
where c.slug = v.slug;
