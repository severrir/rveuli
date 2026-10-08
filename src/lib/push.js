/**
 * Evening reminders.
 *
 * A scheduled function wakes every hour and notifies the devices whose
 * chosen hour has come, saying how much is due tomorrow.
 *
 * Subscriptions are anonymous — an endpoint and its keys, no name, no
 * account — because students never sign in. That is also why the settings
 * live on the subscription row rather than against a user, and are
 * mirrored into localStorage so they survive turning reminders off and on.
 *
 * iOS only delivers Web Push to a site added to the Home Screen
 * (iOS 16.4+), so the UI asks for the install first rather than firing a
 * permission prompt Safari will silently refuse.
 */

import { supabase, isSupabaseConfigured } from "./supabase.js";

const SETTINGS_KEY = "rveuli.reminders.v1";

export const DEFAULT_SETTINGS = {
  hour: 19,
  schoolNightsOnly: true,
};

/** Hours a student might plausibly want to be reminded. */
export const HOUR_CHOICES = [15, 16, 17, 18, 19, 20, 21, 22];

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS 13+ reports as a Mac, but has a touch screen.
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

export const permission = () =>
  isPushSupported() ? Notification.permission : "unsupported";

/**
 * Reminders need a backend to send them. The signing key now lives on the
 * server and is fetched when subscribing, so there is no client-side key
 * to check — only whether there is a project at all.
 */
export const isPushConfigured = () => isSupabaseConfigured;

export function readSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
      : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The choice still applies for this session.
  }
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // BASE_URL is "/" locally and "/<repo>/" on a GitHub Pages project site.
    const base = import.meta.env.BASE_URL;
    return await navigator.serviceWorker.register(`${base}sw.js`, {
      scope: base,
    });
  } catch (err) {
    console.error("[რვეული] service worker registration failed", err);
    return null;
  }
}

function urlBase64ToUint8Array(base64) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * The server owns the VAPID keypair and hands out the public half, so the
 * key is never copied into the client build where it could drift out of
 * sync with the private half that signs the messages.
 */
let cachedKey = null;
async function publicKey() {
  if (cachedKey) return cachedKey;
  const { data, error } = await supabase.functions.invoke(
    "send-reminders?action=key",
    { method: "GET" },
  );
  if (error || !data?.publicKey) {
    throw new Error("შეხსენებების გასაღები ვერ მივიღე.");
  }
  cachedKey = data.publicKey;
  return cachedKey;
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function isSubscribed() {
  if (!isPushSupported() || Notification.permission !== "granted") return false;
  return Boolean(await currentSubscription());
}

/** Turn reminders on. Returns true once the device is subscribed. */
export async function enableReminders(settings = readSettings()) {
  if (!isPushSupported()) return false;
  if (!isPushConfigured()) {
    throw new Error("შეხსენებები ჯერ არ არის ჩართული სერვერზე.");
  }

  const result = await Notification.requestPermission();
  if (result !== "granted") return false;

  const registration =
    (await navigator.serviceWorker.getRegistration()) ??
    (await registerServiceWorker());
  if (!registration) return false;

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(await publicKey()),
    }));

  await saveSubscription(subscription, settings);
  writeSettings(settings);
  return true;
}

/**
 * Written through an RPC rather than straight to the table: the table has
 * no SELECT policy, by design, so an upsert cannot read the row it would
 * conflict with. The function touches exactly one endpoint and returns
 * nothing, so it cannot be used to enumerate who is subscribed.
 */
async function saveSubscription(subscription, settings) {
  const json = subscription.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_hour: settings.hour,
    p_school_only: settings.schoolNightsOnly,
  });
  if (error) throw error;
}

/** Change the schedule without asking for permission again. */
export async function updateSettings(settings) {
  writeSettings(settings);

  const subscription = await currentSubscription();
  if (!subscription || !isPushConfigured()) return;

  await saveSubscription(subscription, settings);
}

/** Turn reminders off and forget this device server-side. */
export async function disableReminders() {
  if (!isPushSupported()) return;
  const subscription = await currentSubscription();
  if (!subscription) return;

  const { endpoint } = subscription.toJSON();
  await subscription.unsubscribe();
  if (isPushConfigured()) {
    await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  }
}
