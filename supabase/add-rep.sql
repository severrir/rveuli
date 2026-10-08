-- Add a class rep (ADMIN) to რვეული.
--
-- Change the two values below, then run the whole file in the Supabase SQL
-- editor: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- What makes someone a rep is the row in public.profiles, not the account.
-- An auth user with no profile row can read the board like any student and
-- write nothing, so adding and removing reps is just adding and removing
-- that row.
--
-- Running this again for the same email resets that rep's password, which
-- is also how you recover a forgotten one.

do $$
declare
  -- ---- change these two -------------------------------------------
  new_email text := 'giorgi@example.com';
  new_pass  text := 'change-this-to-something-long';
  new_name  text := 'გიორგი';   -- shown as "დაამატა გიორგიმ" on each card
  new_role  text := 'rep';      -- 'rep', or 'owner' for a full admin
  -- -----------------------------------------------------------------
  uid uuid;
begin
  if length(new_pass) < 12 then
    raise exception 'Choose a password of at least 12 characters.';
  end if;

  select id into uid from auth.users where email = lower(trim(new_email));

  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
      -- GoTrue reads these into non-nullable strings. Left NULL, sign-in
      -- fails with "Database error querying schema" and the cause is not
      -- obvious from the error, so they are set explicitly here.
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid,
      'authenticated', 'authenticated', lower(trim(new_email)),
      crypt(new_pass, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      false, false,
      '', '', '', '', '', '', '', ''
    );
  else
    update auth.users set
      encrypted_password = crypt(new_pass, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now(),
      confirmation_token         = coalesce(confirmation_token, ''),
      recovery_token             = coalesce(recovery_token, ''),
      email_change               = coalesce(email_change, ''),
      email_change_token_new     = coalesce(email_change_token_new, ''),
      email_change_token_current = coalesce(email_change_token_current, ''),
      phone_change               = coalesce(phone_change, ''),
      phone_change_token         = coalesce(phone_change_token, ''),
      reauthentication_token     = coalesce(reauthentication_token, '')
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
      jsonb_build_object('sub', uid::text, 'email', lower(trim(new_email)),
                         'email_verified', true),
      'email', lower(trim(new_email)), now(), now(), now()
    );
  end if;

  -- This row is the actual grant.
  insert into public.profiles (id, display_name, role)
  values (uid, new_name, new_role)
  on conflict (id) do update
    set display_name = excluded.display_name,
        role         = excluded.role;

  raise notice 'Rep ready: % (%).', new_email, new_name;
end
$$;

-- Who can post right now:
select p.display_name, p.role, u.email, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
order by p.created_at;
