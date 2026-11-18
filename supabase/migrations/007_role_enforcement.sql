-- TriloWMS: enforce roles in the database (run once in Supabase -> SQL Editor).
-- Reads stay open to every signed-in user. Writes are now limited:
--   * the auditor (audit@trilowms.com) is read-only everywhere;
--   * the warehouse layout (table wms_snapshots) can only be changed by admin@ and whadmin@.
-- Safe to run more than once.

drop policy if exists "store insert" on public.wms_store_snapshots;
drop policy if exists "store update" on public.wms_store_snapshots;
drop policy if exists "wms insert"   on public.wms_snapshots;
drop policy if exists "wms update"   on public.wms_snapshots;

create policy "store insert" on public.wms_store_snapshots for insert to authenticated
  with check (name like 'trilowms-%' and (auth.jwt() ->> 'email') <> 'audit@trilowms.com');

create policy "store update" on public.wms_store_snapshots for update to authenticated
  using (name like 'trilowms-%' and (auth.jwt() ->> 'email') <> 'audit@trilowms.com')
  with check (name like 'trilowms-%' and (auth.jwt() ->> 'email') <> 'audit@trilowms.com');

create policy "wms insert" on public.wms_snapshots for insert to authenticated
  with check (id = 1 and (auth.jwt() ->> 'email') in ('admin@trilowms.com', 'whadmin@trilowms.com'));

create policy "wms update" on public.wms_snapshots for update to authenticated
  using (id = 1 and (auth.jwt() ->> 'email') in ('admin@trilowms.com', 'whadmin@trilowms.com'))
  with check (id = 1 and (auth.jwt() ->> 'email') in ('admin@trilowms.com', 'whadmin@trilowms.com'));
