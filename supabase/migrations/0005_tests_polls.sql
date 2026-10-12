-- წერები and კენჭისყრა — the two things a class needs that a homework
-- board cannot express.
--
-- A test is not a homework with a different label: homework is "what do I
-- hand in", a test is "how long have I got and what is it on". A poll is
-- the first thing in this app a student may *write* to, which is why its
-- votes are the only table here reached exclusively through functions.
--
-- The authorisation model is unchanged: anyone reads, a row in `profiles`
-- writes. Students still never hold an account, so every read policy must
-- work for `anon`.

-- ---------------------------------------------------------------------
-- წერები
-- ---------------------------------------------------------------------
create table if not exists public.tests (
  id         uuid primary key default gen_random_uuid(),
  subject    text        not null check (subject in (
               'math', 'physics', 'chemistry', 'biology', 'geography',
               'history', 'geo-lang', 'geo-lit', 'english', 'german',
               'civics', 'art', 'music', 'sport')),
  kind       text        not null check (kind in (
               'dictation', 'quiz', 'oral', 'control', 'summary', 'exam')),
  -- What it is on. Required: a test with no subject matter announced is
  -- just anxiety, and the whole point of the tab is to answer "on what?".
  topics     text        not null check (length(trim(topics)) between 1 and 400),
  note       text                 check (note is null or length(note) <= 900),
  written_at timestamptz not null,
  created_by uuid                 references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index if not exists tests_written_at_idx
  on public.tests (written_at) where deleted_at is null;

comment on table public.tests is
  'Written assessments. Insert fires a push announcement - see private.announce_test().';

-- ---------------------------------------------------------------------
-- კენჭისყრა
-- ---------------------------------------------------------------------
create table if not exists public.polls (
  id         uuid primary key default gen_random_uuid(),
  question   text        not null check (length(trim(question)) between 4 and 200),
  -- [{ "id": "a", "label": "..." }, ...] - between two and six of them.
  options    jsonb       not null check (
               jsonb_typeof(options) = 'array'
               and jsonb_array_length(options) between 2 and 6),
  -- An automatic closing time, if the rep set one.
  closes_at  timestamptz,
  -- Set when a rep closes it by hand. Either one closes the poll.
  closed_at  timestamptz,
  created_by uuid                 references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create index if not exists polls_created_at_idx
  on public.polls (created_at desc) where deleted_at is null;

-- One vote per device.
--
-- `voter_key` is a random id the browser generates for itself and keeps in
-- localStorage. It identifies nothing about the student - there is no
-- account to tie it to - and the primary key is what actually enforces one
-- vote per device, rather than the client politely declining to ask twice.
--
-- Clearing site data earns a second vote. That is accepted: the
-- alternative is accounts for thirty teenagers to settle where to go on an
-- excursion.
create table if not exists public.poll_votes (
  poll_id    uuid        not null references public.polls (id) on delete cascade,
  option_id  text        not null,
  voter_key  text        not null check (length(voter_key) between 8 and 64),
  created_at timestamptz not null default now(),
  primary key (poll_id, voter_key)
);

-- ---------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------
alter table public.tests      enable row level security;
alter table public.polls      enable row level security;
alter table public.poll_votes enable row level security;

-- Reps see soft-deleted rows for the same reason they do on homework: a
-- soft delete is an UPDATE, PostgREST runs it as UPDATE ... RETURNING, and
-- the returned row must still pass a SELECT policy or the delete is
-- rejected outright. The client filters deleted rows out of the views.
drop policy if exists tests_read_public on public.tests;
create policy tests_read_public on public.tests
  for select to anon using (deleted_at is null);

drop policy if exists tests_read_rep on public.tests;
create policy tests_read_rep on public.tests
  for select to authenticated
  using (deleted_at is null or private.is_rep());

drop policy if exists tests_insert on public.tests;
create policy tests_insert on public.tests
  for insert to authenticated
  with check (private.is_rep() and created_by = auth.uid());

drop policy if exists tests_update on public.tests;
create policy tests_update on public.tests
  for update to authenticated
  using (private.is_rep()) with check (private.is_rep());

drop policy if exists polls_read_public on public.polls;
create policy polls_read_public on public.polls
  for select to anon using (deleted_at is null);

drop policy if exists polls_read_rep on public.polls;
create policy polls_read_rep on public.polls
  for select to authenticated
  using (deleted_at is null or private.is_rep());

drop policy if exists polls_insert on public.polls;
create policy polls_insert on public.polls
  for insert to authenticated
  with check (private.is_rep() and created_by = auth.uid());

drop policy if exists polls_update on public.polls;
create policy polls_update on public.polls
  for update to authenticated
  using (private.is_rep()) with check (private.is_rep());

-- poll_votes deliberately has no policies at all, so the table is
-- unreachable through the API in either direction. A SELECT policy would
-- publish who voted for what, in a class of thirty, which is exactly the
-- thing a secret ballot is for. The two functions below are the only way
-- in: one casts a single vote, the other returns counts and nothing else.

-- ---------------------------------------------------------------------
-- Casting and counting
-- ---------------------------------------------------------------------

-- Whether a poll is still accepting votes.
create or replace function public.poll_is_open(p public.polls)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select p.deleted_at is null
     and p.closed_at is null
     and (p.closes_at is null or p.closes_at > now());
$fn$;

create or replace function public.cast_poll_vote(
  p_poll_id   uuid,
  p_option_id text,
  p_voter_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  poll public.polls;
begin
  if p_voter_key is null or length(p_voter_key) not between 8 and 64 then
    raise exception 'bad_voter';
  end if;

  select * into poll from public.polls where id = p_poll_id;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.poll_is_open(poll) then
    raise exception 'poll_closed';
  end if;

  -- The option has to be one this poll actually offers, or a crafted call
  -- could invent a choice that appears in the tally but on no ballot.
  if not exists (
    select 1 from jsonb_array_elements(poll.options) o
    where o->>'id' = p_option_id
  ) then
    raise exception 'bad_option';
  end if;

  insert into public.poll_votes (poll_id, option_id, voter_key)
  values (p_poll_id, p_option_id, p_voter_key)
  on conflict (poll_id, voter_key) do update
    set option_id = excluded.option_id, created_at = now();
end;
$fn$;

-- Counts only - never a voter key, never who chose what. Safe to hand to
-- `anon`, which is the whole reason the tally is a function rather than a
-- readable table.
create or replace function public.poll_tallies()
returns table (poll_id uuid, option_id text, votes bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select v.poll_id, v.option_id, count(*)::bigint
  from public.poll_votes v
  join public.polls p on p.id = v.poll_id and p.deleted_at is null
  group by v.poll_id, v.option_id;
$fn$;

revoke all on function public.cast_poll_vote(uuid, text, text) from public;
revoke all on function public.poll_tallies() from public;
grant execute on function public.cast_poll_vote(uuid, text, text) to anon, authenticated;
grant execute on function public.poll_tallies() to anon, authenticated;

-- ---------------------------------------------------------------------
-- "A test has been set" - the push announcement
-- ---------------------------------------------------------------------

-- Per-device opt-out. A student who asked only for the evening digest
-- should not be pinged at an arbitrary hour because a rep opened the app.
alter table public.push_subscriptions
  add column if not exists announce_tests boolean not null default true;

-- One more narrow write, in the style of the other two: it names a single
-- endpoint, sets one flag and returns nothing.
--
-- `save_push_subscription` is deliberately left at its five arguments.
-- Adding an optional sixth would leave two candidate signatures that both
-- match a five-argument call, and PostgREST would start failing with
-- "function is not unique".
create or replace function public.set_push_announce(
  p_endpoint text,
  p_on       boolean
)
returns void
language sql
security definer
set search_path = public
as $fn$
  update public.push_subscriptions
  set announce_tests = p_on, updated_at = now()
  where endpoint = p_endpoint;
$fn$;

revoke all on function public.set_push_announce(text, boolean) from public;
grant execute on function public.set_push_announce(text, boolean) to anon, authenticated;

-- Fires the announcement when a rep sets a test.
--
-- The edge function holds the VAPID keys, so the database only has to ask
-- it to send. It authenticates exactly as the cron job does - the anon key
-- in `Authorization` to satisfy verify_jwt, and `CRON_INVOKE_KEY` in
-- `x-cron-key` so the anon key alone cannot notify the class.
--
-- Both the URL and the anon key are read from Vault rather than written
-- into this file, so re-pointing at another project does not need an edit
-- here. If either is missing the trigger does nothing.
--
-- Every failure is swallowed. A notification that cannot be sent must
-- never cost a rep the test they just typed in.
create or replace function private.announce_test()
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
      body    := jsonb_build_object('action', 'announce-test', 'id', new.id),
      timeout_milliseconds := 25000
    );
  exception
    when others then
      -- Announced or not, the test is set.
      raise warning 'announce_test failed: %', sqlerrm;
  end;

  return new;
end;
$fn$;

drop trigger if exists tests_announce on public.tests;
create trigger tests_announce
  after insert on public.tests
  for each row execute function private.announce_test();

-- ---------------------------------------------------------------------
-- Realtime, so a test or a poll appears on every open board at once
-- ---------------------------------------------------------------------
do $do$
begin
  alter publication supabase_realtime add table public.tests;
exception
  when duplicate_object then null;
end
$do$;

do $do$
begin
  alter publication supabase_realtime add table public.polls;
exception
  when duplicate_object then null;
end
$do$;
