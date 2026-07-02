create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text default '',
  avatar_url text default '',
  role text not null default 'user' check (role in ('user', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'super_admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
        avatar_url = coalesce(nullif(excluded.avatar_url, ''), public.profiles.avatar_url),
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.courses (
  id text primary key,
  owner_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text default '',
  lesson_count integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses add column if not exists owner_id uuid references public.profiles(id) on delete cascade;

create index if not exists courses_owner_id_idx on public.courses(owner_id);
create index if not exists courses_updated_at_idx on public.courses(updated_at desc);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.courses to authenticated;

drop policy if exists "Profiles are readable by owner or admins" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own basic profile" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;

create policy "Profiles are readable by owner or admins"
  on public.profiles
  for select
  using (id = auth.uid() or public.is_super_admin());

create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (id = auth.uid() and role = 'user');

create policy "Users can update own basic profile"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = 'user');

create policy "Admins can update profiles"
  on public.profiles
  for update
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "Public read courses" on public.courses;
drop policy if exists "Public create courses" on public.courses;
drop policy if exists "Public update courses" on public.courses;
drop policy if exists "Public delete courses" on public.courses;
drop policy if exists "Users can read own courses" on public.courses;
drop policy if exists "Users can create own courses" on public.courses;
drop policy if exists "Users can update own courses" on public.courses;
drop policy if exists "Users can delete own courses" on public.courses;
drop policy if exists "Authenticated users can read orphan courses" on public.courses;
drop policy if exists "Authenticated users can claim orphan courses" on public.courses;
drop policy if exists "Authenticated users can delete orphan courses" on public.courses;

create policy "Users can read own courses"
  on public.courses
  for select
  using (owner_id = auth.uid() or public.is_super_admin());

create policy "Authenticated users can read orphan courses"
  on public.courses
  for select
  using (owner_id is null and auth.uid() is not null);

create policy "Users can create own courses"
  on public.courses
  for insert
  with check (owner_id = auth.uid() or public.is_super_admin());

create policy "Users can update own courses"
  on public.courses
  for update
  using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());

create policy "Authenticated users can claim orphan courses"
  on public.courses
  for update
  using (owner_id is null and auth.uid() is not null)
  with check (owner_id = auth.uid());

create policy "Users can delete own courses"
  on public.courses
  for delete
  using (owner_id = auth.uid() or public.is_super_admin());

create policy "Authenticated users can delete orphan courses"
  on public.courses
  for delete
  using (owner_id is null and auth.uid() is not null);

insert into storage.buckets (id, name, public)
values ('course-assets', 'course-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "Course assets are publicly readable" on storage.objects;
drop policy if exists "Users can upload own course assets" on storage.objects;
drop policy if exists "Users can update own course assets" on storage.objects;
drop policy if exists "Users can delete own course assets" on storage.objects;

create policy "Course assets are publicly readable"
  on storage.objects
  for select
  using (bucket_id = 'course-assets');

create policy "Users can upload own course assets"
  on storage.objects
  for insert
  with check (
    bucket_id = 'course-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
    )
  );

create policy "Users can update own course assets"
  on storage.objects
  for update
  using (
    bucket_id = 'course-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
    )
  )
  with check (
    bucket_id = 'course-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
    )
  );

create policy "Users can delete own course assets"
  on storage.objects
  for delete
  using (
    bucket_id = 'course-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_super_admin()
    )
  );

-- Despues de registrarte con tu cuenta real, ejecuta una vez:
-- update public.profiles set role = 'super_admin' where email = 'tu-correo@dominio.cl';
