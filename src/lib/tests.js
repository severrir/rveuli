/**
 * წერები — the written work a class is assessed on.
 *
 * A test is not a homework with a different label. Homework asks "what do I
 * have to hand in", and once it is handed in it is gone; a test asks "how
 * long have I got, and what is it on", and it stays on the horizon for
 * weeks. That is a different question, read at a different distance, so it
 * gets its own tab rather than a filter on the board.
 *
 * `weight` is how much the mark actually costs a term. It drives nothing
 * about the red margin rule — red means deadline here exactly as it does on
 * a homework card — it only decides how loudly the kind is announced, so a
 * გამოცდა cannot be mistaken for a კარნახი at a glance.
 */

export const TEST_KINDS = [
  { id: "dictation", name: "კარნახი", short: "კარნახი", weight: 1 },
  { id: "quiz", name: "ტესტი", short: "ტესტი", weight: 1 },
  { id: "oral", name: "ზეპირი გამოკითხვა", short: "ზეპირი", weight: 1 },
  { id: "control", name: "საკონტროლო", short: "საკონტროლო", weight: 2 },
  { id: "summary", name: "შემაჯამებელი", short: "შემაჯამებელი", weight: 3 },
  { id: "exam", name: "გამოცდა", short: "გამოცდა", weight: 4 },
];

export const TEST_KIND_IDS = TEST_KINDS.map((k) => k.id);

const BY_ID = new Map(TEST_KINDS.map((k) => [k.id, k]));

/** Falls back to a neutral entry so an unknown id never blanks a card. */
export function getKind(id) {
  return (
    BY_ID.get(id) ?? { id, name: id ?? "წერა", short: "წერა", weight: 2 }
  );
}

/**
 * How hard the kind is drawn. A შემაჯამებელი or a გამოცდა is the thing a
 * student is actually afraid of, and the pill should say so without
 * borrowing red, which is spoken for.
 */
export function kindTone(id) {
  const { weight } = getKind(id);
  if (weight >= 3) return "heavy";
  if (weight === 2) return "medium";
  return "light";
}

export const KIND_CLASS = {
  heavy: "border-paper-3/40 bg-paper/10 text-paper",
  medium: "border-blue-dim bg-blue-dim/25 text-blue-pen",
  light: "border-ink-600 bg-ink-700/70 text-paper-3",
};

/**
 * Tests in reading order: what is already written, then everything ahead of
 * it nearest first.
 *
 * `past` is kept rather than dropped. A student checking "did we already
 * write the chemistry one?" is asking a real question, and a term's written
 * work is the one list in this app worth looking backwards through.
 */
export function splitTests(items, now = Date.now()) {
  const upcoming = [];
  const past = [];
  for (const t of items) {
    if (t.writtenAt.getTime() < now) past.push(t);
    else upcoming.push(t);
  }
  upcoming.sort((a, b) => a.writtenAt - b.writtenAt);
  past.sort((a, b) => b.writtenAt - a.writtenAt);
  return { upcoming, past };
}

/**
 * The countdown line. Deliberately coarser than a homework deadline: a test
 * three weeks out is "3 კვირაში", because nobody revises to the hour and a
 * precise number of days that far ahead is false precision.
 */
export function countdown(writtenAt, now = Date.now()) {
  const days = Math.ceil((writtenAt.getTime() - now) / 86400000);
  if (days < 0) return { label: "ჩაწერილია", urgent: false };
  if (days === 0) return { label: "დღეს", urgent: true };
  if (days === 1) return { label: "ხვალ", urgent: true };
  if (days === 2) return { label: "ზეგ", urgent: true };
  if (days <= 13) return { label: `${days} დღეში`, urgent: days <= 6 };
  const weeks = Math.round(days / 7);
  return { label: `${weeks} კვირაში`, urgent: false };
}
