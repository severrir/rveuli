import { useSyncExternalStore } from "react";
import { getSnapshot, subscribe, toggleDone } from "../lib/doneState.js";

/**
 * The personal tick set. Server snapshot is an empty set so a prerender
 * never claims work is finished before the device has been read.
 */
const emptySet = new Set();

export function useDone() {
  const done = useSyncExternalStore(subscribe, getSnapshot, () => emptySet);
  return { done, toggle: toggleDone };
}
