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
import Watermark from "./components/Watermark.jsx";
import ReminderSheet from "./components/ReminderSheet.jsx";
import PeopleSheet from "./components/PeopleSheet.jsx";
import TestsView from "./components/TestsView.jsx";
import TestSheet from "./components/TestSheet.jsx";
import PollsView from "./components/PollsView.jsx";
import PollSheet from "./components/PollSheet.jsx";
import EventsView from "./components/EventsView.jsx";
import EventSheet from "./components/EventSheet.jsx";

import { useHomework } from "./hooks/useHomework.js";
import { useTests } from "./hooks/useTests.js";
import { usePolls } from "./hooks/usePolls.js";
import { useEvents } from "./hooks/useEvents.js";
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
  createTest,
  updateTest,
  deleteTest,
  restoreTest,
  createPoll,
  updatePoll,
  deletePoll,
  restorePoll,
  setPollClosed,
  createEvent,
  updateEvent,
  deleteEvent,
  restoreEvent,
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

const VIEWS = ["feed", "tests", "events", "polls", "week", "archive"];

function readLastSeen() {
  try {
    const raw = localStorage.getItem(LAST_SEEN_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Which tab to open on.
 *
 * The test announcement links to `?view=tests`, so tapping the
 * notification lands on the written work rather than on the board, where
 * the student would then have to go looking for what they were just told
 * about.
 */
function initialView() {
  try {
    const wanted = new URLSearchParams(window.location.search).get("view");
    return VIEWS.includes(wanted) ? wanted : "feed";
  } catch {
    return "feed";
  }
}

export default function App() {
  const { items, status, isStale, refresh } = useHomework();
  const tests = useTests();
  const polls = usePolls();
  const events = useEvents();
  const { done, toggle } = useDone();
  const { rep, isRep } = useSession();
  const { toast, show, dismiss } = useToast();
  const now = useNow();

  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [loginOpen, setLoginOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [sheet, setSheet] = useState(null); // null | {} | homework item
  const [testSheet, setTestSheet] = useState(null); // null | {} | test
  const [pollSheet, setPollSheet] = useState(null); // null | {} | poll
  const [eventSheet, setEventSheet] = useState(null); // null | {} | event
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

  /* ---- წერები ------------------------------------------------------- */

  const handleSaveTest = useCallback(
    async (form) => {
      if (testSheet?.id) {
        await updateTest(testSheet.id, form);
        show("ცვლილება შენახულია");
      } else {
        await createTest(form, rep?.id);
        // The notification is sent by a trigger on the table, so the rep is
        // told what has already happened rather than what is about to.
        show("წერა დაინიშნა — კლასს შეტყობინება მივა");
      }
      await tests.refresh();
    },
    [testSheet, rep, tests, show],
  );

  const handleDeleteTest = useCallback(
    async (test) => {
      await deleteTest(test.id);
      await tests.refresh();
      show("წერა წაიშალა", {
        action: {
          label: "დაბრუნება",
          onClick: async () => {
            await restoreTest(test.id);
            await tests.refresh();
            show("წერა დაბრუნდა");
          },
        },
        duration: 7000,
      });
    },
    [tests, show],
  );

  /* ---- კენჭისყრა ----------------------------------------------------- */

  const handleSavePoll = useCallback(
    async (form) => {
      if (pollSheet?.id) {
        await updatePoll(pollSheet.id, form);
        show("ცვლილება შენახულია");
      } else {
        await createPoll(form, rep?.id);
        show("კენჭისყრა დაიწყო");
      }
      await polls.refresh();
    },
    [pollSheet, rep, polls, show],
  );

  const handleDeletePoll = useCallback(
    async (poll) => {
      await deletePoll(poll.id);
      await polls.refresh();
      show("კენჭისყრა წაიშალა", {
        action: {
          label: "დაბრუნება",
          onClick: async () => {
            await restorePoll(poll.id);
            await polls.refresh();
            show("კენჭისყრა დაბრუნდა");
          },
        },
        duration: 7000,
      });
    },
    [polls, show],
  );

  const handleTogglePollClosed = useCallback(
    async (poll) => {
      const closing = !poll.closedAt;
      await setPollClosed(poll.id, closing);
      await polls.refresh();
      show(closing ? "კენჭისყრა დაიხურა" : "კენჭისყრა ხელახლა გაიხსნა");
    },
    [polls, show],
  );

  const handleVote = useCallback(
    async (pollId, optionId) => {
      await polls.vote(pollId, optionId);
      show("ხმა ჩაწერილია");
    },
    [polls, show],
  );

  /* ---- ევენთები ------------------------------------------------------ */

  const handleSaveEvent = useCallback(
    async (form) => {
      if (eventSheet?.id) {
        await updateEvent(eventSheet.id, form);
        show("ცვლილება შენახულია");
      } else {
        await createEvent(form, rep?.id);
        show("ევენთი დაემატა — კლასს შეტყობინება მივა");
      }
      await events.refresh();
    },
    [eventSheet, rep, events, show],
  );

  const handleDeleteEvent = useCallback(
    async (event) => {
      await deleteEvent(event.id);
      await events.refresh();
      show("ევენთი წაიშალა", {
        action: {
          label: "დაბრუნება",
          onClick: async () => {
            await restoreEvent(event.id);
            await events.refresh();
            show("ევენთი დაბრუნდა");
          },
        },
        duration: 7000,
      });
    },
    [events, show],
  );

  /* ---- The one add button, four meanings ---------------------------- */

  const add = useMemo(() => {
    if (view === "tests") {
      return { label: "წერა", onClick: () => setTestSheet({}) };
    }
    if (view === "events") {
      return { label: "ევენთი", onClick: () => setEventSheet({}) };
    }
    if (view === "polls") {
      return { label: "კენჭისყრა", onClick: () => setPollSheet({}) };
    }
    return { label: "დამატება", onClick: () => setSheet({}) };
  }, [view]);

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
        onReminders={() => setRemindersOpen(true)}
        onPeople={() => setPeopleOpen(true)}
        onSignIn={() => setLoginOpen(true)}
        onSignOut={async () => {
          await signOut();
          show("გამოხვედი");
        }}
      />

      <main id="main" className="mx-auto max-w-6xl">
        {/* The homework error belongs to the three homework tabs. A failed
            feed must not blank წერები, which loads separately and may
            well have arrived. */}
        {view === "tests" ? (
          tests.status === "error" ? (
            <EmptyState variant="error" />
          ) : (
            <>
              {tests.isStale && (
                <p className="mx-4 mb-3 mt-6 rounded-lg border border-ink-600 bg-ink-700/60 px-3 py-2 text-meta text-paper-3">
                  ინტერნეტი ვერ მივიღე — ეს ბოლო შენახული სიაა.
                </p>
              )}
              <TestsView
                items={tests.items}
                isRep={isRep}
                onEdit={(test) => setTestSheet(test)}
                onDelete={handleDeleteTest}
              />
            </>
          )
        ) : view === "events" ? (
          events.status === "error" ? (
            <EmptyState variant="error" />
          ) : (
            <>
              {events.isStale && (
                <p className="mx-4 mb-3 mt-6 rounded-lg border border-ink-600 bg-ink-700/60 px-3 py-2 text-meta text-paper-3">
                  ინტერნეტი ვერ მივიღე — ეს ბოლო შენახული სიაა.
                </p>
              )}
              <EventsView
                items={events.items}
                isRep={isRep}
                onEdit={(event) => setEventSheet(event)}
                onDelete={handleDeleteEvent}
              />
            </>
          )
        ) : view === "polls" ? (
          polls.status === "error" ? (
            <EmptyState variant="error" />
          ) : (
            <PollsView
              items={polls.items}
              ballots={polls.ballots}
              onVote={handleVote}
              isRep={isRep}
              onEdit={(poll) => setPollSheet(poll)}
              onDelete={handleDeletePoll}
              onToggleClosed={handleTogglePollClosed}
            />
          )
        ) : status === "error" ? (
          <EmptyState variant="error" />
        ) : view === "feed" || view === "archive" ? (
          <>
            {/* The hero names the nearest deadline, which is a statement
                about work still ahead — so it stays out of the archive. */}
            {view === "feed" && (
              <HeroDeadline
                next={next}
                weekTotal={week.total}
                weekDone={week.doneCount}
              />
            )}
            {isStale && (
              <p className="mx-4 mb-3 rounded-lg border border-ink-600 bg-ink-700/60 px-3 py-2 text-meta text-paper-3">
                ინტერნეტი ვერ მივიღე — ეს ბოლო შენახული სიაა.
              </p>
            )}

            {/* არქივი is the same homework seen later, not a separate
                section, so it is a state of this tab rather than a sixth
                entry in a bottom bar that had run out of room. */}
            <div
              className={`flex gap-1 px-4 ${view === "feed" ? "pb-3" : "pb-3 pt-6"}`}
              role="group"
              aria-label="დავალებების ხედი"
            >
              {[
                { id: "feed", label: "მიმდინარე", count: sortedCurrent.length },
                { id: "archive", label: "არქივი", count: archived.length },
              ].map((t) => {
                const active = view === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setView(t.id);
                      setQuery("");
                    }}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3.5 text-sm transition-colors ${
                      active
                        ? "border-blue-pen bg-blue-dim/30 text-paper"
                        : "border-ink-600 text-paper-2 hover:bg-ink-700"
                    }`}
                  >
                    {t.label}
                    <span className="tnum text-meta text-paper-3">
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <FilterBar
              query={query}
              onQueryChange={setQuery}
              subject={view === "feed" ? subject : "all"}
              onSubjectChange={view === "feed" ? setSubject : () => {}}
              counts={view === "feed" ? counts : {}}
            />

            {view === "feed" ? (
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
            ) : (
              <ArchiveView
                items={archivedVisible}
                doneSet={done}
                query={query}
              />
            )}
          </>
        ) : (
          <div className="pt-6">
            <WeekView items={week.items} doneSet={done} />
          </div>
        )}
        <Watermark />
      </main>

      <BottomNav
        // არქივი lives inside the board tab, so the board tab stays lit
        // while it is open — otherwise no tab would look selected at all.
        view={view === "archive" ? "feed" : view}
        onViewChange={(v) => {
          setView(v);
          setQuery("");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        isRep={isRep}
        onAdd={add.onClick}
        addLabel={add.label}
        badge={view === "feed" ? 0 : newCount}
      />

      <ReminderSheet
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
        onToast={show}
      />

      {/* Mounted only for an owner: the sheet lists email addresses, and
          the database refuses the call for anyone else anyway. */}
      {rep?.role === "owner" && (
        <PeopleSheet
          open={peopleOpen}
          onClose={() => setPeopleOpen(false)}
          rep={rep}
          onToast={show}
        />
      )}

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

      <TestSheet
        open={testSheet !== null}
        onClose={() => setTestSheet(null)}
        editing={testSheet}
        onSave={handleSaveTest}
      />

      <PollSheet
        open={pollSheet !== null}
        onClose={() => setPollSheet(null)}
        editing={pollSheet}
        onSave={handleSavePoll}
      />

      <EventSheet
        open={eventSheet !== null}
        onClose={() => setEventSheet(null)}
        editing={eventSheet}
        onSave={handleSaveEvent}
      />

      <Toast toast={toast} onDismiss={dismiss} />
    </div>
  );
}
