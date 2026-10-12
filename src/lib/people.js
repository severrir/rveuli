/**
 * Adding and removing the people who may post.
 *
 * The grant itself is a row in `profiles`; this file is only the way to ask
 * for one. Every call lands on a database function that checks the caller
 * is an `owner` before it writes, so nothing here is a permission check —
 * refusing in the interface is a courtesy, not the defence. See
 * supabase/migrations/0004_people.sql.
 *
 * Creating an account needs the auth tables, which no browser may touch,
 * so these are RPCs rather than table writes. The errors they raise are
 * short tokens; the Georgian the owner reads is assembled here.
 */

import { supabase, isSupabaseConfigured } from "./supabase.js";
import { REPS } from "../data/mockHomework.js";
import { DEMO_EMAILS, DEMO_PASSWORD } from "./auth.js";

/** Matches the check inside the database functions. */
export const MIN_PASSWORD = 8;

const MESSAGES = {
  not_owner: "ამის უფლება მხოლოდ ადმინისტრატორს აქვს.",
  bad_email: "ელფოსტა არასწორად არის ჩაწერილი.",
  bad_name: "სახელი 1-დან 40 სიმბოლომდე უნდა იყოს.",
  bad_role: "ასეთი როლი არ არსებობს.",
  weak_password: `პაროლი სულ მცირე ${MIN_PASSWORD} სიმბოლო უნდა იყოს.`,
  password_required: "ახალ ანგარიშს პაროლი სჭირდება.",
  self_remove: "საკუთარ თავს ვერ წაშლი.",
  last_owner: "ერთი ადმინისტრატორი მაინც უნდა დარჩეს.",
  not_found: "ეს ანგარიში ვერ მოიძებნა.",
};

/**
 * PostgREST wraps the raised token in its own message, so the token is
 * looked for inside it rather than compared to it.
 */
function translate(error) {
  const raw = error?.message ?? "";
  for (const [token, text] of Object.entries(MESSAGES)) {
    if (raw.includes(token)) return new Error(text);
  }
  return new Error("ვერ შევასრულე. სცადე ხელახლა.");
}

/**
 * A password the owner can read out over the phone: no ambiguous
 * characters, no shift key, and long enough to survive the check.
 */
export function suggestPassword() {
  const parts = ["ba", "te", "ni", "ko", "ra", "mu", "si", "lo", "da", "ve",
                 "zu", "pi", "ta", "no", "ka", "re"];
  const bytes = new Uint8Array(5);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Without it, every "suggestion" would be the same string, which is
    // worse than a weaker random one.
    for (let i = 0; i < bytes.length; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  const pick = (i) => parts[bytes[i] % parts.length];
  const digits = String(100 + (bytes[4] % 900));
  return `${pick(0)}${pick(1)}-${pick(2)}${pick(3)}-${digits}`;
}

/* ---------------------------------------------------------------- *
 * Local mode — no project attached
 * ---------------------------------------------------------------- */

// Mirrors what the database would hold, so the owner tools can be reviewed
// end to end before a backend exists. It lives for the page, not longer.
let localPeople = REPS.map((rep, i) => ({
  id: rep.id,
  display_name: rep.display_name,
  role: rep.role,
  email: DEMO_EMAILS[i],
  created_at: new Date(Date.now() - (REPS.length - i) * 86400000).toISOString(),
  last_sign_in_at: null,
}));

function localFail(token) {
  throw new Error(MESSAGES[token]);
}

const ownerCount = () => localPeople.filter((p) => p.role === "owner").length;

/* ---------------------------------------------------------------- *
 * The interface the sheet calls
 * ---------------------------------------------------------------- */

/** Everyone who may post, owners first. Owner only. */
export async function listPeople() {
  if (!isSupabaseConfigured) return [...localPeople];

  const { data, error } = await supabase.rpc("list_people");
  if (error) throw translate(error);
  return data ?? [];
}

/**
 * Add someone, or set a new password for an address that already has an
 * account — the same call, because for the owner it is the same intent:
 * "this person should be able to post, with this password".
 */
export async function addPerson({ email, password, displayName, role = "rep" }) {
  const address = email.trim().toLowerCase();
  const name = displayName.trim();

  if (!isSupabaseConfigured) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) localFail("bad_email");
    if (name.length < 1 || name.length > 40) localFail("bad_name");
    if (password.length < MIN_PASSWORD) localFail("weak_password");

    const existing = localPeople.find((p) => p.email === address);
    if (existing) {
      existing.display_name = name;
      existing.role = role;
      return existing.id;
    }
    const person = {
      id: `rep-${address.split("@")[0]}`,
      display_name: name,
      role,
      email: address,
      created_at: new Date().toISOString(),
      last_sign_in_at: null,
    };
    localPeople = [...localPeople, person];
    return person.id;
  }

  const { data, error } = await supabase.rpc("add_rep", {
    p_email: address,
    p_password: password,
    p_name: name,
    p_role: role,
  });
  if (error) throw translate(error);
  return data;
}

/** Removes the grant and the account together. Owner only. */
export async function removePerson(id, selfId) {
  if (!isSupabaseConfigured) {
    if (id === selfId) localFail("self_remove");
    const person = localPeople.find((p) => p.id === id);
    if (!person) localFail("not_found");
    if (person.role === "owner" && ownerCount() <= 1) localFail("last_owner");
    localPeople = localPeople.filter((p) => p.id !== id);
    return;
  }

  const { error } = await supabase.rpc("remove_rep", { p_id: id });
  if (error) throw translate(error);
}

export async function setRole(id, role) {
  if (!isSupabaseConfigured) {
    const person = localPeople.find((p) => p.id === id);
    if (!person) localFail("not_found");
    if (role === "rep" && person.role === "owner" && ownerCount() <= 1) {
      localFail("last_owner");
    }
    person.role = role;
    return;
  }

  const { error } = await supabase.rpc("set_rep_role", {
    p_id: id,
    p_role: role,
  });
  if (error) throw translate(error);
}

export async function setPassword(id, password) {
  if (!isSupabaseConfigured) {
    if (password.length < MIN_PASSWORD) localFail("weak_password");
    if (!localPeople.some((p) => p.id === id)) localFail("not_found");
    return;
  }

  const { error } = await supabase.rpc("set_rep_password", {
    p_id: id,
    p_password: password,
  });
  if (error) throw translate(error);
}

/** The line an owner sends the new rep. Kept here so both sheets agree. */
export function signInNote({ email, password }) {
  const url =
    typeof window === "undefined" ? "" : window.location.origin + window.location.pathname;
  return [
    "რვეული — კლასის უფროსის შესვლა",
    url,
    `ელფოსტა: ${email}`,
    `პაროლი: ${password || DEMO_PASSWORD}`,
  ].join("\n");
}
