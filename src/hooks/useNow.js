import { useSyncExternalStore } from "react";

/**
 * One clock for the whole board.
 *
 * Every deadline on screen is relative — "ხვალ", "4 საათში", "ვადა
 * გასულია" — so a board left open on a desk would quietly go wrong without
 * this. A single shared interval ticks on the minute boundary and nudges
 * every card at once, which also keeps the time out of render as an
 * unmanaged side effect.
 */

const MINUTE = 60_000;

let current = Date.now();
let timer = null;
const listeners = new Set();

function tick() {
  current = Date.now();
  for (const fn of listeners) fn();
  schedule();
}

function schedule() {
  // Land on the minute boundary so labels flip when the clock does.
  clearTimeout(timer);
  timer = setTimeout(tick, MINUTE - (Date.now() % MINUTE));
}

function subscribe(fn) {
  listeners.add(fn);
  if (listeners.size === 1) schedule();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => current;

/** Milliseconds since the epoch, refreshed once a minute. */
export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
