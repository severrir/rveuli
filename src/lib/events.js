/**
 * ევენთები — what is happening, as opposed to what is due.
 *
 * Homework and წერები both answer "what is required of me". An event
 * answers two different questions, and they are the two a student actually
 * asks: **when** and **where**. So an event carries a place, which nothing
 * else in this app does, and a time that can be a window rather than a
 * deadline — an excursion starts at nine and ends at four, while homework
 * is only ever due at a moment.
 *
 * Nothing here is ever "overdue". An event that has passed simply happened,
 * which is why the margin rule on an event card goes quiet rather than
 * doubling the way an overdue homework rule does.
 */

export const EVENT_KINDS = [
  { id: "excursion", name: "ექსკურსია", icon: "bus" },
  { id: "olympiad", name: "ოლიმპიადა", icon: "award" },
  { id: "meeting", name: "შეხვედრა", icon: "users" },
  { id: "concert", name: "კონცერტი", icon: "music" },
  { id: "sport", name: "სპორტული", icon: "trophy" },
  { id: "party", name: "კლასის საღამო", icon: "party" },
  { id: "holiday", name: "დასვენება", icon: "sun" },
  { id: "other", name: "სხვა", icon: "calendar" },
];

export const EVENT_KIND_IDS = EVENT_KINDS.map((k) => k.id);

const BY_ID = new Map(EVENT_KINDS.map((k) => [k.id, k]));

/** Falls back to a neutral entry so an unknown id never blanks a card. */
export function getEventKind(id) {
  return BY_ID.get(id) ?? { id, name: id ?? "ევენთი", icon: "calendar" };
}

/**
 * Split into what is still ahead and what has already happened.
 *
 * An event counts as over once its end has passed — or, when no end was
 * given, once the day it falls on is over. An excursion at 09:00 is not
 * "past" at 10:00 that morning; the class is on it.
 */
export function splitEvents(items, now = Date.now()) {
  const upcoming = [];
  const past = [];

  for (const e of items) {
    const over = e.endsAt
      ? e.endsAt.getTime() < now
      : endOfTbilisiDay(e.startsAt) < now;
    if (over) past.push(e);
    else upcoming.push(e);
  }

  upcoming.sort((a, b) => a.startsAt - b.startsAt);
  past.sort((a, b) => b.startsAt - a.startsAt);
  return { upcoming, past };
}

/** Midnight at the end of the Tbilisi day `value` falls on, as an instant. */
function endOfTbilisiDay(value) {
  // Tbilisi is UTC+4 all year, so the day ends at 20:00 UTC.
  const local = new Date(value.getTime() + 4 * 3600000);
  return (
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + 1,
    ) -
    4 * 3600000
  );
}

/**
 * How far off it is. Coarser than a homework deadline on purpose: you do
 * not need to know an excursion is in 41 hours, only that it is ხვალ.
 */
export function whenLabel(startsAt, now = Date.now()) {
  const days = Math.ceil((startsAt.getTime() - now) / 86400000);
  if (days < 0) return { label: "გასულია", soon: false };
  if (days === 0) return { label: "დღეს", soon: true };
  if (days === 1) return { label: "ხვალ", soon: true };
  if (days === 2) return { label: "ზეგ", soon: true };
  if (days <= 13) return { label: `${days} დღეში`, soon: days <= 6 };
  const weeks = Math.round(days / 7);
  return { label: `${weeks} კვირაში`, soon: false };
}
