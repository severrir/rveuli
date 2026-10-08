import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import BottomNav from "./components/BottomNav.jsx";
import HeroDeadline from "./components/HeroDeadline.jsx";
import FilterBar from "./components/FilterBar.jsx";
import HomeworkGrid from "./components/HomeworkGrid.jsx";
import WeekView from "./components/WeekView.jsx";
import ArchiveView from "./components/ArchiveView.jsx";
import EmptyState from "./components/EmptyState.jsx";
import LoginSheet from "./components/LoginSheet.jsx";
import HomeworkSheet from "./components/HomeworkSheet.jsx";
import Toast from "./components/Toast.jsx";
import NotifyBanner from "./components/NotifyBanner.jsx";

import { useHomework } from "./hooks/useHomework.js";
import { useDone } from "./hooks/useDone.js";
import { useSession } from "./hooks/useSession.js";
import { useToast } from "./hooks/useToast.js";
import { useNow } from "./hooks/useNow.js";

import {
  createHomework,
  updateHomework,
  deleteHomework,
  restoreHomework,
  setPinned,
} from "./lib/repository.js";
import { signOut } from "./lib/auth.js";
import { getSubject } from "./lib/subjects.js";
import {
  describeDue,
  formatTime,
  isSameTbilisiDay,
  tbilisiWeek,
  weekdayLocative,
} from "./lib/georgian.js";

const LAST_SEEN_KEY = "rveuli.last-seen.v1";

function readLastSeen() {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const { items, status, isStale, refresh } = useHomework();
  const { done, toggle } = useDone();
  const { rep, isRep } = useSession();
  const { toast, show, dismiss } = useToast();
  const now = useNow();

  const [view, setView] = useState("feed");
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [loginOpen, setLoginOpen] = useState(false);
  const [sheet, setSheet] = useState(null); // null | {} | homework item
  const [firstPaint, setFirstPaint] = useState(true);
  const [lastSeen] = useState(readLastSeen);

  // The entrance plays once. After that the list simply updates.
  useEffect(() => {
    if (status !== "ready") return;
    const t = setTimeout(() => setFirstPaint(false), 900);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
    } catch {
      // Badge is a nicety; losing it costs nothing.
    }
  }, []);

  /* ---- Shaping the board ------------------------------------------- */

  // Work leaves the feed only once it is both past its deadline and ticked.
  const { current, archived } = useMemo(() => {
    const current = [];
    const archived = [];
    for (const item of items) {
      if (done.has(item.id) && item.dueAt.getTime() < now) archived.push(item);
      else current.push(item);
    }
    return { current, archived };
  }, [items, done, now]);

  const sortedCurrent = useMemo(() => {
    const weight = (i) => (done.has(i.id) ? 2 : i.isPinned ? 0 : 1);
    return [...current].sort(
      (a, b) => weight(a) - weight(b) || a.dueAt - b.dueAt,
    );
  }, [current, done]);

  const matches = useCallback(
    (item) => {
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.details.toLowerCase().includes(q) ||
        getSubject(item.subject).name.toLowerCase().includes(q)
      );
    },
    [query],
  );

  const visible = useMemo(
    () =>
      sortedCurrent.filter(
        (i) => matches(i) && (subject === "all" || i.subject === subject),
      ),
    [sortedCurrent, matches, subject],
  );

  const counts = useMemo(() => {
    const out = {};
    for (const i of sortedCurrent.filter(matches)) {
      out[i.subject] = (out[i.subject] ?? 0) + 1;
    }
    return out;
  }, [sortedCurrent, matches]);

  const week = useMemo(() => {
    const days = tbilisiWeek(now);
    const inWeek = items.filter((i) =>
      days.some((d) => isSameTbilisiDay(d, i.dueAt)),
    );
    return {
      items: inWeek,
      total: inWeek.length,
      doneCount: inWeek.filter((i) => done.has(i.id)).length,
    };
  }, [items, done, now]);

  // Deliberately ignores pinning: a rep marking a test as მნიშვნელოვანი
  // moves it up the feed, but the hero always names the nearest deadline.
  const next = useMemo(
    () =>
      current
        .filter((i) => !done.has(i.id))
        .sort((a, b) => a.dueAt - b.dueAt)[0] ?? null,
    [current, done],
  );

  const newCount = useMemo(() => {
    if (!lastSeen) return 0;
    return items.filter((i) => i.createdAt.getTime() > lastSeen).length;
  }, [items, lastSeen]);

  const archivedVisible = useMemo(
    () =>
      [...archived]
        .filter(matches)
        .sort((a, b) => b.dueAt - a.dueAt),
    [archived, matches],
  );

  /* ---- Actions ------------------------------------------------------ */

  const handleCopy = useCallback(
    async (item) => {
      const due = describeDue(item.dueAt);
      const text = [
        `${getSubject(item.subject).name} — ${item.title}`,
        item.details,
        `ვადა: ${weekdayLocative(item.dueAt)}, ${formatTime(item.dueAt)} (${due.label})`,
        item.linkUrl,
      ]
        .filter(Boolean)
        .join("\n");

      try {
        await navigator.clipboard.writeText(text);
        show("დავალება დაკოპირდა");
      } catch {
        show("კოპირება ვერ მოხერხდა", { tone: "error" });
      }
    },
    [show],
  );

  const handleSave = useCallback(
    async (form) => {
      if (sheet?.id) {
        await updateHomework(sheet.id, form);
        show("ცვლილება შენახულია");
      } else {
        await createHomework(form, rep?.id);
        show("დავალება დაემატა");
      }
      await refresh();
    },
    [sheet, rep, refresh, show],
  );

  const handleDelete = useCallback(
    async (item) => {
      await deleteHomework(item.id);
      await refresh();
      show("დავალება წაიშალა", {
        action: {
          label: "დაბრუნება",
          onClick: async () => {
            await restoreHomework(item.id);
            await refresh();
            show("დავალება დაბრუნდა");
          },
        },
        duration: 7000,
      });
    },
    [refresh, show],
  );

  const handleTogglePin = useCallback(
    async (item) => {
      await setPinned(item.id, !item.isPinned);
      await refresh();
      show(item.isPinned ? "მნიშვნელოვანი მოიხსნა" : "მნიშვნელოვნად მოინიშნა");
    },
    [refresh, show],
  );

  const handleDuplicate = useCallback(
    (item) => {
      // Open a new entry pre-filled from this one; the rep sets a fresh date.
      setSheet({
        subject: item.subject,
        title: item.title,
        details: item.details,
        dueAt: new Date(Date.now() + 86400000),
        isPinned: false,
        linkUrl: item.linkUrl,
        attachments: item.attachments,
      });
    },
    [],
  );

  const cardProps = {
    onToggleDone: toggle,
    onCopy: handleCopy,
    isRep,
    onEdit: (item) => setSheet(item),
    onTogglePin: handleTogglePin,
    onDuplicate: handleDuplicate,
    onDelete: handleDelete,
  };

  /* ---- Render -------------------------------------------------------- */

  return (
    <div
      className={
        // The feed must be able to scroll clear of the fixed chrome, or the
        // last card's controls sit under it and cannot be tapped. The bar
        // alone needs 84px; the rep's floating add button reaches higher.
        isRep
          ? "min-h-dvh pb-[calc(148px+env(safe-area-inset-bottom))]"
          : "min-h-dvh pb-[calc(84px+env(safe-area-inset-bottom))]"
      }
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2 focus:text-ink-900"
      >
        გადადი დავალებებზე
      </a>

      <Navbar
        rep={rep}
        onToast={show}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={async () => {
          await signOut();
          show("გამოხვედი");
        }}
      />

      <main id="main" className="mx-auto max-w-6xl">
        {status === "error" ? (
          <EmptyState variant="error" />
        ) : view === "feed" ? (
          <>
            <HeroDeadline
              next={next}
              weekTotal={week.total}
              weekDone={week.doneCount}
            />
            {isStale && (
              <p className="mx-4 mb-3 rounded-lg border border-ink-600 bg-ink-700/60 px-3 py-2 text-meta text-paper-3">
                ინტერნეტი ვერ მივიღე — ეს ბოლო შენახული სიაა.
              </p>
            )}
            <NotifyBanner onToast={show} />
            <FilterBar
              query={query}
              onQueryChange={setQuery}
              subject={subject}
              onSubjectChange={setSubject}
              counts={counts}
            />
            <HomeworkGrid
              items={visible}
              doneSet={done}
              firstPaint={firstPaint}
              emptyState={
                query ? (
                  <EmptyState
                    variant="search"
                    query={query}
                    onClear={() => setQuery("")}
                  />
                ) : (
                  <EmptyState variant={isRep ? "none-rep" : "none"} />
                )
              }
              {...cardProps}
            />
          </>
        ) : view === "week" ? (
          <div className="pt-6">
            <WeekView items={week.items} doneSet={done} />
          </div>
        ) : (
          <div className="pt-6">
            <div className="mb-2">
              <FilterBar
                query={query}
                onQueryChange={setQuery}
                subject="all"
                onSubjectChange={() => {}}
                counts={{}}
              />
            </div>
            <ArchiveView
              items={archivedVisible}
              doneSet={done}
              query={query}
            />
          </div>
        )}
      </main>

      <BottomNav
        view={view}
        onViewChange={(v) => {
          setView(v);
          setQuery("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        isRep={isRep}
        onAdd={() => setSheet({})}
        badge={view === "feed" ? 0 : newCount}
      />

      <LoginSheet
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSignedIn={(r) => show(`შემოხვედი როგორც ${r.display_name}`)}
      />

      <HomeworkSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        editing={sheet}
        onSave={handleSave}
      />

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
