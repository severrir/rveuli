-- The evening reminder: one push at 19:00 Asia/Tbilisi listing what is due
-- tomorrow. Georgia is UTC+4 with no daylight saving, so 19:00 local is
-- always 15:00 UTC and the schedule never needs adjusting.
--
-- Run this only after deploying the `send-reminders` edge function and
-- setting the two settings below.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Replace both values, then run this block.
--   project_url: https://<ref>.supabase.co
--   service_key: the service_role key (server-side only, never in the app)
do $$
declare
  project_url text := 'https://REPLACE_ME.supabase.co';
  service_key text := 'REPLACE_ME';
begin
  perform cron.unschedule('rveuli-evening-reminder')
  where exists (select 1 from cron.job where jobname = 'rveuli-evening-reminder');

  perform cron.schedule(
    'rveuli-evening-reminder',
    '0 15 * * 0-5',  -- 15:00 UTC = 19:00 Tbilisi, Sun–Fri (the eve of each school day)
    format(
      $job$
      select net.http_post(
        url     := %L,
        headers := jsonb_build_object(
                     'Content-Type',  'application/json',
                     'Authorization', 'Bearer %s'
                   ),
        body    := '{}'::jsonb
      );
      $job$,
      project_url || '/functions/v1/send-reminders',
      service_key
    )
  );
end
$$;
