/**
 * კენჭისყრა — how this device votes, and what it has voted on.
 *
 * This is the first thing in რვეული a student may write to without signing
 * in, so the identity question had to be answered somehow. The answer is a
 * random key the browser makes for itself and keeps: it says nothing about
 * who the student is, there is no account to tie it to, and the primary key
 * on `poll_votes` is what actually enforces one vote per device.
 *
 * Clearing site data earns a second vote. That is a deliberate trade — the
 * alternative is thirty teenagers holding accounts in order to settle where
 * the excursion goes.
 *
 * Like doneState.js, every storage access is guarded: Safari in private
 * mode throws rather than returning null, and nothing here may take the
 * page down.
 */

const VOTER_KEY = "rveuli.voter.v1";
const BALLOT_KEY = "rveuli.ballots.v1";

/* ---------------------------------------------------------------- *
 * Who this browser is, as far as a poll is concerned
 * ---------------------------------------------------------------- */

function randomKey() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replace(/-/g, "");
  // Without crypto every device would share one key and the whole class
  // would hold a single vote between them.
  let out = "";
  while (out.length < 32) out += Math.random().toString(36).slice(2);
  return out.slice(0, 32);
}

let cachedVoter = null;

/** Stable per device. Created on first use, then kept. */
export function voterKey() {
  if (cachedVoter) return cachedVoter;
  try {
    const stored = localStorage.getItem(VOTER_KEY);
    if (stored && stored.length >= 8) {
      cachedVoter = stored;
      return cachedVoter;
    }
  } catch {
    // Fall through to a session-only key.
  }

  cachedVoter = randomKey();
  try {
    localStorage.setItem(VOTER_KEY, cachedVoter);
  } catch {
    // The vote still lands; this device just forgets it voted.
  }
  return cachedVoter;
}

/* ---------------------------------------------------------------- *
 * What this device has already chosen
 * ---------------------------------------------------------------- */

let ballots = null;
const listeners = new Set();

function read() {
  if (ballots) return ballots;
  try {
    const raw = localStorage.getItem(BALLOT_KEY);
    ballots = raw ? JSON.parse(raw) : {};
  } catch {
    ballots = {};
  }
  return ballots;
}

function persist() {
  try {
    localStorage.setItem(BALLOT_KEY, JSON.stringify(read()));
  } catch {
    // Still correct for this session.
  }
}

/** The option this device picked, or null. */
export function myVote(pollId) {
  return read()[pollId] ?? null;
}

export function rememberVote(pollId, optionId) {
  read()[pollId] = optionId;
  snapshot = null; // invalidate before notifying, or listeners read a stale map
  persist();
  for (const fn of listeners) fn();
}

/** Stable identity between mutations — required by useSyncExternalStore. */
let snapshot = null;
export function getSnapshot() {
  if (!snapshot) snapshot = { ...read() };
  return snapshot;
}

export function subscribe(fn) {
  listeners.add(fn);
  const onStorage = (e) => {
    // Another tab voted.
    if (e.key === BALLOT_KEY) {
      ballots = null;
      snapshot = null;
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

/* ---------------------------------------------------------------- *
 * Shaping a poll for the screen
 * ---------------------------------------------------------------- */

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;

export function isOpen(poll, now = Date.now()) {
  if (poll.closedAt) return false;
  if (poll.closesAt && poll.closesAt.getTime() <= now) return false;
  return true;
}

/**
 * Results, sorted highest first, with the share each option took.
 *
 * `leading` marks every option tied at the top rather than just the first,
 * because a 12–12 draw announcing a single winner is a lie the bar chart
 * would then have to tell.
 */
export function results(poll) {
  const tally = poll.tally ?? {};
  const total = Object.values(tally).reduce((n, v) => n + v, 0);

  const rows = poll.options.map((o) => ({
    ...o,
    votes: tally[o.id] ?? 0,
    // A poll nobody has voted in shows empty bars, not six equal ones.
    share: total === 0 ? 0 : Math.round(((tally[o.id] ?? 0) / total) * 100),
  }));

  const top = Math.max(0, ...rows.map((r) => r.votes));
  for (const row of rows) row.leading = total > 0 && row.votes === top;

  rows.sort((a, b) => b.votes - a.votes);
  return { rows, total };
}

/**
 * Whether this device may see the numbers yet.
 *
 * Results stay hidden until you have voted or the poll has closed. Showing
 * a running tally first turns a vote into a bandwagon, which is the one
 * thing a class poll must not do.
 */
export function canSeeResults(poll, voted, isRep) {
  return Boolean(isRep || voted || !isOpen(poll));
}

/** The Georgian for how a poll stands. */
export function statusLabel(poll, now = Date.now()) {
  if (!isOpen(poll, now)) return "დახურულია";
  if (poll.closesAt) {
    const hours = Math.round((poll.closesAt.getTime() - now) / 3600000);
    if (hours <= 1) return "იხურება მალე";
    if (hours < 24) return `იხურება ${hours} საათში`;
    const days = Math.round(hours / 24);
    return `იხურება ${days} დღეში`;
  }
  return "ღიაა";
}

/** Option ids are letters, so a ballot reads a, b, c rather than a uuid. */
export const optionId = (index) => String.fromCharCode(97 + index);
