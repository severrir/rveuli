/**
 * Rep sign-in.
 *
 * Students never authenticate — they open the link and read. Only the class
 * reps hold an account, and their write access is granted by a row in
 * `profiles`, checked server-side by row-level security. Nothing in this
 * file is a permission check; it only decides what the interface offers.
 *
 * Without Supabase configured, a local demo session stands in so the rep
 * tools can be reviewed. It touches only this browser and grants nothing.
 */

import { supabase, isSupabaseConfigured } from "./supabase.js";
import { REPS } from "../data/mockHomework.js";

const DEMO_KEY = "rveuli.demo-session";
export const DEMO_PASSWORD = "demo";

/** Demo accounts, used only when no Supabase project is attached. */
const DEMO_ACCOUNTS = REPS.map((rep, i) => ({
  ...rep,
  email: ["nino", "giorgi", "mariam"][i] + "@skola4.ge",
}));

export const DEMO_EMAILS = DEMO_ACCOUNTS.map((a) => a.email);

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

let demoSession = readDemoSession();

function readDemoSession() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function onAuthChange(fn) {
  listeners.add(fn);
  let unsub = () => {};
  if (isSupabaseConfigured) {
    const { data } = supabase.auth.onAuthStateChange(() => fn());
    unsub = () => data.subscription.unsubscribe();
  }
  return () => {
    listeners.delete(fn);
    unsub();
  };
}

/** The signed-in rep, or null for a student. */
export async function getCurrentRep() {
  if (!isSupabaseConfigured) return demoSession;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  // Presence in `profiles` is what makes an account a rep. A signed-in user
  // without a profile row can read, like anyone else, and write nothing.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile) return null;
  return {
    id: profile.id,
    display_name: profile.display_name,
    role: profile.role,
  };
}

export async function signIn(email, password) {
  const address = email.trim().toLowerCase();

  if (!isSupabaseConfigured) {
    const account = DEMO_ACCOUNTS.find((a) => a.email === address);
    if (!account || password !== DEMO_PASSWORD) {
      throw new Error("ელფოსტა ან პაროლი არ ემთხვევა.");
    }
    demoSession = {
      id: account.id,
      display_name: account.display_name,
      role: account.role,
    };
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(demoSession));
    } catch {
      // Session lives for this tab only; signing in still works.
    }
    emit();
    return demoSession;
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: address,
    password,
  });
  if (error) throw new Error("ელფოსტა ან პაროლი არ ემთხვევა.");

  const rep = await getCurrentRep();
  if (!rep) {
    await supabase.auth.signOut();
    throw new Error("ამ ანგარიშს დავალებების დამატება არ შეუძლია.");
  }
  emit();
  return rep;
}

export async function signOut() {
  if (!isSupabaseConfigured) {
    demoSession = null;
    try {
      localStorage.removeItem(DEMO_KEY);
    } catch {
      // Nothing to clear.
    }
    emit();
    return;
  }
  await supabase.auth.signOut();
  emit();
}
