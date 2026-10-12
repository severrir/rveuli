-- ევენთები — what is happening, as opposed to what is due.
--
-- The only table here with a place and a time *window* rather than a
-- deadline: an excursion starts at eight and the bus comes back at seven,
-- while homework is only ever due at a moment. Nothing in it is ever
-- "overdue" — an event that has passed simply happened.
--
-- Authorisation is unchanged: anyone reads, a row in `profiles` writes.

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text        not null check (length(trim(title)) between 1 and 140),
  kind       text        not null check (kind in (
               'excursion', 'olympiad', 'meeting', 'concert',
               'sport', 'party', 'holiday', 'other')),
  location   text                 check (location is null or length(location) <= 120),
  note       text                 check (note is null or length(note) <= 900),
  starts_at  timestamptz not null,
  -- Optional on purpose: a parents' meeting starts at six and ends when it
  -- ends. Requiring an end would mean reps inventing one.
  ends_at    timestamptz,
  created_by uuid                 references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  constraint events_window check (ends_at is null or ends_at > starts_at)
);

create index if not exists events_starts_at_idx
  on public.events (starts_at) where deleted_at is null;

comment on table public.events is
  'School events. Insert fires a push announcement - see private.announce_event().';

alter table public.events enable row level security;

-- Reps see soft-deleted rows for the same reason they do on homework: a
-- soft delete is an UPDATE, PostgREST runs it as UPDATE ... RETURNING, and
-- the returned row must still pass a SELECT policy or the delete fails.
drop policy if exists events_read_public on public.events;
create policy events_read_public on public.events
  for select to anon using (deleted_at is null);

drop policy if exists events_read_rep on public.events;
create policy events_read_rep on public.events
  for select to authenticated
  using (deleted_at is null or private.is_rep());

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated
  with check (private.is_rep() and created_by = auth.uid());

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update to authenticated
  using (private.is_rep()) with check (private.is_rep());

-- ---------------------------------------------------------------------
-- "An event has been added" - the push announcement
-- ---------------------------------------------------------------------

-- Its own switch, separate from the წერა announcement. A student who
-- wants to know about tests and not about the autumn concert should be
-- able to say so; one combined flag would force the pair on them.
alter table public.push_subscriptions
  add column if not exists announce_events boolean not null default true;

create or replace function public.set_push_announce_events(
  p_endpoint text,
  p_on       boolean
)
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.push_subscriptions
  set announce_events = p_on, updated_at = now()
  where endpoint = p_endpoint;
$fn$;

revoke all on function public.set_push_announce_events(text, boolean) from public;
grant execute on function public.set_push_announce_events(text, boolean) to anon, authenticated;

-- The same shape as private.announce_test(): the edge function holds the
-- VAPID keys, so the database only asks it to send, authenticating with
-- the anon key plus CRON_INVOKE_KEY exactly as the cron job does. Every
-- failure is swallowed — a notification that cannot go out must never
-- cost a rep the event they just typed in.
create or replace function private.announce_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  project_url text;
  anon_key    text;
  cron_key    text;
begin
  begin
    project_url := public.read_app_secret('PROJECT_URL');
    anon_key    := public.read_app_secret('ANON_KEY');
    cron_key    := public.read_app_secret('CRON_INVOKE_KEY');

    if project_url is null or anon_key is null or cron_key is null then
      return new;
    end if;

    perform net.http_post(
      url     := project_url || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || anon_key,
                   'x-cron-key',    cron_key
                 ),
      body    := jsonb_build_object('action', 'announce-event', 'id', new.id),
      timeout_milliseconds := 25000
    );
  exception
    when others then
      raise warning 'announce_event failed: %', sqlerrm;
  end;

  return new;
end;
$fn$;

drop trigger if exists events_announce on public.events;
create trigger events_announce
  after insert on public.events
  for each row execute function private.announce_event();

-- Realtime, so an event appears on every open board at once.
do $do$
begin
  alter publication supabase_realtime add table public.events;
exception
  when duplicate_object then null;
end
$do$;
