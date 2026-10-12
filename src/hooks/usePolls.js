import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { listPolls, subscribeToPolls, votePoll } from "../lib/repository.js";
import {
  getSnapshot,
  rememberVote,
  subscribe as subscribeBallots,
  voterKey,
} from "../lib/polls.js";

const CACHE_KEY = "rveuli.polls-cache.v1";

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).map((r) => ({
      ...r,
      closesAt: r.closesAt ? new Date(r.closesAt) : null,
      closedAt: r.closedAt ? new Date(r.closedAt) : null,
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

/**
 * The ballot box and what this device has put in it.
 *
 * The two are kept apart on purpose: the counts are shared and come from
 * the server, while which option *you* picked lives on the device and is
 * remembered even if the tally request later fails.
 */
export function usePolls() {
  const [items, setItems] = useState(() => readCache() ?? []);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const mounted = useRef(true);

  const ballots = useSyncExternalStore(
    subscribeBallots,
    getSnapshot,
    getSnapshot,
  );

  const refresh = useCallback(async () => {
    try {
      const rows = await listPolls();
      if (!mounted.current) return;
      setItems(rows);
      setStatus("ready");
      writeCache(rows);
    } catch (err) {
      if (!mounted.current) return;
      console.error("[რვეული] polls load failed", err);
      setStatus(readCache() ? "ready" : "error");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const unsubscribe = subscribeToPolls(refresh);
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [refresh]);

  /**
   * Cast or move this device's vote.
   *
   * The choice is remembered locally first so the bars appear on the tap
   * rather than after a round trip, then the real counts replace the
   * optimistic ones. If the write fails the local choice is rolled back,
   * because a ballot this device only *thinks* it cast is worse than none.
   */
  const vote = useCallback(
    async (pollId, optionId) => {
      const previous = getSnapshot()[pollId] ?? null;
      rememberVote(pollId, optionId);
      try {
        await votePoll(pollId, optionId, voterKey());
        await refresh();
      } catch (err) {
        if (previous) rememberVote(pollId, previous);
        else rememberVote(pollId, null);
        throw err;
      }
    },
    [refresh],
  );

  return { items, status, ballots, refresh, vote };
}
