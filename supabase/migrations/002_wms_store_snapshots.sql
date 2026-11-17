-- TriloWMS: shared storage for operational data (orders, stock, inbound, putaway, QC, ...).
-- Run once in the Supabase dashboard -> SQL Editor -> paste -> Run.
-- One row per app store; `state` is that store's saved JSON.

create table if not exists public.wms_store_snapshots (
  name        text        primary key,
  state       jsonb       not null,
  updated_at  timestamptz not null default now()
);

alter table public.wms_store_snapshots enable row level security;

drop policy if exists "store read"   on public.wms_store_snapshots;
drop policy if exists "store insert" on public.wms_store_snapshots;
drop policy if exists "store update" on public.wms_store_snapshots;

-- Only rows named like the app's own stores can be touched; nothing can be deleted.
-- IMPORTANT: the app has no Supabase sign-in yet, so anyone holding the public anon key
-- can read and change this data. Fine for testing; add real sign-in and tighten
-- these policies before using real customer or inventory data.
create policy "store read"   on public.wms_store_snapshots for select to anon, authenticated using (name like 'trilowms-%');
create policy "store insert" on public.wms_store_snapshots for insert to anon, authenticated with check (name like 'trilowms-%');
create policy "store update" on public.wms_store_snapshots for update to anon, authenticated using (name like 'trilowms-%') with check (name like 'trilowms-%');
