import { useMemo, useState } from "react";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { getSubject, PAPER_CLASS } from "../lib/subjects.js";
import { getKind, kindTone, KIND_CLASS, countdown, splitTests } from "../lib/tests.js";
import {
  ergative,
  formatDate,
  relativeAgo,
  weekdayLocative,
} from "../lib/georgian.js";
import { useNow } from "../hooks/useNow.js";
import EmptyState from "./EmptyState.jsx";

/**
 * წერები — the written work ahead.
 *
 * The board answers "what do I hand in tomorrow". This answers a question
 * students actually ask each other in the corridor: "when is the physics
 * one, and what is it on?" So the two things a card leads with are the
 * countdown and the material, and everything else is smaller.
 *
 * The left margin rule means exactly what it means on a homework card —
 * how close the date is — because a second meaning for red would cost the
 * first one its force.
 */

const RULE = {
  today: "var(--color-red-pen)",
  soon: "var(--color-red-dim)",
  later: "var(--color-ink-600)",
  past: "var(--color-spent)",
};

function ruleFor(days, isPast) {
  if (isPast) return RULE.past;
  if (days <= 2) return RULE.today;
  if (days <= 6) return RULE.soon;
  return RULE.later;
}

function TestCard({ test, isRep, onEdit, onDelete, isPast = false }) {
  const now = useNow();
  const [expanded, setExpanded] = useState(false);

  const subject = getSubject(test.subject);
  const kind = getKind(test.kind);
  const { label, urgent } = countdown(test.writtenAt, now);
  const days = Math.ceil((test.writtenAt.getTime() - now) / 86400000);

  return (
    <article
      className={[
        "group relative rounded-r-[10px] border border-l-0 border-hairline bg-ink-800",
        PAPER_CLASS[subject.paper],
        "transition-opacity duration-300",
        isPast ? "opacity-60" : "opacity-100",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-[22px] w-[1.5px] rounded-full transition-colors duration-300"
        style={{ background: ruleFor(days, isPast) }}
      />

      <div className="py-4 pl-10 pr-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="min-w-0 font-serif text-lg font-semibold text-paper">
            {subject.name}
          </h3>
          <div className="shrink-0 text-right">
            <div
              className={`text-sm font-semibold ${
                isPast ? "text-spent" : urgent ? "text-red-text" : "text-paper-2"
              }`}
            >
              {label}
            </div>
            <div className="tnum text-meta text-paper-3">
              {weekdayLocative(test.writtenAt)}, {formatDate(test.writtenAt, { short: true })}
            </div>
          </div>
        </div>

        {/* The kind is the one badge here, and it earns its place: a
            კარნახი and a გამოცდა are not the same news. */}
        <div className="mt-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-meta ${
              KIND_CLASS[kindTone(test.kind)]
            }`}
          >
            {kind.name}
          </span>
        </div>

        <p className="measure mt-2 text-base text-paper">{test.topics}</p>

        {test.note && (
          <>
            <p
              className={`measure mt-1 text-sm text-paper-2 ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {test.note}
            </p>
            {test.note.length > 100 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="-ml-1 mt-0.5 inline-flex min-h-11 items-center px-1 text-meta text-blue-pen underline-offset-4 hover:underline"
              >
                {expanded ? "დახურვა" : "სრულად"}
              </button>
            )}
          </>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-meta text-paper-3">
            {test.authorName
              ? `დაამატა ${ergative(test.authorName)} · ${relativeAgo(test.createdAt, now)}`
              : relativeAgo(test.createdAt, now)}
          </p>

          {isRep && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => onEdit(test)}
                aria-label="რედაქტირება"
                className="grid size-11 place-items-center rounded-lg text-paper-3 transition-colors hover:bg-ink-700 hover:text-paper"
              >
                <Pencil size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(test)}
                aria-label="წაშლა"
                className="grid size-11 place-items-center rounded-lg text-paper-3 transition-colors hover:bg-ink-700 hover:text-red-text"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function TestsView({ items, isRep, onEdit, onDelete }) {
  const now = useNow();
  const [showPast, setShowPast] = useState(false);

  const { upcoming, past } = useMemo(() => splitTests(items, now), [items, now]);

  // The nearest one, said plainly at the top. A student opening this tab is
  // usually checking one thing, and nine times out of ten it is this.
  const next = upcoming[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <header className="px-4 pt-6">
        <h1 className="font-serif text-2xl font-semibold text-paper">წერები</h1>
        {next ? (
          <p className="mt-1 text-sm text-paper-2">
            უახლოესი — {getSubject(next.subject).name},{" "}
            <span className="text-paper">
              {countdown(next.writtenAt, now).label}
            </span>
            .
          </p>
        ) : (
          <p className="mt-1 text-sm text-paper-2">
            დაგეგმილი წერა არ არის.
          </p>
        )}
      </header>

      {upcoming.length === 0 ? (
        <EmptyState variant={isRep ? "tests-rep" : "tests"} />
      ) : (
        <div className="flex flex-col gap-3 px-4">
          {upcoming.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              isRep={isRep}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <section className="px-4 pb-2">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="inline-flex min-h-12 items-center gap-1.5 text-sm text-paper-2 transition-colors hover:text-paper"
          >
            <ChevronDown
              size={16}
              strokeWidth={2}
              className={`transition-transform duration-200 ${
                showPast ? "rotate-180" : ""
              }`}
            />
            ჩაწერილი — {past.length}
          </button>

          {showPast && (
            <div className="mt-2 flex flex-col gap-3">
              {past.map((test) => (
                <TestCard
                  key={test.id}
                  test={test}
                  isRep={isRep}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isPast
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
