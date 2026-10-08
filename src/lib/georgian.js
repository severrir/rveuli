/**
 * Georgian dates and relative time, computed in Asia/Tbilisi.
 *
 * Everything here deliberately ignores the device timezone. A student whose
 * phone is set to another zone (or whose browser lies about it) must still
 * read the same "ხვალ" as everyone else in the class, because the deadline
 * belongs to the school day, not to the handset.
 *
 * Georgian needs no plural agreement after a numeral — "1 დღე", "5 დღე" —
 * so there are no plural rules to apply. Weekdays do inflect, though: the
 * "on Monday" form is ორშაბათს, not ორშაბათი, so they get their own table.
 */

export const TZ = "Asia/Tbilisi";

const MONTHS = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

const MONTHS_SHORT = [
  "იან",
  "თებ",
  "მარ",
  "აპრ",
  "მაი",
  "ივნ",
  "ივლ",
  "აგვ",
  "სექ",
  "ოქტ",
  "ნოე",
  "დეკ",
];

/** Nominative: used as a column heading. Index 0 = Monday. */
export const WEEKDAYS = [
  "ორშაბათი",
  "სამშაბათი",
  "ოთხშაბათი",
  "ხუთშაბათი",
  "პარასკევი",
  "შაბათი",
  "კვირა",
];

/** Short form for the narrow week columns. Index 0 = Monday. */
export const WEEKDAYS_SHORT = ["ორშ", "სამ", "ოთხ", "ხუთ", "პარ", "შაბ", "კვი"];

/** Locative: "due ON Monday" — ორშაბათს. Index 0 = Monday. */
const WEEKDAYS_LOCATIVE = [
  "ორშაბათს",
  "სამშაბათს",
  "ოთხშაბათს",
  "ხუთშაბათს",
  "პარასკევს",
  "შაბათს",
  "კვირას",
];

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Clock-face values in Tbilisi, regardless of where the device thinks it is.
 * `weekday` is 0 = Monday .. 6 = Sunday, matching the Mon–Sat week view.
 */
export function tbilisiParts(value) {
  const parts = partsFormatter.formatToParts(toDate(value));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };
}

/**
 * A stable integer for "which calendar day in Tbilisi is this", so two dates
 * can be compared by day without any timezone arithmetic at the call site.
 */
export function tbilisiDayNumber(value) {
  const { year, month, day } = tbilisiParts(value);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

/** Whole calendar days from `from` to `to`, in Tbilisi. Negative = past. */
export function dayDelta(to, from = new Date()) {
  return tbilisiDayNumber(to) - tbilisiDayNumber(from);
}

export function formatTime(value) {
  const { hour, minute } = tbilisiParts(value);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatDate(value, { short = false } = {}) {
  const { day, month } = tbilisiParts(value);
  const names = short ? MONTHS_SHORT : MONTHS;
  return `${day} ${names[month - 1]}`;
}

export function formatMonthYear(value) {
  const { month, year } = tbilisiParts(value);
  return `${MONTHS[month - 1]} ${year}`;
}

export function weekdayLocative(value) {
  return WEEKDAYS_LOCATIVE[tbilisiParts(value).weekday];
}

/**
 * How a deadline reads on a card.
 *
 * `tone` drives the margin rule, so the wording and the colour of the line
 * can never disagree:
 *   overdue  — solid red plus a red mark in the margin
 *   urgent   — solid red (today or tomorrow)
 *   soon     — a lightly drawn red line (two to three days out)
 *   later    — a faint blue-grey line
 */
export function describeDue(dueAt, now = new Date()) {
  const due = toDate(dueAt);
  const delta = dayDelta(due, now);
  const msAway = due.getTime() - toDate(now).getTime();

  if (msAway < 0) {
    const lateDays = Math.max(0, -delta);
    return {
      tone: "overdue",
      label: "ვადა გასულია",
      detail:
        lateDays === 0
          ? `დღეს, ${formatTime(due)}`
          : lateDays === 1
            ? "ერთი დღით დაგვიანებით"
            : `${lateDays} დღით დაგვიანებით`,
      delta,
    };
  }

  if (delta === 0) {
    const minutes = Math.round(msAway / 60000);
    if (minutes < 60) {
      return {
        tone: "urgent",
        label: minutes <= 1 ? "ახლავე" : `${minutes} წუთში`,
        detail: `დღეს, ${formatTime(due)}`,
        delta,
      };
    }
    const hours = Math.round(minutes / 60);
    return {
      tone: "urgent",
      label: hours <= 6 ? `${hours} საათში` : "დღეს",
      detail: formatTime(due),
      delta,
    };
  }

  if (delta === 1) {
    return { tone: "urgent", label: "ხვალ", detail: formatTime(due), delta };
  }

  if (delta === 2) {
    return { tone: "soon", label: "ზეგ", detail: formatTime(due), delta };
  }

  if (delta <= 6) {
    return {
      tone: "soon",
      label: `${delta} დღეში`,
      detail: weekdayLocative(due),
      delta,
    };
  }

  if (delta <= 9) {
    return {
      tone: "later",
      label: `${delta} დღეში`,
      detail: formatDate(due, { short: true }),
      delta,
    };
  }

  return {
    tone: "later",
    label: formatDate(due, { short: true }),
    detail: weekdayLocative(due),
    delta,
  };
}

/**
 * Ergative case for the attribution line: "დაამატა ნინომ".
 * Georgian takes -მ after a vowel and -მა after a consonant, so
 * ნინო → ნინომ, გიორგი → გიორგიმ, but მარიამ → მარიამმა.
 */
const VOWELS = new Set(["ა", "ე", "ი", "ო", "უ"]);

export function ergative(name) {
  if (!name) return "";
  const last = name.trim().slice(-1);
  return name + (VOWELS.has(last) ? "მ" : "მა");
}

/** "2 სთ წინ" — for the attribution line under an entry. */
export function relativeAgo(value, now = new Date()) {
  const ms = toDate(now).getTime() - toDate(value).getTime();
  if (ms < 60000) return "ახლახან";

  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} წთ წინ`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} სთ წინ`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "გუშინ";
  if (days < 7) return `${days} დღის წინ`;

  return formatDate(value, { short: true });
}

/**
 * Monday–Saturday of the week containing `value`, as Date objects fixed to
 * midday Tbilisi. Midday keeps every entry safely inside its own calendar
 * day no matter how the browser rounds the conversion.
 */
export function tbilisiWeek(value = new Date()) {
  const { year, month, day, weekday } = tbilisiParts(value);
  const mondayUtcMs = Date.UTC(year, month - 1, day) - weekday * 86400000;
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(mondayUtcMs + i * 86400000);
    // 08:00 UTC is midday in Tbilisi (UTC+4, no daylight saving).
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 8, 0, 0),
    );
  });
}

export function isSameTbilisiDay(a, b) {
  return tbilisiDayNumber(a) === tbilisiDayNumber(b);
}

/**
 * The value a `datetime-local` input needs, expressed in Tbilisi clock time
 * so a rep types the hour they mean rather than the hour their phone is on.
 */
export function toLocalInputValue(value) {
  const { year, month, day, hour, minute } = tbilisiParts(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

/** The inverse: read a `datetime-local` string as Tbilisi wall-clock time. */
export function fromLocalInputValue(text) {
  if (!text) return null;
  const [date, time = "00:00"] = text.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // Tbilisi is UTC+4 all year — Georgia has not observed DST since 2005.
  return new Date(Date.UTC(y, m - 1, d, hh - 4, mm, 0));
}
