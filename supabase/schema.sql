create table if not exists public.courses (
  id text primary key,
  title text not null,
  description text default '',
  lesson_count integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses enable row level security;

drop policy if exists "Public read courses" on public.courses;
drop policy if exists "Public create courses" on public.courses;
drop policy if exists "Public update courses" on public.courses;
drop policy if exists "Public delete courses" on public.courses;

create policy "Public read courses"
  on public.courses
  for select
  using (true);

create policy "Public create courses"
  on public.courses
  for insert
  with check (true);

create policy "Public update courses"
  on public.courses
  for update
  using (true)
  with check (true);

create policy "Public delete courses"
  on public.courses
  for delete
  using (true);
