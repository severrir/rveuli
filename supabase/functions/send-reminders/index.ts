/**
 * send-reminders — the 19:00 Asia/Tbilisi push.
 *
 * Counts tomorrow's homework and sends one short notification to every
 * subscribed device. Subscriptions are anonymous, so there is nothing to
 * personalise: the message says how much is due, not who owes it.
 *
 * Deploy:  supabase functions deploy send-reminders --no-verify-jwt
 * Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... \
 *            VAPID_SUBJECT=mailto:you@example.com
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

/** Start and end of tomorrow in Tbilisi, as UTC instants. */
function tomorrowWindow() {
  const now = new Date();
  const tbilisiNow = new Date(now.getTime() + 4 * 3600_000);
  const start = Date.UTC(
    tbilisiNow.getUTCFullYear(),
    tbilisiNow.getUTCMonth(),
    tbilisiNow.getUTCDate() + 1,
  ) - 4 * 3600_000;
  return { from: new Date(start), to: new Date(start + 86_400_000) };
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { from, to } = tomorrowWindow();

  const { data: due, error } = await supabase
    .from("homework")
    .select("id, subject")
    .is("deleted_at", null)
    .gte("due_at", from.toISOString())
    .lt("due_at", to.toISOString());

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Nothing due means no notification. An app that pings you to say there
  // is nothing to do gets its notifications turned off within a week.
  if (!due || due.length === 0) {
    return Response.json({ sent: 0, reason: "nothing due tomorrow" });
  }

  const count = due.length;
  const payload = JSON.stringify({
    title: "რვეული",
    body:
      count === 1
        ? "ხვალისთვის ერთი დავალება გაქვს."
        : `ხვალისთვის ${count} დავალება გაქვს.`,
    url: "/",
  });

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .is("failed_at", null);

  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        // 404/410 mean the browser threw the subscription away for good.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
      }
    }),
  );

  if (dead.length > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ failed_at: new Date().toISOString() })
      .in("id", dead);
  }

  return Response.json({ sent, due: count, retired: dead.length });
});
