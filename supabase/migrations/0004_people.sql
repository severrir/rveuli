-- People management from inside the app.
--
-- Adding a rep used to mean opening supabase/add-rep.sql, editing three
-- values and running it in the dashboard. That is fine once; it is not
-- fine every time a class officer changes. These functions move the same
-- work behind four calls an owner can make from their phone.
--
-- The mechanism is unchanged: a row in `public.profiles` is the grant, and
-- an auth user without one reads the board like any student. What is new
-- is who may create that row — an `owner`, and only an owner.
--
-- Why functions rather than policies: creating an account touches
-- auth.users and auth.identities, which no client role may write. A
-- security-definer function is the only way to offer that without handing
-- a service key to the browser. Each function does one narrow thing and
-- checks the caller first, so the surface stays small.

-- ---------------------------------------------------------------------
-- Who is an owner?
-- ---------------------------------------------------------------------
-- Lives in `private` for the same reason as is_rep(): PostgREST publishes
-- the public schema, and this is not an endpoint.
create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner'
  );
$$;

revoke all on function private.is_owner() from public, anon;
grant execute on function private.is_owner() to authenticated;

-- ---------------------------------------------------------------------
-- The mechanism: create or update an account and its grant
-- ---------------------------------------------------------------------
-- No permission check here, on purpose. This is the part that writes, and
-- it is private, so the only callers are the public wrappers below, which
-- do check, and the dashboard, where you are an administrator already.
--
-- A null password leaves an existing account's password alone; for a new
-- account it is an error, since there would be no way in.
create or replace function private.write_rep(
  p_email    text,
  p_password text,
  p_name     text,
  p_role     text default 'rep'
)
returns uuid
language plpgsql
security definer
-- crypt() and gen_salt() live in `extensions` on Supabase, not in public.
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_name  text := trim(p_name);
  uid     uuid;
begin
  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'bad_email';
  end if;
  if v_name is null or length(v_name) < 1 or length(v_name) > 40 then
    raise exception 'bad_name';
  end if;
  if p_role not in ('rep', 'owner') then
    raise exception 'bad_role';
  end if;
  if p_password is not null and length(p_password) < 8 then
    raise exception 'weak_password';
  end if;

  select id into uid from auth.users where email = v_email;

  if uid is null then
    if p_password is null then
      raise exception 'password_required';
    end if;

    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
      -- GoTrue reads these into non-nullable strings. Left NULL, sign-in
      -- fails with "Database error querying schema", which points nowhere
      -- near the cause, so they are set explicitly.
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid,
      'authenticated', 'authenticated', v_email,
      crypt(p_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      false, false,
      '', '', '', '', '', '', '', ''
    );
  elsif p_password is not null then
    -- Re-adding an address that already has an account sets a new
    -- password, which is also how a forgotten one is recovered.
    update auth.users set
      encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
    where id = uid;
  end if;

  -- Email sign-in needs a matching identity row.
  if not exists (
    select 1 from auth.identities where user_id = uid and provider = 'email'
  ) then
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid,
      jsonb_build_object('sub', uid::text, 'email', v_email,
                         'email_verified', true),
      'email', v_email, now(), now(), now()
    );
  end if;

  insert into public.profiles (id, display_name, role)
  values (uid, v_name, p_role)
  on conflict (id) do update
    set display_name = excluded.display_name,
        role         = excluded.role;

  return uid;
end
$$;

revoke all on function private.write_rep(text, text, text, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- What an owner may call
-- ---------------------------------------------------------------------
create or replace function public.add_rep(
  p_email    text,
  p_password text,
  p_name     text,
  p_role     text default 'rep'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;
  return private.write_rep(p_email, p_password, p_name, p_role);
end
$$;

comment on function public.add_rep(text, text, text, text) is
  'Owner only. Creates a rep account, or resets the password of one that exists.';

-- Display names are shown to the whole class on every card, but an email
-- address is not the class business, so the list that carries addresses is
-- gated rather than read from the table.
create or replace function public.list_people()
returns table (
  id              uuid,
  display_name    text,
  role            text,
  email           text,
  created_at      timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;

  return query
    select p.id, p.display_name, p.role, u.email::text,
           p.created_at, u.last_sign_in_at
    from public.profiles p
    join auth.users u on u.id = p.id
    order by (p.role = 'owner') desc, p.created_at;
end
$$;

-- Removing the grant and removing the account are one gesture here: an
-- account with no profile row is a login nobody can see and nobody can
-- use, and leaving those behind is how a list of half-reps accumulates.
create or replace function public.remove_rep(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;
  if p_id = auth.uid() then
    raise exception 'self_remove';
  end if;

  select role into v_role from public.profiles where id = p_id;
  if v_role is null then
    raise exception 'not_found';
  end if;
  if v_role = 'owner'
     and (select count(*) from public.profiles where role = 'owner') <= 1 then
    raise exception 'last_owner';
  end if;

  -- profiles.id cascades from auth.users, so this clears both.
  delete from auth.users where id = p_id;
end
$$;

create or replace function public.set_rep_role(p_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;
  if p_role not in ('rep', 'owner') then
    raise exception 'bad_role';
  end if;
  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'not_found';
  end if;

  -- An app with no owner left can never add anyone again, and no client
  -- can repair that; only the dashboard could.
  if p_role = 'rep'
     and exists (
       select 1 from public.profiles where id = p_id and role = 'owner'
     )
     and (select count(*) from public.profiles where role = 'owner') <= 1 then
    raise exception 'last_owner';
  end if;

  update public.profiles set role = p_role where id = p_id;
end
$$;

-- Separate from add_rep so the interface can offer a reset without asking
-- again for a name and role it already knows.
create or replace function public.set_rep_password(p_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not private.is_owner() then
    raise exception 'not_owner';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'weak_password';
  end if;
  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'not_found';
  end if;

  update auth.users set
    encrypted_password = crypt(p_password, gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = p_id;
end
$$;

-- Students are `anon` and must not see any of this. The owner check runs
-- inside every function, so granting `authenticated` grants nothing to a
-- signed-in rep who is not an owner.
revoke all on function public.add_rep(text, text, text, text)  from public, anon;
revoke all on function public.list_people()                    from public, anon;
revoke all on function public.remove_rep(uuid)                 from public, anon;
revoke all on function public.set_rep_role(uuid, text)         from public, anon;
revoke all on function public.set_rep_password(uuid, text)     from public, anon;

grant execute on function public.add_rep(text, text, text, text) to authenticated;
grant execute on function public.list_people()                   to authenticated;
grant execute on function public.remove_rep(uuid)                to authenticated;
grant execute on function public.set_rep_role(uuid, text)        to authenticated;
grant execute on function public.set_rep_password(uuid, text)    to authenticated;
