-- TriloWMS step 1 of 2: lock the database so only signed-in users can read or write.
-- Run once in Supabase -> SQL Editor. (Then run 005_create_logins.sql.)
-- After this, the public site key alone can no longer read or change any warehouse data.

alter table public.wms_store_snapshots enable row level security;
alter table public.wms_snapshots       enable row level security;

drop policy if exists "store read"   on public.wms_store_snapshots;
drop policy if exists "store insert" on public.wms_store_snapshots;
drop policy if exists "store update" on public.wms_store_snapshots;
drop policy if exists "wms read"     on public.wms_snapshots;
drop policy if exists "wms insert"   on public.wms_snapshots;
drop policy if exists "wms update"   on public.wms_snapshots;

create policy "store read"   on public.wms_store_snapshots for select to authenticated using (name like 'trilowms-%');
create policy "store insert" on public.wms_store_snapshots for insert to authenticated with check (name like 'trilowms-%');
create policy "store update" on public.wms_store_snapshots for update to authenticated using (name like 'trilowms-%') with check (name like 'trilowms-%');

create policy "wms read"     on public.wms_snapshots for select to authenticated using (id = 1);
create policy "wms insert"   on public.wms_snapshots for insert to authenticated with check (id = 1);
create policy "wms update"   on public.wms_snapshots for update to authenticated using (id = 1) with check (id = 1);

revoke all on public.wms_store_snapshots from anon;
revoke all on public.wms_snapshots       from anon;
