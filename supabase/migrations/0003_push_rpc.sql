-- Subscriptions are written through two narrow functions instead of broad
-- table policies.
--
-- Why: an upsert needs to read the row it would conflict with, and this
-- table has no SELECT policy on purpose — a readable endpoint list would
-- let anyone enumerate and notify every student in the class. Broad
-- insert/update/delete policies using (true) also did more than intended,
-- since PostgREST accepts any filter.
--
-- Each function acts on exactly one endpoint and returns nothing, so it
-- cannot be used to read or enumerate anything. An endpoint is an
-- unguessable per-browser URL, which is the only thing identifying a
-- device here; there is no account to tie it to.

drop policy if exists push_insert on public.push_subscriptions;
drop policy if exists push_update on public.push_subscriptions;
drop policy if exists push_delete on public.push_subscriptions;

create or replace function public.save_push_subscription(
  p_endpoint     text,
  p_p256dh       text,
  p_auth         text,
  p_hour         smallint default 19,
  p_school_only  boolean  default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_endpoint is null or p_endpoint !~ '^https://' then
    raise exception 'invalid endpoint';
  end if;
  if p_hour < 5 or p_hour > 23 then
    raise exception 'hour out of range';
  end if;

  insert into public.push_subscriptions
    (endpoint, p256dh, auth, remind_hour, school_nights_only, failed_at, updated_at)
  values
    (p_endpoint, p_p256dh, p_auth, p_hour, p_school_only, null, now())
  on conflict (endpoint) do update set
    p256dh             = excluded.p256dh,
    auth               = excluded.auth,
    remind_hour        = excluded.remind_hour,
    school_nights_only = excluded.school_nights_only,
    failed_at          = null,
    updated_at         = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.save_push_subscription(text, text, text, smallint, boolean) from public;
revoke all on function public.delete_push_subscription(text) from public;
grant execute on function public.save_push_subscription(text, text, text, smallint, boolean) to anon, authenticated;
grant execute on function public.delete_push_subscription(text) to anon, authenticated;
