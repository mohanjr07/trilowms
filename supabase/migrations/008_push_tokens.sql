-- Push notification device tokens (one row per installed app).
create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid not null default auth.uid(),
  email text not null,
  role text not null default '',
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_email_idx on public.device_tokens (lower(email));
create index if not exists device_tokens_role_idx on public.device_tokens (role);
alter table public.device_tokens enable row level security;

drop policy if exists "own tokens select" on public.device_tokens;
drop policy if exists "own tokens insert" on public.device_tokens;
drop policy if exists "own tokens update" on public.device_tokens;
drop policy if exists "own tokens delete" on public.device_tokens;
create policy "own tokens select" on public.device_tokens for select to authenticated using (user_id = auth.uid());
create policy "own tokens insert" on public.device_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "own tokens update" on public.device_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tokens delete" on public.device_tokens for delete to authenticated using (user_id = auth.uid());
