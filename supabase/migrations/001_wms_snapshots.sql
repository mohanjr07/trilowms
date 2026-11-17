-- TriloWMS: warehouse layout storage (the only table the app uses).
-- Run once in the new project: Supabase dashboard -> SQL Editor -> paste -> Run.

create table if not exists public.wms_snapshots (
  id          integer primary key,
  warehouses  jsonb       not null default '[]'::jsonb,
  active_id   text,
  updated_at  timestamptz not null default now()
);

alter table public.wms_snapshots enable row level security;

-- The app has no Supabase sign-in yet, so it reads and writes with the public
-- anon key. These policies allow exactly that, and only for the single row
-- the app uses (id = 1). Nobody can create other rows or delete this one.
-- IMPORTANT: this means anyone who has your site's anon key can change the
-- layout. Tighten it once real Supabase Auth is added (see README-MIGRATION).
drop policy if exists "wms read"   on public.wms_snapshots;
drop policy if exists "wms insert" on public.wms_snapshots;
drop policy if exists "wms update" on public.wms_snapshots;

create policy "wms read"   on public.wms_snapshots for select to anon, authenticated using (id = 1);
create policy "wms insert" on public.wms_snapshots for insert to anon, authenticated with check (id = 1);
create policy "wms update" on public.wms_snapshots for update to anon, authenticated using (id = 1) with check (id = 1);
