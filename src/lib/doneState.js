/**
 * The personal "შესრულებულია" tick.
 *
 * This is the one piece of state that belongs to the student rather than the
 * class, so it stays on the device and never reaches the server. No account,
 * no sync, nothing to sign into — open the link and start ticking.
 *
 * Every access is guarded: Safari private mode throws on localStorage rather
 * than returning null, and a thrown error here must never take the feed down.
 */

const KEY = "rveuli.done.v1";

let cache = null;
const listeners = new Set();

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    cache = new Set();
  }
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...read()]));
  } catch {
    // Out of quota or storage blocked. The tick still works for this session.
  }
}

function emit() {
  for (const fn of listeners) fn();
}

export function isDone(id) {
  return read().has(id);
}

export function toggleDone(id) {
  const set = read();
  const nowDone = !set.has(id);
  if (nowDone) set.add(id);
  else set.delete(id);
  persist();
  snapshot = null; // invalidate before notifying, or listeners read a stale set
  emit();
  return nowDone;
}

export function doneCount(ids) {
  const set = read();
  return ids.reduce((n, id) => n + (set.has(id) ? 1 : 0), 0);
}

/** Stable identity between mutations — required by useSyncExternalStore. */
let snapshot = null;
export function getSnapshot() {
  if (!snapshot) snapshot = new Set(read());
  return snapshot;
}

export function subscribe(fn) {
  listeners.add(fn);
  const onStorage = (e) => {
    // Another tab ticked something off.
    if (e.key === KEY) {
      cache = null;
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
