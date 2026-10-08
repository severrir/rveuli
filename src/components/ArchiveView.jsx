import { getSubject } from "../lib/subjects.js";
import { formatDate, formatMonthYear, formatTime } from "../lib/georgian.js";
import EmptyState from "./EmptyState.jsx";

/**
 * What the class has already been through. Grouped by month, newest first,
 * so looking up "what did we have to read before the holidays" takes one
 * scroll rather than a search through a chat.
 */
export default function ArchiveView({ items, doneSet, query }) {
  if (items.length === 0) {
    return query ? (
      <EmptyState variant="search" query={query} />
    ) : (
      <EmptyState variant="archive" />
    );
  }

  const groups = [];
  for (const item of items) {
    const key = formatMonthYear(item.dueAt);
    const last = groups.at(-1);
    if (last?.key === key) last.entries.push(item);
    else groups.push({ key, entries: [item] });
  }

  return (
    <div className="px-4">
      {groups.map((group) => (
        <section key={group.key} className="mb-7">
          <h2 className="mb-2.5 font-serif text-base font-semibold text-paper-2">
            {group.key}
          </h2>

          <ul className="flex flex-col gap-px overflow-hidden rounded-lg border border-hairline">
            {group.entries.map((item) => {
              const done = doneSet.has(item.id);
              return (
                <li
                  key={item.id}
                  className="relative bg-ink-800/70 py-2.5 pl-10 pr-3"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-[22px] w-[1.5px] ${
                      done ? "bg-spent/50" : "bg-ink-600"
                    }`}
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={`font-serif text-sm font-semibold ${
                        done ? "text-spent" : "text-paper-2"
                      }`}
                    >
                      {getSubject(item.subject).name}
                    </span>
                    <span className="tnum shrink-0 text-meta text-paper-3">
                      {formatDate(item.dueAt, { short: true })},{" "}
                      {formatTime(item.dueAt)}
                    </span>
                  </div>
                  <p
                    className={`mt-0.5 text-sm ${
                      done ? "text-spent line-through decoration-spent" : "text-paper"
                    }`}
                  >
                    {item.title}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
