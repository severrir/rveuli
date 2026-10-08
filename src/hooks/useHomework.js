import { useCallback, useEffect, useRef, useState } from "react";
import { listHomework, subscribeToHomework } from "../lib/repository.js";

const CACHE_KEY = "rveuli.feed-cache.v1";

/** Last good feed, so a phone on a weak signal still opens to something. */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).map((r) => ({
      ...r,
      dueAt: new Date(r.dueAt),
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

export function useHomework() {
  const [items, setItems] = useState(() => readCache() ?? []);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [isStale, setStale] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await listHomework();
      if (!mounted.current) return;
      setItems(rows);
      setStatus("ready");
      setStale(false);
      writeCache(rows);
    } catch (err) {
      if (!mounted.current) return;
      console.error("[რვეული] feed load failed", err);
      // Showing yesterday's board beats showing an error page.
      setStale(readCache() !== null);
      setStatus(readCache() ? "ready" : "error");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const unsubscribe = subscribeToHomework(refresh);
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [refresh]);

  return { items, status, isStale, refresh, setItems };
}
