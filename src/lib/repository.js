/**
 * One interface over two backends.
 *
 * The UI only ever calls these functions. When Supabase is configured they
 * hit Postgres with row-level security doing the real authorisation; when it
 * is not, they operate on the seed data in memory so the board still works
 * end to end. Keeping both behind the same shape is what makes wiring the
 * backend a configuration change rather than a rewrite.
 */

import { supabase, isSupabaseConfigured, STORAGE_BUCKET } from "./supabase.js";
import { MOCK_HOMEWORK, REPS } from "../data/mockHomework.js";

const COLUMNS =
  "id, subject, title, details, due_at, is_pinned, link_url, attachments, created_by, created_at, updated_at, deleted_at, profiles(display_name)";

/** Database row → the shape the components expect. */
function normalize(row) {
  return {
    id: row.id,
    subject: row.subject,
    title: row.title,
    details: row.details ?? "",
    dueAt: new Date(row.due_at),
    isPinned: Boolean(row.is_pinned),
    linkUrl: row.link_url ?? null,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    createdBy: row.created_by ?? null,
    authorName:
      row.profiles?.display_name ??
      REPS.find((r) => r.id === row.created_by)?.display_name ??
      null,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
  };
}

/** The form's values → a database row. */
function denormalize(input) {
  return {
    subject: input.subject,
    title: input.title.trim(),
    details: input.details?.trim() || null,
    due_at: new Date(input.dueAt).toISOString(),
    is_pinned: Boolean(input.isPinned),
    link_url: input.linkUrl?.trim() || null,
    attachments: input.attachments ?? [],
  };
}

/* ---------------------------------------------------------------- *
 * Local mode
 * ---------------------------------------------------------------- */

let localRows = MOCK_HOMEWORK.map((r) => ({ ...r, deleted_at: null }));
const localListeners = new Set();
const notifyLocal = () => localListeners.forEach((fn) => fn());
const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `hw-${Date.now()}-${Math.random()}`;

/* ---------------------------------------------------------------- *
 * Reads
 * ---------------------------------------------------------------- */

export async function listHomework() {
  if (!isSupabaseConfigured) {
    return localRows.filter((r) => !r.deleted_at).map(normalize);
  }

  const { data, error } = await supabase
    .from("homework")
    .select(COLUMNS)
    .is("deleted_at", null)
    .order("due_at", { ascending: true });

  if (error) throw error;
  return data.map(normalize);
}

/**
 * Live updates, so a rep posting from their phone appears on every open
 * board without anyone refreshing. Returns an unsubscribe function.
 */
export function subscribeToHomework(onChange) {
  if (!isSupabaseConfigured) {
    localListeners.add(onChange);
    return () => localListeners.delete(onChange);
  }

  const channel = supabase
    .channel("homework-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "homework" },
      onChange,
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/* ---------------------------------------------------------------- *
 * Writes — reps only. In Supabase mode the policies enforce that;
 * nothing here is trusted as a permission check.
 * ---------------------------------------------------------------- */

export async function createHomework(input, authorId) {
  if (!isSupabaseConfigured) {
    const row = {
      ...denormalize(input),
      id: newId(),
      created_by: authorId,
      created_at: new Date().toISOString(),
      updated_at: null,
      deleted_at: null,
    };
    localRows = [row, ...localRows];
    notifyLocal();
    return normalize(row);
  }

  const { data, error } = await supabase
    .from("homework")
    .insert({ ...denormalize(input), created_by: authorId })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return normalize(data);
}

export async function updateHomework(id, input) {
  if (!isSupabaseConfigured) {
    localRows = localRows.map((r) =>
      r.id === id
        ? { ...r, ...denormalize(input), updated_at: new Date().toISOString() }
        : r,
    );
    notifyLocal();
    return localRows.find((r) => r.id === id);
  }

  const { data, error } = await supabase
    .from("homework")
    .update({ ...denormalize(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return normalize(data);
}

export async function setPinned(id, isPinned) {
  if (!isSupabaseConfigured) {
    localRows = localRows.map((r) =>
      r.id === id ? { ...r, is_pinned: isPinned } : r,
    );
    notifyLocal();
    return;
  }

  const { error } = await supabase
    .from("homework")
    .update({ is_pinned: isPinned })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Soft delete. The row stays so a mis-tap on a phone can be taken back from
 * the toast, which is kinder and safer than a confirm dialog.
 */
export async function deleteHomework(id) {
  if (!isSupabaseConfigured) {
    localRows = localRows.map((r) =>
      r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r,
    );
    notifyLocal();
    return;
  }

  const { error } = await supabase
    .from("homework")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function restoreHomework(id) {
  if (!isSupabaseConfigured) {
    localRows = localRows.map((r) =>
      r.id === id ? { ...r, deleted_at: null } : r,
    );
    notifyLocal();
    return;
  }

  const { error } = await supabase
    .from("homework")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw error;
}

/* ---------------------------------------------------------------- *
 * Attachments
 * ---------------------------------------------------------------- */

export async function uploadAttachment(file, compressedBlob) {
  const body = compressedBlob ?? file;

  if (!isSupabaseConfigured) {
    // No bucket to write to: keep a local object URL so the picker, the
    // preview and the card all behave exactly as they will in production.
    return {
      name: file.name,
      type: file.type,
      size: body.size,
      url: URL.createObjectURL(body),
      path: null,
    };
  }

  const safeName = file.name.replace(/[^\p{L}\p{N}.\-_]/gu, "_");
  const path = `${new Date().getFullYear()}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, body, { cacheControl: "31536000", upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return {
    name: file.name,
    type: file.type,
    size: body.size,
    url: data.publicUrl,
    path,
  };
}
