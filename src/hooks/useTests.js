import { useCallback, useEffect, useRef, useState } from "react";
import { listTests, subscribeToTests } from "../lib/repository.js";

const CACHE_KEY = "rveuli.tests-cache.v1";

/** Last good list, so a phone on a weak signal still opens to something. */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).map((r) => ({
      ...r,
      writtenAt: new Date(r.writtenAt),
      createdAt: new Date(r.createdAt),
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : null,
      deletedAt: null,
    }));
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
  } catch {
    // Cache is a convenience, never a requirement.
  }
}

export function useTests() {
  const [items, setItems] = useState(() => readCache() ?? []);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [isStale, setStale] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await listTests();
      if (!mounted.current) return;
      setItems(rows);
      setStatus("ready");
      setStale(false);
      writeCache(rows);
    } catch (err) {
      if (!mounted.current) return;
      console.error("[რვეული] tests load failed", err);
      // Last week's list beats an error page when you are checking whether
      // the chemistry test is tomorrow.
      setStale(readCache() !== null);
      setStatus(readCache() ? "ready" : "error");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const unsubscribe = subscribeToTests(refresh);
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [refresh]);

  return { items, status, isStale, refresh };
}
