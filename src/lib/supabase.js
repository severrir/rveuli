import { createClient } from "@supabase/supabase-js";

/**
 * Supabase is optional at build time.
 *
 * With no credentials the app runs fully on seed data and a local demo
 * sign-in, so the board can be reviewed and demoed before any backend
 * exists. The moment VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set,
 * every read and write goes to the real project instead — no other code
 * changes. See README.md for the two values and where to get them.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Students never sign in; only reps hold a session.
        storageKey: "rveuli.auth",
      },
    })
  : null;

export const STORAGE_BUCKET = "homework-files";
