/**
 * Seed წერები for IX კლასი.
 *
 * Dates are offsets from load, like the homework seed, so the tab always
 * opens on a believable term — something written last week, something on
 * Thursday, a შემაჯამებელი far enough out to still be revisable.
 */

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

/** `days` from now at a given Tbilisi hour, never landing on a Sunday. */
function at(days, hour = 9) {
  const base = new Date(Date.now() + days * DAY);
  // 09:00 Tbilisi is 05:00 UTC (UTC+4, no daylight saving).
  let when = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      hour - 4,
    ),
  );
  if (new Date(when.getTime() + 4 * HOUR).getUTCDay() === 0) {
    when = new Date(when.getTime() + DAY);
  }
  return when.toISOString();
}

const ago = (hours) => new Date(Date.now() - hours * HOUR).toISOString();

export const MOCK_TESTS = [
  {
    id: "ts-01",
    subject: "physics",
    kind: "summary",
    topics: "მესამე თავი სრულად — სიჩქარე, აჩქარება, თავისუფალი ვარდნა",
    note: "ფორმულების ფურცელი თან იქონიეთ. კალკულატორი არ დაგჭირდებათ.",
    written_at: at(3, 10),
    created_by: "rep-giorgi",
    created_at: ago(26),
    updated_at: null,
  },
  {
    id: "ts-02",
    subject: "math",
    kind: "control",
    topics: "კვადრატული განტოლებები, ვიეტის თეორემა",
    note: null,
    written_at: at(1, 9),
    created_by: "rep-nino",
    created_at: ago(20),
    updated_at: null,
  },
  {
    id: "ts-03",
    subject: "english",
    kind: "dictation",
    topics: "Unit 4 — ახალი ლექსიკა",
    note: null,
    written_at: at(2, 9),
    created_by: "rep-giorgi",
    created_at: ago(28),
    updated_at: null,
  },
  {
    id: "ts-04",
    subject: "geo-lit",
    kind: "oral",
    topics: "ავთანდილის ანდერძი — სტროფები 790–805",
    note: "ვისაც გასულ კვირას არ უპასუხია, პირველები იკითხებით.",
    written_at: at(5, 11),
    created_by: "rep-nino",
    created_at: ago(30),
    updated_at: null,
  },
  {
    id: "ts-05",
    subject: "chemistry",
    kind: "summary",
    topics: "ოქსიდები, ფუძეები, მჟავები — §16–19",
    note: "რეაქციების განტოლებები კოეფიციენტებით.",
    written_at: at(12, 10),
    created_by: "rep-mariam",
    created_at: ago(14),
    updated_at: null,
  },
  {
    id: "ts-06",
    subject: "history",
    kind: "control",
    topics: "დავით აღმაშენებელი, დიდგორის ბრძოლა, ოქროს ხანა",
    note: null,
    written_at: at(8, 10),
    created_by: "rep-mariam",
    created_at: ago(50),
    updated_at: null,
  },
  {
    id: "ts-07",
    subject: "german",
    kind: "quiz",
    topics: "Lektion 3 — ლექსიკა და ნაცვალსახელები",
    note: null,
    written_at: at(-4, 11),
    created_by: "rep-mariam",
    created_at: ago(190),
    updated_at: null,
  },
  {
    id: "ts-08",
    subject: "biology",
    kind: "control",
    topics: "უჯრედის აგებულება და ორგანოიდების ფუნქციები",
    note: null,
    written_at: at(-9, 12),
    created_by: "rep-nino",
    created_at: ago(300),
    updated_at: null,
  },
  {
    id: "ts-09",
    subject: "geo-lang",
    kind: "exam",
    topics: "I ნახევარწლიური — ზმნა, ბრუნვები, სინტაქსი",
    note: "ორი გაკვეთილი ზედიზედ. ლექსიკონის გამოყენება არ შეიძლება.",
    written_at: at(21, 9),
    created_by: "rep-nino",
    created_at: ago(70),
    updated_at: null,
  },
];
