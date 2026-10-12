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
import { MOCK_TESTS } from "../data/mockTests.js";
import { MOCK_POLLS } from "../data/mockPolls.js";

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

/* ================================================================ *
 * წერები
 *
 * Deliberately a separate table rather than a `kind` column on
 * homework. Homework leaves the board once it is handed in; a test sits
 * on the horizon for weeks, is never "done", and is read backwards
 * through at the end of a term. Overloading one table would have meant
 * every homework query carrying a filter it does not care about.
 * ================================================================ */

const TEST_COLUMNS =
  "id, subject, kind, topics, note, written_at, created_by, created_at, updated_at, deleted_at, profiles(display_name)";

function normalizeTest(row) {
  return {
    id: row.id,
    subject: row.subject,
    kind: row.kind,
    topics: row.topics,
    note: row.note ?? "",
    writtenAt: new Date(row.written_at),
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

function denormalizeTest(input) {
  return {
    subject: input.subject,
    kind: input.kind,
    topics: input.topics.trim(),
    note: input.note?.trim() || null,
    written_at: new Date(input.writtenAt).toISOString(),
  };
}

let localTests = MOCK_TESTS.map((r) => ({ ...r, deleted_at: null }));
const testListeners = new Set();
const notifyTests = () => testListeners.forEach((fn) => fn());

export async function listTests() {
  if (!isSupabaseConfigured) {
    return localTests.filter((r) => !r.deleted_at).map(normalizeTest);
  }

  const { data, error } = await supabase
    .from("tests")
    .select(TEST_COLUMNS)
    .is("deleted_at", null)
    .order("written_at", { ascending: true });

  if (error) throw error;
  return data.map(normalizeTest);
}

export function subscribeToTests(onChange) {
  if (!isSupabaseConfigured) {
    testListeners.add(onChange);
    return () => testListeners.delete(onChange);
  }

  const channel = supabase
    .channel("tests-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tests" },
      onChange,
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Inserting here is also what notifies the class: a trigger on the table
 * asks the edge function to send the announcement. Nothing extra is called
 * from the client, so a test set from any device — or straight from the SQL
 * editor — announces itself the same way.
 */
export async function createTest(input, authorId) {
  if (!isSupabaseConfigured) {
    const row = {
      ...denormalizeTest(input),
      id: newId(),
      created_by: authorId,
      created_at: new Date().toISOString(),
      updated_at: null,
      deleted_at: null,
    };
    localTests = [row, ...localTests];
    notifyTests();
    return normalizeTest(row);
  }

  const { data, error } = await supabase
    .from("tests")
    .insert({ ...denormalizeTest(input), created_by: authorId })
    .select(TEST_COLUMNS)
    .single();

  if (error) throw error;
  return normalizeTest(data);
}

export async function updateTest(id, input) {
  if (!isSupabaseConfigured) {
    localTests = localTests.map((r) =>
      r.id === id
        ? {
            ...r,
            ...denormalizeTest(input),
            updated_at: new Date().toISOString(),
          }
        : r,
    );
    notifyTests();
    return localTests.find((r) => r.id === id);
  }

  const { data, error } = await supabase
    .from("tests")
    .update({ ...denormalizeTest(input), updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(TEST_COLUMNS)
    .single();

  if (error) throw error;
  return normalizeTest(data);
}

export async function deleteTest(id) {
  if (!isSupabaseConfigured) {
    localTests = localTests.map((r) =>
      r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r,
    );
    notifyTests();
    return;
  }

  const { error } = await supabase
    .from("tests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function restoreTest(id) {
  if (!isSupabaseConfigured) {
    localTests = localTests.map((r) =>
      r.id === id ? { ...r, deleted_at: null } : r,
    );
    notifyTests();
    return;
  }

  const { error } = await supabase
    .from("tests")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw error;
}

/* ================================================================ *
 * კენჭისყრა
 *
 * The counts arrive from `poll_tallies()` rather than from the table,
 * because `poll_votes` has no read policy at all: in a class of thirty,
 * a readable ballot table is a list of who voted for what. The function
 * returns aggregates and nothing else.
 * ================================================================ */

const POLL_COLUMNS =
  "id, question, options, closes_at, closed_at, created_by, created_at, updated_at, deleted_at, profiles(display_name)";

function normalizePoll(row, tally = {}) {
  return {
    id: row.id,
    question: row.question,
    options: Array.isArray(row.options) ? row.options : [],
    closesAt: row.closes_at ? new Date(row.closes_at) : null,
    closedAt: row.closed_at ? new Date(row.closed_at) : null,
    createdBy: row.created_by ?? null,
    authorName:
      row.profiles?.display_name ??
      REPS.find((r) => r.id === row.created_by)?.display_name ??
      null,
    createdAt: new Date(row.created_at),
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    tally,
  };
}

function denormalizePoll(input) {
  return {
    question: input.question.trim(),
    options: input.options.map((o) => ({ id: o.id, label: o.label.trim() })),
    closes_at: input.closesAt ? new Date(input.closesAt).toISOString() : null,
  };
}

let localPolls = MOCK_POLLS.map((r) => ({ ...r, deleted_at: null }));
const pollListeners = new Set();
const notifyPolls = () => pollListeners.forEach((fn) => fn());

/** Stands in for the primary key on `poll_votes` while there is no database. */
const localBallots = new Map();

export async function listPolls() {
  if (!isSupabaseConfigured) {
    return localPolls
      .filter((r) => !r.deleted_at)
      .map((r) => normalizePoll(r, { ...r.tally }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Two round trips rather than a join: the tally is a function, not a
  // relation, so PostgREST cannot embed it. They are independent, so they
  // go together.
  const [rows, tallies] = await Promise.all([
    supabase
      .from("polls")
      .select(POLL_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.rpc("poll_tallies"),
  ]);

  if (rows.error) throw rows.error;
  // A failed tally must not blank the ballot: the questions and options are
  // still worth showing, just with no numbers yet.
  if (tallies.error) console.error("[რვეული] tallies failed", tallies.error);

  const byPoll = new Map();
  for (const t of tallies.data ?? []) {
    const existing = byPoll.get(t.poll_id) ?? {};
    existing[t.option_id] = Number(t.votes);
    byPoll.set(t.poll_id, existing);
  }

  return rows.data.map((r) => normalizePoll(r, byPoll.get(r.id) ?? {}));
}

export function subscribeToPolls(onChange) {
  if (!isSupabaseConfigured) {
    pollListeners.add(onChange);
    return () => pollListeners.delete(onChange);
  }

  // Only the polls table is published. Votes are not — a realtime feed of
  // `poll_votes` would leak the running tally the UI deliberately hides,
  // so a new count arrives on the next refresh instead.
  const channel = supabase
    .channel("polls-feed")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "polls" },
      onChange,
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export async function createPoll(input, authorId) {
  if (!isSupabaseConfigured) {
    const row = {
      ...denormalizePoll(input),
      id: newId(),
      closed_at: null,
      created_by: authorId,
      created_at: new Date().toISOString(),
      updated_at: null,
      deleted_at: null,
      tally: {},
    };
    localPolls = [row, ...localPolls];
    notifyPolls();
    return normalizePoll(row, {});
  }

  const { data, error } = await supabase
    .from("polls")
    .insert({ ...denormalizePoll(input), created_by: authorId })
    .select(POLL_COLUMNS)
    .single();

  if (error) throw error;
  return normalizePoll(data, {});
}

export async function updatePoll(id, input) {
  if (!isSupabaseConfigured) {
    localPolls = localPolls.map((r) =>
      r.id === id
        ? {
            ...r,
            ...denormalizePoll(input),
            updated_at: new Date().toISOString(),
          }
        : r,
    );
    notifyPolls();
    return;
  }

  const { error } = await supabase
    .from("polls")
    .update({ ...denormalizePoll(input), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

/** Closing is reversible: a rep who closed the wrong one can reopen it. */
export async function setPollClosed(id, closed) {
  const closedAt = closed ? new Date().toISOString() : null;

  if (!isSupabaseConfigured) {
    localPolls = localPolls.map((r) =>
      r.id === id ? { ...r, closed_at: closedAt } : r,
    );
    notifyPolls();
    return;
  }

  const { error } = await supabase
    .from("polls")
    .update({ closed_at: closedAt })
    .eq("id", id);

  if (error) throw error;
}

export async function deletePoll(id) {
  if (!isSupabaseConfigured) {
    localPolls = localPolls.map((r) =>
      r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r,
    );
    notifyPolls();
    return;
  }

  const { error } = await supabase
    .from("polls")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function restorePoll(id) {
  if (!isSupabaseConfigured) {
    localPolls = localPolls.map((r) =>
      r.id === id ? { ...r, deleted_at: null } : r,
    );
    notifyPolls();
    return;
  }

  const { error } = await supabase
    .from("polls")
    .update({ deleted_at: null })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Cast or change this device's vote.
 *
 * An RPC rather than a table write for the same reason the push
 * subscription is: the insert needs to see the row it would conflict with,
 * and the table has no read policy. The function checks the poll is open
 * and that the option is really on the ballot before it writes.
 */
export async function votePoll(pollId, optionId, voterKey) {
  if (!isSupabaseConfigured) {
    const ballot = `${pollId}:${voterKey}`;
    localPolls = localPolls.map((r) => {
      if (r.id !== pollId) return r;
      const tally = { ...r.tally };
      // Moving a vote takes it off the previous choice, exactly as the
      // ON CONFLICT ... DO UPDATE does server-side.
      const previous = localBallots.get(ballot);
      if (previous && tally[previous]) tally[previous] -= 1;
      tally[optionId] = (tally[optionId] ?? 0) + 1;
      return { ...r, tally };
    });
    localBallots.set(ballot, optionId);
    notifyPolls();
    return;
  }

  const { error } = await supabase.rpc("cast_poll_vote", {
    p_poll_id: pollId,
    p_option_id: optionId,
    p_voter_key: voterKey,
  });

  if (error) throw error;
}
