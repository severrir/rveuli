import { useState } from "react";
import { Check, Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import {
  canSeeResults,
  isOpen,
  results,
  statusLabel,
} from "../lib/polls.js";
import { ergative, relativeAgo } from "../lib/georgian.js";
import { useNow } from "../hooks/useNow.js";
import EmptyState from "./EmptyState.jsx";

/**
 * კენჭისყრა — where the class decides something.
 *
 * Two rules shape this screen.
 *
 * The numbers stay hidden until you have voted, or until the poll closes.
 * A running tally shown before the tap turns a vote into a bandwagon, and
 * a class of thirty is small enough that one visible early lead decides
 * the rest.
 *
 * Nothing here is red. Red is the deadline, everywhere else in the app, so
 * the bars are drawn in the blue pen instead — the ballot is a decision,
 * not something overdue.
 */

function Bar({ row, mine, total }) {
  return (
    <li className="relative overflow-hidden rounded-lg border border-hairline bg-ink-700/40">
      {/* The bar is the background of the row rather than a separate
          element, so the label never has to compete with it for width. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 transition-[width] duration-500 ease-[var(--ease-page)] ${
          row.leading ? "bg-blue-pen/30" : "bg-blue-dim/40"
        }`}
        style={{ width: `${row.share}%` }}
      />
      <div className="relative flex min-h-12 items-center gap-2 px-3 py-2">
        {mine && (
          <Check
            size={15}
            strokeWidth={2.5}
            className="shrink-0 text-blue-pen"
            aria-label="შენი არჩევანი"
          />
        )}
        <span
          className={`min-w-0 flex-1 text-sm ${
            mine ? "font-semibold text-paper" : "text-paper-2"
          }`}
        >
          {row.label}
        </span>
        <span className="tnum shrink-0 text-meta text-paper-3">
          {row.votes}
        </span>
        <span className="tnum w-10 shrink-0 text-right text-sm font-semibold text-paper-2">
          {total === 0 ? "—" : `${row.share}%`}
        </span>
      </div>
    </li>
  );
}

function PollCard({ poll, mine, onVote, isRep, onEdit, onDelete, onToggleClosed }) {
  const now = useNow();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const open = isOpen(poll, now);
  const { rows, total } = results(poll);
  const showResults = canSeeResults(poll, Boolean(mine), isRep);

  async function choose(optionId) {
    setBusy(optionId);
    setError(null);
    try {
      await onVote(poll.id, optionId);
    } catch {
      setError("ხმა ვერ ჩაიწერა. სცადე ხელახლა.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="relative rounded-r-[10px] border border-l-0 border-hairline bg-ink-800 paper-ruled">
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-[22px] w-[1.5px] rounded-full ${
          open ? "bg-blue-pen" : "bg-spent"
        }`}
      />

      <div className="py-4 pl-10 pr-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="measure min-w-0 font-serif text-lg font-semibold text-paper">
            {poll.question}
          </h3>
          {isRep && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => onToggleClosed(poll)}
                aria-label={open ? "დახურვა" : "ხელახლა გახსნა"}
                className="grid size-11 place-items-center rounded-lg text-paper-3 transition-colors hover:bg-ink-700 hover:text-paper"
              >
                {open ? (
                  <Lock size={16} strokeWidth={1.75} />
                ) : (
                  <LockOpen size={16} strokeWidth={1.75} />
                )}
              </button>
              <button
                type="button"
                onClick={() => onEdit(poll)}
                aria-label="რედაქტირება"
                className="grid size-11 place-items-center rounded-lg text-paper-3 transition-colors hover:bg-ink-700 hover:text-paper"
              >
                <Pencil size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(poll)}
                aria-label="წაშლა"
                className="grid size-11 place-items-center rounded-lg text-paper-3 transition-colors hover:bg-ink-700 hover:text-red-text"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>

        <p className="mt-1 text-meta text-paper-3">
          {statusLabel(poll, now)}
          {total > 0 && ` · ${total} ხმა`}
        </p>

        {showResults ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {rows.map((row) => (
              <Bar
                key={row.id}
                row={row}
                mine={mine === row.id}
                total={total}
              />
            ))}
          </ul>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {poll.options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => choose(option.id)}
                  className="flex min-h-12 w-full items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-left text-sm text-paper transition-colors hover:border-blue-pen hover:bg-ink-700 disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">{option.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Showing the results replaced the buttons, so an open poll this
            device has voted in offers the other answers back — otherwise a
            vote would be unchangeable the moment it was cast. */}
        {open && mine && (
          <>
            <p className="mt-2 text-meta text-paper-3">
              ხმა ჩაწერილია. სანამ ღიაა, შეგიძლია შეცვალო:
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {poll.options
                .filter((o) => o.id !== mine)
                .map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => choose(option.id)}
                      className="inline-flex min-h-11 items-center rounded-lg border border-ink-600 px-3 text-meta text-paper-2 transition-colors hover:border-blue-pen hover:text-paper disabled:opacity-60"
                    >
                      {option.label}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        {error && (
          <p role="alert" className="mt-2 text-sm text-red-text">
            {error}
          </p>
        )}

        <p className="mt-2 text-meta text-paper-3">
          {poll.authorName
            ? `კენჭი უყარა ${ergative(poll.authorName)} · ${relativeAgo(poll.createdAt, now)}`
            : relativeAgo(poll.createdAt, now)}
        </p>
      </div>
    </article>
  );
}

export default function PollsView({
  items,
  ballots,
  onVote,
  isRep,
  onEdit,
  onDelete,
  onToggleClosed,
}) {
  const now = useNow();

  // Open votes first — a closed one is a record, an open one is a job.
  const sorted = [...items].sort((a, b) => {
    const rank = (p) => (isOpen(p, now) ? 0 : 1);
    return rank(a) - rank(b) || b.createdAt - a.createdAt;
  });

  const openCount = sorted.filter((p) => isOpen(p, now)).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="px-4 pt-6">
        <h1 className="font-serif text-2xl font-semibold text-paper">
          კენჭისყრა
        </h1>
        <p className="mt-1 text-sm text-paper-2">
          {openCount > 0
            ? `${openCount} ღია კენჭისყრა. ერთი ხმა ერთ ტელეფონზე.`
            : "ღია კენჭისყრა არ არის."}
        </p>
      </header>

      {sorted.length === 0 ? (
        <EmptyState variant={isRep ? "polls-rep" : "polls"} />
      ) : (
        <div className="flex flex-col gap-3 px-4">
          {sorted.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              mine={ballots[poll.id] ?? null}
              onVote={onVote}
              isRep={isRep}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleClosed={onToggleClosed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
