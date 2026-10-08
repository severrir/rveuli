-- რვეული — schema for the IX კლასი homework board.
--
-- The authorisation model in one line: anyone may read, only a row in
-- `profiles` may write. Students never hold an account, so every read
-- policy must work for the anonymous role, and every write policy must
-- check `profiles` rather than merely "is logged in".

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Class reps
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null check (length(trim(display_name)) between 1 and 40),
  role         text        not null default 'rep' check (role in ('rep', 'owner')),
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Presence of a row here is what grants write access. Creating an auth user alone grants nothing.';

-- ---------------------------------------------------------------------
-- Homework
-- ---------------------------------------------------------------------
create table if not exists public.homework (
  id          uuid primary key default gen_random_uuid(),
  subject     text        not null check (subject in (
                'math', 'physics', 'chemistry', 'biology', 'geography',
                'history', 'geo-lang', 'geo-lit', 'english', 'german',
                'civics', 'art', 'music', 'sport')),
  title       text        not null check (length(trim(title)) between 1 and 140),
  details     text                 check (details is null or length(details) <= 900),
  due_at      timestamptz not null,
  is_pinned   boolean     not null default false,
  link_url    text                 check (link_url is null or link_url ~* '^https?://'),
  attachments jsonb       not null default '[]'::jsonb,
  created_by  uuid                 references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz,
  -- Soft delete, so a mis-tap on a phone can be taken back from the toast.
  deleted_at  timestamptz
);

create index if not exists homework_due_at_idx
  on public.homework (due_at) where deleted_at is null;
create index if not exists homework_subject_idx
  on public.homework (subject) where deleted_at is null;

-- ---------------------------------------------------------------------
-- Anonymous push subscriptions for the evening reminder
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  endpoint   text        not null unique,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now(),
  -- Set when a send fails permanently, so dead endpoints stop being retried.
  failed_at  timestamptz
);

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.homework           enable row level security;
alter table public.push_subscriptions enable row level security;

-- Helper: is the caller a class rep?
--
-- It lives in `private` rather than `public` because PostgREST exposes the
-- public schema, which would publish this as /rest/v1/rpc/is_rep. Policy
-- expressions run as the querying role, so `authenticated` still needs
-- EXECUTE; `anon` never evaluates a policy that calls it.
create schema if not exists private;

create or replace function private.is_rep()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid());
$$;

grant usage on schema private to authenticated;
revoke all on function private.is_rep() from public, anon;
grant execute on function private.is_rep() to authenticated;

-- Reps are readable by everyone: the board shows who posted each entry.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (true);

-- A rep may correct their own display name, nothing else.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Everyone, signed in or not, reads homework that has not been deleted.
--
-- Reps additionally see soft-deleted rows. That is not a convenience: a
-- soft delete is an UPDATE, PostgREST runs it as UPDATE ... RETURNING, and
-- Postgres requires the resulting row to pass the SELECT policies. With a
-- single `deleted_at is null` read policy the row vanished the moment it
-- was marked deleted and the update was rejected, making deletion
-- impossible. The client still filters `deleted_at is null`, so the feed
-- is unaffected.
drop policy if exists homework_read on public.homework;
drop policy if exists homework_read_public on public.homework;
drop policy if exists homework_read_rep on public.homework;

create policy homework_read_public on public.homework
  for select to anon
  using (deleted_at is null);

create policy homework_read_rep on public.homework
  for select to authenticated
  using (deleted_at is null or private.is_rep());

drop policy if exists homework_insert on public.homework;
create policy homework_insert on public.homework
  for insert to authenticated
  with check (private.is_rep() and created_by = auth.uid());

-- Any rep may fix any entry: a class board is shared, not personal.
-- Delete is soft, so there is no DELETE policy at all — the row is updated.
drop policy if exists homework_update on public.homework;
create policy homework_update on public.homework
  for update to authenticated
  using (private.is_rep()) with check (private.is_rep());

-- Students subscribe without an account, so inserts are open. Nothing can
-- be read back: an endpoint is only ever written, or deleted by its owner.
drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert on public.push_subscriptions
  for insert with check (true);

drop policy if exists push_delete on public.push_subscriptions;
create policy push_delete on public.push_subscriptions
  for delete using (true);

-- ---------------------------------------------------------------------
-- Attachments bucket
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('homework-files', 'homework-files', true, 10485760)
on conflict (id) do nothing;

drop policy if exists homework_files_read on storage.objects;
create policy homework_files_read on storage.objects
  for select using (bucket_id = 'homework-files');

drop policy if exists homework_files_write on storage.objects;
create policy homework_files_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'homework-files' and private.is_rep());

drop policy if exists homework_files_delete on storage.objects;
create policy homework_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'homework-files' and private.is_rep());

-- ---------------------------------------------------------------------
-- Realtime: a rep posting from their phone appears on every open board
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.homework;
exception
  when duplicate_object then null;
end
$$;
