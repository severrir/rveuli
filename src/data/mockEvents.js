/**
 * Seed ევენთები for IX კლასი.
 *
 * Offsets from load, like the other seeds, so the tab always opens on a
 * believable term: something tomorrow, an excursion with a real time
 * window, and one that has already happened.
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

export const MOCK_EVENTS = [
  {
    id: "ev-01",
    title: "ექსკურსია — ვარძია და ახალციხე",
    kind: "excursion",
    location: "შეხვედრა სკოლის ეზოში",
    note: "ავტობუსი 08:00-ზე გადის, დაგვიანებულს ვერ დაველოდებით. თან იქონიეთ საჭმელი, წყალი და ქურთუკი — ვარძიაში ცივა.",
    starts_at: at(9, 8),
    ends_at: at(9, 19),
    created_by: "rep-nino",
    created_at: ago(40),
    updated_at: null,
  },
  {
    id: "ev-02",
    title: "მათემატიკის ოლიმპიადა — სასკოლო ეტაპი",
    kind: "olympiad",
    location: "ოთახი 24",
    note: "დარეგისტრირებულები: სია დაფაზეა. ვინც ჯერ არ ჩაწერილა, ნინოს მიმართეთ.",
    starts_at: at(4, 10),
    ends_at: at(4, 13),
    created_by: "rep-nino",
    created_at: ago(30),
    updated_at: null,
  },
  {
    id: "ev-03",
    title: "მშობლების კრება",
    kind: "meeting",
    location: "ჩვენი საკლასო ოთახი",
    note: null,
    starts_at: at(1, 18),
    ends_at: null,
    created_by: "rep-giorgi",
    created_at: ago(12),
    updated_at: null,
  },
  {
    id: "ev-04",
    title: "კლასის საღამო",
    kind: "party",
    location: "სკოლის დარბაზი",
    note: "კენჭისყრით გადავწყვიტეთ — პარასკევს, გაკვეთილების შემდეგ. თითო კაცზე 5 ლარი, გიორგი აგროვებს.",
    starts_at: at(6, 15),
    ends_at: at(6, 19),
    created_by: "rep-mariam",
    created_at: ago(20),
    updated_at: null,
  },
  {
    id: "ev-05",
    title: "კალათბურთის ტურნირი — ფინალი",
    kind: "sport",
    location: "სპორტული დარბაზი",
    note: "მხარდასაჭერად მოდით. ფორმა არ გჭირდებათ.",
    starts_at: at(2, 14),
    ends_at: at(2, 16),
    created_by: "rep-giorgi",
    created_at: ago(26),
    updated_at: null,
  },
  {
    id: "ev-06",
    title: "შემოდგომის კონცერტი",
    kind: "concert",
    location: "სკოლის დარბაზი",
    note: null,
    starts_at: at(-5, 17),
    ends_at: at(-5, 19),
    created_by: "rep-mariam",
    created_at: ago(220),
    updated_at: null,
  },
  {
    id: "ev-07",
    title: "14 ოქტომბერი — მცხეთობა, დასვენება",
    kind: "holiday",
    location: null,
    note: "გაკვეთილები არ იქნება.",
    starts_at: at(16, 9),
    ends_at: null,
    created_by: "rep-nino",
    created_at: ago(60),
    updated_at: null,
  },
];
