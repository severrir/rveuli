import { useCallback, useEffect, useRef, useState } from "react";
import { listEvents, subscribeToEvents } from "../lib/repository.js";

const CACHE_KEY = "rveuli.events-cache.v1";

/** Last good list, so a phone on a weak signal still opens to something. */
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).map((r) => ({
      ...r,
      startsAt: new Date(r.startsAt),
      endsAt: r.endsAt ? new Date(r.endsAt) : null,
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

export function useEvents() {
  const [items, setItems] = useState(() => readCache() ?? []);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [isStale, setStale] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await listEvents();
      if (!mounted.current) return;
      setItems(rows);
      setStatus("ready");
      setStale(false);
      writeCache(rows);
    } catch (err) {
      if (!mounted.current) return;
      console.error("[რვეული] events load failed", err);
      // Yesterday's list beats an error page when you are checking what
      // time the bus leaves.
      setStale(readCache() !== null);
      setStatus(readCache() ? "ready" : "error");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const unsubscribe = subscribeToEvents(refresh);
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [refresh]);

  return { items, status, isStale, refresh };
}
