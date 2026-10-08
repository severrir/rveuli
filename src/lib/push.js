/**
 * Evening reminders.
 *
 * A scheduled function sends one push at 19:00 Tbilisi listing what is due
 * tomorrow. Subscriptions are anonymous — an endpoint and its keys, with no
 * name or account attached — because students never sign in.
 *
 * iOS only delivers Web Push to a site that has been added to the Home
 * Screen (iOS 16.4+). A good share of the class is on iPhone, so the UI
 * detects that case and asks for the install rather than showing a
 * permission prompt that Safari will silently refuse.
 */

import { supabase, isSupabaseConfigured } from "./supabase.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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

/** Returns true once the device is subscribed and stored. */
export async function enableReminders() {
  if (!isPushSupported()) return false;
  if (!VAPID_PUBLIC_KEY || !isSupabaseConfigured) {
    throw new Error("შეხსენებები ჯერ არ არის ჩართული სერვერზე.");
  }

  const result = await Notification.requestPermission();
  if (result !== "granted") return false;

  const registration =
    (await navigator.serviceWorker.getRegistration()) ??
    (await registerServiceWorker());
  if (!registration) return false;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;

  return true;
}

export async function disableReminders() {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  const { endpoint } = subscription.toJSON();
  await subscription.unsubscribe();
  if (isSupabaseConfigured) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  }
}

export async function isSubscribed() {
  if (!isPushSupported() || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker.getRegistration();
  return Boolean(await registration?.pushManager.getSubscription());
}
