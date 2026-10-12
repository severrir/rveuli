import { useMemo, useState } from "react";
import {
  Award,
  Bus,
  CalendarDays,
  ChevronDown,
  Clock,
  MapPin,
  Music,
  PartyPopper,
  Pencil,
  Sun,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { getEventKind, splitEvents, whenLabel } from "../lib/events.js";
import {
  ergative,
  formatDate,
  formatTime,
  relativeAgo,
  weekdayLocative,
} from "../lib/georgian.js";
import { useNow } from "../hooks/useNow.js";
import EmptyState from "./EmptyState.jsx";

/**
 * ევენთები — what is happening, as opposed to what is due.
 *
 * Every other card in this app leads with a deadline. These lead with
 * **when and where**, because that is what a student is actually looking
 * for: the bus time and the meeting point, not a countdown.
 *
 * So this is the one view with an icon per kind. Elsewhere identity comes
 * from the paper ruling of the subject's notebook, but an event has no
 * subject — an excursion is not a lesson — and "ექსკურსია" versus
 * "მშობლების კრება" is a distinction worth making scannable.
 */

const ICONS = {
  bus: Bus,
  award: Award,
  users: Users,
  music: Music,
  trophy: Trophy,
  party: PartyPopper,
  sun: Sun,
  calendar: CalendarDays,
};

/** The time, as a window when there is one. */
function timeText(event) {
  const start = formatTime(event.startsAt);
  if (!event.endsAt) return start;
  // An event ending on another day is a trip, not an afternoon.
  const sameDay =
    formatDate(event.startsAt) === formatDate(event.endsAt);
  return sameDay
    ? `${start} – ${formatTime(event.endsAt)}`
    : `${start} – ${formatDate(event.endsAt, { short: true })}, ${formatTime(event.endsAt)}`;
}

function EventCard({ event, isRep, onEdit, onDelete, isPast = false }) {
  const now = useNow();
  const [expanded, setExpanded] = useState(false);

  const kind = getEventKind(event.kind);
  const Icon = ICONS[kind.icon] ?? CalendarDays;
  const { label, soon } = whenLabel(event.startsAt, now);

  return (
    <article
      className={`relative rounded-r-[10px] border border-l-0 border-hairline bg-ink-800 paper-plain transition-opacity duration-300 ${
        isPast ? "opacity-55" : "opacity-100"
      }`}
    >
      {/* Nothing here is ever overdue — an event that has passed simply
          happened — so the rule goes quiet rather than doubling. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-[22px] w-[1.5px] rounded-full"
        style={{
          background: isPast
            ? "var(--color-spent)"
            : soon
              ? "var(--color-red-pen)"
              : "var(--color-blue-dim)",
        }}
      />

      <div className="py-4 pl-10 pr-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Icon
              size={18}
              strokeWidth={1.75}
              aria-hidden="true"
              className={`mt-0.5 shrink-0 ${isPast ? "text-spent" : "text-paper-3"}`}
            />
            <div className="min-w-0">
              <h3 className="measure font-serif text-lg font-semibold text-paper">
                {event.title}
              </h3>
              <p className="mt-0.5 text-meta text-paper-3">{kind.name}</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div
              className={`text-sm font-semibold ${
                isPast ? "text-spent" : soon ? "text-red-text" : "text-paper-2"
              }`}
            >
              {label}
            </div>
            <div className="tnum text-meta text-paper-3">
              {weekdayLocative(event.startsAt)},{" "}
              {formatDate(event.startsAt, { short: true })}
            </div>
          </div>
        </div>

        {/* When and where, together, because they are asked together. */}
        <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">დრო</dt>
            <Clock
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className="shrink-0 text-paper-3"
            />
            <dd className="tnum text-sm text-paper-2">{timeText(event)}</dd>
          </div>
          {event.location && (
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">ადგილი</dt>
              <MapPin
                size={14}
                strokeWidth={1.75}
                aria-hidden="true"
                className="shrink-0 text-paper-3"
              />
              <dd className="truncate text-sm text-paper-2">
                {event.location}
              </dd>
            </div>
          )}
        </dl>

        {event.note && (
          <>
            <p
              className={`measure mt-2 text-sm text-paper-2 ${
                expanded ? "" : "line-clamp-2"
              }`}
            >
              {event.note}
            </p>
            {event.note.length > 100 && (
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
            {event.authorName
              ? `დაამატა ${ergative(event.authorName)} · ${relativeAgo(event.createdAt, now)}`
              : relativeAgo(event.createdAt, now)}
          </p>

          {isRep && (
            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => onEdit(event)}
                aria-label="რედაქტირება"
                className="grid size-11 place-items-center rounded-lg text-paper-3 transition-colors hover:bg-ink-700 hover:text-paper"
              >
                <Pencil size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => onDelete(event)}
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

export default function EventsView({ items, isRep, onEdit, onDelete }) {
  const now = useNow();
  const [showPast, setShowPast] = useState(false);

  const { upcoming, past } = useMemo(
    () => splitEvents(items, now),
    [items, now],
  );

  const next = upcoming[0] ?? null;

  return (
    <div className="flex flex-col gap-4">
      <header className="px-4 pt-6">
        <h1 className="font-serif text-2xl font-semibold text-paper">
          ევენთები
        </h1>
        {next ? (
          <p className="mt-1 text-sm text-paper-2">
            უახლოესი — {next.title},{" "}
            <span className="text-paper">
              {whenLabel(next.startsAt, now).label}
            </span>
            .
          </p>
        ) : (
          <p className="mt-1 text-sm text-paper-2">დაგეგმილი არაფერია.</p>
        )}
      </header>

      {upcoming.length === 0 ? (
        <EmptyState variant={isRep ? "events-rep" : "events"} />
      ) : (
        <div className="flex flex-col gap-3 px-4">
          {upcoming.map((event) => (
            <EventCard
              key={event.id}
              event={event}
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
            გასული — {past.length}
          </button>

          {showPast && (
            <div className="mt-2 flex flex-col gap-3">
              {past.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
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
