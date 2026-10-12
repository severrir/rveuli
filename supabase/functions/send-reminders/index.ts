/**
 * send-reminders — the notifications რვეული sends.
 *
 * **The evening digest.** Invoked hourly by pg_cron. Each subscribed device
 * stores the hour it wants to hear from us, so the job wakes every hour and
 * only sends to the devices whose hour matches the current Tbilisi clock.
 *
 * **"A წერა has been set"** and **"an ევენთი has been added"**.
 * Invoked by a trigger on `public.tests` / `public.events` the moment a rep
 * saves one, with `{ action: "announce-test" | "announce-event", id }`.
 * Neither is on a schedule — they are news, and only worth anything while
 * they are new.
 *
 * The VAPID keypair is generated here on first run and the private half
 * lives in Supabase Vault, so the signing key is never pasted into a
 * config file, a commit, or a chat window. GET ?action=key returns the
 * public half, which is meant to be public and ships in the bundle.
 *
 * Sending requires the x-cron-key header, also generated in the database,
 * so the anon key alone cannot be used to fire notifications at the class.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUBJECT = "mailto:rveuli@example.com";

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);
type Admin = ReturnType<typeof admin>;

/** Tbilisi is UTC+4 all year — Georgia has not observed DST since 2005. */
const TBILISI_OFFSET_MS = 4 * 3600_000;
const tbilisiNow = () => new Date(Date.now() + TBILISI_OFFSET_MS);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * The Georgian the student reads.
 *
 * Duplicated from the client's own modules rather than imported: an edge
 * function cannot reach into the bundle, and the ids are already written
 * out a third time in each table's CHECK constraint. Adding a subject or a
 * kind means touching all three.
 */
const SUBJECT_NAMES: Record<string, string> = {
  math: "მათემატიკა",
  physics: "ფიზიკა",
  chemistry: "ქიმია",
  biology: "ბიოლოგია",
  geography: "გეოგრაფია",
  history: "ისტორია",
  "geo-lang": "ქართული ენა",
  "geo-lit": "ქართული ლიტერატურა",
  english: "ინგლისური",
  german: "გერმანული",
  civics: "სამოქალაქო განათლება",
  art: "ხელოვნება",
  music: "მუსიკა",
  sport: "სპორტი",
};

const EVENT_KIND_NAMES: Record<string, string> = {
  excursion: "ექსკურსია",
  olympiad: "ოლიმპიადა",
  meeting: "შეხვედრა",
  concert: "კონცერტი",
  sport: "სპორტული",
  party: "კლასის საღამო",
  holiday: "დასვენება",
  other: "ევენთი",
};

const KIND_NAMES: Record<string, string> = {
  dictation: "კარნახი",
  quiz: "ტესტი",
  oral: "ზეპირი გამოკითხვა",
  control: "საკონტროლო",
  summary: "შემაჯამებელი",
  exam: "გამოცდა",
};

/** Locative: "written ON Thursday" — ხუთშაბათს. 0 = Sunday, as getUTCDay. */
const WEEKDAYS_LOCATIVE = [
  "კვირას",
  "ორშაბათს",
  "სამშაბათს",
  "ოთხშაბათს",
  "ხუთშაბათს",
  "პარასკევს",
  "შაბათს",
];

const MONTHS = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

async function secret(sb: Admin, name: string) {
  const { data } = await sb.rpc("read_app_secret", { secret_name: name });
  return (data as string | null) ?? null;
}

/** Returns the VAPID pair, creating and storing it the first time. */
async function vapid(sb: Admin) {
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

const plural = (n: number) => (n === 1 ? "ერთი დავალება" : `${n} დავალება`);

type Target = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Sends one payload to many devices and retires the endpoints the browser
 * has permanently discarded. Shared by every notification so none can
 * drift into leaking dead subscriptions.
 */
async function deliver(sb: Admin, targets: Target[], payload: string) {
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

  return { sent, retired: dead.length };
}

/** "ხუთშაბათს, 16 ოქტომბერი" — the day, in Tbilisi. */
function whenText(iso: string) {
  const local = new Date(new Date(iso).getTime() + TBILISI_OFFSET_MS);
  return `${WEEKDAYS_LOCATIVE[local.getUTCDay()]}, ${local.getUTCDate()} ${
    MONTHS[local.getUTCMonth()]
  }`;
}

/** "08:00" in Tbilisi. */
function clockText(iso: string) {
  const local = new Date(new Date(iso).getTime() + TBILISI_OFFSET_MS);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(
    local.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

/**
 * Announces a newly set test.
 *
 * Goes to every device that left announcements on, whatever hour it chose
 * for the digest — the hour is a preference about the nightly summary, not
 * about news. `school_nights_only` is likewise not consulted: it answers
 * "is tomorrow a school day", which has nothing to say about a test three
 * weeks out.
 */
async function announceTest(sb: Admin, id: string) {
  if (!id) {
    return Response.json({ error: "missing id" }, { status: 400, headers: CORS });
  }

  const { data: test, error } = await sb
    .from("tests")
    .select("id, subject, kind, topics, written_at, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS });
  }
  // Deleted between the insert and this call: the trigger fires after the
  // row lands, and a rep who immediately took it back meant it.
  if (!test || test.deleted_at) {
    return Response.json({ sent: 0, reason: "no such test" }, { headers: CORS });
  }

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("announce_tests", true)
    .is("failed_at", null);

  const targets = (subs ?? []) as Target[];

  const subjectName = SUBJECT_NAMES[test.subject] ?? test.subject;
  const kindName = KIND_NAMES[test.kind] ?? "წერა";

  const payload = JSON.stringify({
    title: `${subjectName} — ${kindName}`,
    body: `${whenText(test.written_at)} · ${test.topics}`,
    // Relative, so it resolves against the worker's own scope and keeps
    // working on a GitHub Pages project site served from /<repo>/.
    url: "./?view=tests",
    // Its own tag: a test announcement must not replace an unread digest.
    tag: `rveuli-test-${test.id}`,
  });

  const { sent, retired } = await deliver(sb, targets, payload);

  return Response.json(
    { announced: test.id, sent, candidates: targets.length, retired },
    { headers: CORS },
  );
}

/**
 * Announces a newly added event.
 *
 * Leads with when and where, because that is what the notification is
 * for: an excursion nobody knows the meeting point of is not announced.
 */
async function announceEvent(sb: Admin, id: string) {
  if (!id) {
    return Response.json({ error: "missing id" }, { status: 400, headers: CORS });
  }

  const { data: event, error } = await sb
    .from("events")
    .select("id, title, kind, location, starts_at, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS });
  }
  if (!event || event.deleted_at) {
    return Response.json({ sent: 0, reason: "no such event" }, { headers: CORS });
  }

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("announce_events", true)
    .is("failed_at", null);

  const targets = (subs ?? []) as Target[];

  const when = `${whenText(event.starts_at)}, ${clockText(event.starts_at)}`;

  const payload = JSON.stringify({
    title: EVENT_KIND_NAMES[event.kind] ?? "ევენთი",
    body: event.location
      ? `${event.title} · ${when} · ${event.location}`
      : `${event.title} · ${when}`,
    url: "./?view=events",
    tag: `rveuli-event-${event.id}`,
  });

  const { sent, retired } = await deliver(sb, targets, payload);

  return Response.json(
    { announced: event.id, sent, candidates: targets.length, retired },
    { headers: CORS },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const sb = admin();
  const url = new URL(req.url);

  // The client needs the public key in order to subscribe a browser.
  if (req.method === "GET" && url.searchParams.get("action") === "key") {
    const { publicKey } = await vapid(sb);
    return Response.json({ publicKey }, { headers: CORS });
  }

  // Everything below actually sends notifications.
  const expected = await secret(sb, "CRON_INVOKE_KEY");
  const provided = req.headers.get("x-cron-key");
  if (!expected || provided !== expected) {
    return Response.json({ error: "forbidden" }, { status: 403, headers: CORS });
  }

  const { publicKey, privateKey } = await vapid(sb);
  webpush.setVapidDetails(SUBJECT, publicKey, privateKey);

  // The cron job posts '{}', the triggers post an action.
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  if (body.action === "announce-test") {
    return await announceTest(sb, String(body.id ?? ""));
  }

  if (body.action === "announce-event") {
    return await announceEvent(sb, String(body.id ?? ""));
  }

  /* ---- The evening digest ----------------------------------------- */

  const dryRun = url.searchParams.get("dry") === "1";
  const hourOverride = url.searchParams.get("hour");

  const now = tbilisiNow();
  const hour = hourOverride !== null ? Number(hourOverride) : now.getUTCHours();
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
    return Response.json({ error: error.message }, { status: 500, headers: CORS });
  }

  const count = due?.length ?? 0;

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, school_nights_only")
    .eq("remind_hour", hour)
    .is("failed_at", null);

  const targets = ((subs ?? []) as (Target & { school_nights_only: boolean })[])
    .filter((s) => !s.school_nights_only || tomorrowIsSchoolDay);

  // An app that pings you to say there is nothing to do gets muted.
  if (count === 0) {
    return Response.json(
      {
        sent: 0,
        hour,
        due: 0,
        candidates: targets.length,
        reason: "nothing due tomorrow",
      },
      { headers: CORS },
    );
  }

  if (dryRun) {
    return Response.json(
      {
        dryRun: true,
        hour,
        due: count,
        candidates: targets.length,
        tomorrowIsSchoolDay,
      },
      { headers: CORS },
    );
  }

  const payload = JSON.stringify({
    title: "რვეული",
    body: `ხვალისთვის ${plural(count)} გაქვს.`,
    url: "./",
    tag: "rveuli-daily",
  });

  const { sent, retired } = await deliver(sb, targets, payload);

  return Response.json(
    { sent, hour, due: count, candidates: targets.length, retired },
    { headers: CORS },
  );
});
