import { getSubject } from "../lib/subjects.js";
import {
  formatDate,
  formatTime,
  isSameTbilisiDay,
  tbilisiWeek,
  WEEKDAYS,
} from "../lib/georgian.js";
import EmptyState from "./EmptyState.jsx";
import { useNow } from "../hooks/useNow.js";

/**
 * Monday to Saturday, the Georgian school week.
 *
 * This answers a different question from the feed: not "what is next" but
 * "how heavy is this week, and which day will hurt". Each day is a page in
 * the notebook, so the margin rule runs down every column — solid red on
 * today, faint on the rest.
 */
export default function WeekView({ items, doneSet }) {
  const now = useNow();
  const days = tbilisiWeek(now);

  const byDay = days.map((day) => ({
    day,
    isToday: isSameTbilisiDay(day, now),
    entries: items
      .filter((i) => isSameTbilisiDay(i.dueAt, day))
      .sort((a, b) => a.dueAt - b.dueAt),
  }));

  const total = byDay.reduce((n, d) => n + d.entries.length, 0);
  if (total === 0) return <EmptyState variant="week" />;

  return (
    <div className="px-4">
      <p className="tnum mb-4 text-sm text-paper-3">
        ორშაბათიდან შაბათამდე {total} დავალება
      </p>

      <ol className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:items-start lg:grid-cols-3">
        {byDay.map(({ day, isToday, entries }, i) => {
          const remaining = entries.filter((e) => !doneSet.has(e.id)).length;
          const empty = entries.length === 0;

          return (
            <li
              key={i}
              className={`relative rounded-r-[10px] border border-l-0 border-hairline pl-10 pr-3 transition-colors ${
                empty ? "py-2" : "py-3"
              } ${isToday ? "bg-ink-800" : "bg-ink-800/45"}`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-[22px] w-[1.5px] rounded-full ${
                  isToday
                    ? "bg-red-pen"
                    : remaining > 0
                      ? "bg-ink-600"
                      : "bg-spent/50"
                }`}
              />

              <div className="flex items-baseline justify-between gap-2">
                <h3
                  className={`font-serif text-base font-semibold ${
                    isToday ? "text-paper" : empty ? "text-paper-3" : "text-paper-2"
                  }`}
                >
                  {WEEKDAYS[i]}
                  {isToday && (
                    <span className="ml-2 text-meta font-normal text-red-text">
                      დღეს
                    </span>
                  )}
                </h3>

                {/* An empty day collapses to a single line, so the shape
                    of the week reads from the row heights alone. */}
                <span className="tnum shrink-0 text-meta text-paper-3">
                  {formatDate(day, { short: true })}
                </span>
              </div>

              {!empty && (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {entries.map((e) => {
                    const done = doneSet.has(e.id);
                    return (
                      <li key={e.id} className="flex items-baseline gap-2">
                        <span className="tnum shrink-0 text-meta text-paper-3">
                          {formatTime(e.dueAt)}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate text-sm ${
                            done
                              ? "text-spent line-through decoration-spent"
                              : "text-paper"
                          }`}
                        >
                          {getSubject(e.subject).name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
