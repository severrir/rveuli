/**
 * Seed კენჭისყრა for IX კლასი.
 *
 * One open vote with a few ballots already in, one that closes tonight and
 * one already decided — so the tab demonstrates all three states without
 * anyone having to wait for a deadline to pass.
 *
 * `tally` stands in for what `poll_tallies()` returns once a project is
 * attached, which is why it is counts and never voter keys even here.
 */

const HOUR = 3600 * 1000;

const ahead = (hours) => new Date(Date.now() + hours * HOUR).toISOString();
const ago = (hours) => new Date(Date.now() - hours * HOUR).toISOString();

export const MOCK_POLLS = [
  {
    id: "pl-01",
    question: "სად წავიდეთ ექსკურსიაზე?",
    options: [
      { id: "a", label: "ყაზბეგი" },
      { id: "b", label: "ვარძია და ახალციხე" },
      { id: "c", label: "ბათუმი" },
      { id: "d", label: "სვანეთი" },
    ],
    closes_at: ahead(70),
    closed_at: null,
    created_by: "rep-nino",
    created_at: ago(9),
    updated_at: null,
    tally: { a: 7, b: 4, c: 9, d: 3 },
  },
  {
    id: "pl-02",
    question: "ფიზიკის შემაჯამებელი ხუთშაბათს თუ პარასკევს?",
    options: [
      { id: "a", label: "ხუთშაბათს" },
      { id: "b", label: "პარასკევს" },
    ],
    closes_at: ahead(6),
    closed_at: null,
    created_by: "rep-giorgi",
    created_at: ago(18),
    updated_at: null,
    tally: { a: 5, b: 13 },
  },
  {
    id: "pl-03",
    question: "კლასის საღამო რომელ დღეს გავაკეთოთ?",
    options: [
      { id: "a", label: "პარასკევს, გაკვეთილების შემდეგ" },
      { id: "b", label: "შაბათს შუადღისას" },
      { id: "c", label: "შემდეგ კვირაში" },
    ],
    closes_at: null,
    closed_at: ago(30),
    created_by: "rep-mariam",
    created_at: ago(120),
    updated_at: null,
    tally: { a: 16, b: 6, c: 2 },
  },
];
