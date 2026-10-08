/**
 * send-reminders — the evening nudge for რვეული.
 *
 * Invoked hourly by pg_cron. Each subscribed device stores the hour it
 * wants to hear from us, so the job wakes every hour and only sends to the
 * devices whose hour matches the current Tbilisi clock.
 *
 * The VAPID keypair is generated here on first run and the private half is
 * kept in Supabase Vault, so the signing key is never pasted into a config
 * file, a commit, or a chat window. GET ?action=key returns the public
 * half, which is meant to be public and ships in the client bundle.
 *
 * Deploy: handled by the Supabase MCP / CLI. No secrets to set by hand.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUBJECT = "mailto:rveuli@example.com";

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);

/** Tbilisi is UTC+4 all year — Georgia has not observed DST since 2005. */
const TBILISI_OFFSET_MS = 4 * 3600_000;
const tbilisiNow = () => new Date(Date.now() + TBILISI_OFFSET_MS);

async function secret(sb: ReturnType<typeof admin>, name: string) {
  const { data } = await sb.rpc("read_app_secret", { secret_name: name });
  return (data as string | null) ?? null;
}

/** Returns the VAPID pair, creating and storing it the first time. */
async function vapid(sb: ReturnType<typeof admin>) {
  let publicKey = await secret(sb, "VAPID_PUBLIC_KEY");
  let privateKey = await secret(sb, "VAPID_PRIVATE_KEY");

  if (!publicKey || !privateKey) {
    const generated = webpush.generateVAPIDKeys();
    publicKey = generated.publicKey;
    privateKey = generated.privateKey;
    await sb.rpc("write_app_secret", {
      secret_name: "VAPID_PUBLIC_KEY",
      secret_value: publicKey,
    });
    await sb.rpc("write_app_secret", {
      secret_name: "VAPID_PRIVATE_KEY",
      secret_value: privateKey,
    });
  }

  return { publicKey, privateKey };
}

/** Start and end of tomorrow in Tbilisi, as UTC instants. */
function tomorrowWindow() {
  const t = tbilisiNow();
  const startMs =
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() + 1) -
    TBILISI_OFFSET_MS;
  return {
    from: new Date(startMs).toISOString(),
    to: new Date(startMs + 86_400_000).toISOString(),
  };
}

const plural = (n: number) =>
  n === 1 ? "ერთი დავალება" : `${n} დავალება`;

Deno.serve(async (req) => {
  const sb = admin();
  const url = new URL(req.url);

  // The client needs the public key to subscribe a browser.
  if (req.method === "GET" && url.searchParams.get("action") === "key") {
    const { publicKey } = await vapid(sb);
    return Response.json(
      { publicKey },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  const { publicKey, privateKey } = await vapid(sb);
  webpush.setVapidDetails(SUBJECT, publicKey, privateKey);

  const now = tbilisiNow();
  const hour = now.getUTCHours();
  const weekday = now.getUTCDay(); // 0 = Sunday

  // Tomorrow is a school day unless tonight is Saturday (tomorrow Sunday).
  const tomorrowIsSchoolDay = weekday !== 6;

  const { from, to } = tomorrowWindow();
  const { data: due, error } = await sb
    .from("homework")
    .select("id")
    .is("deleted_at", null)
    .gte("due_at", from)
    .lt("due_at", to);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const count = due?.length ?? 0;

  // An app that pings you to say there is nothing to do gets muted.
  if (count === 0) {
    return Response.json({ sent: 0, hour, reason: "nothing due tomorrow" });
  }

  let query = sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, school_nights_only")
    .eq("remind_hour", hour)
    .is("failed_at", null);

  const { data: subs } = await query;

  const targets = (subs ?? []).filter(
    (s) => !s.school_nights_only || tomorrowIsSchoolDay,
  );

  const payload = JSON.stringify({
    title: "რვეული",
    body: `ხვალისთვის ${plural(count)} გაქვს.`,
    url: "/",
  });

  let sent = 0;
  const dead: string[] = [];

  await Promise.all(
    targets.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (err) {
        // 404 and 410 mean the browser discarded the subscription for good.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
      }
    }),
  );

  if (dead.length > 0) {
    await sb
      .from("push_subscriptions")
      .update({ failed_at: new Date().toISOString() })
      .in("id", dead);
  }

  return Response.json({
    sent,
    hour,
    due: count,
    candidates: targets.length,
    retired: dead.length,
  });
});
