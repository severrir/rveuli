/**
 * The fourteen subjects of IX კლასი, and the notebook each one lives in.
 *
 * `paper` is the ruling the card is printed on — the same notebook a student
 * would actually open for that lesson. It carries subject identity so the
 * cards never need a colour-coded badge, which keeps red free to mean
 * "deadline" and nothing else.
 *
 *   squared — exact sciences, worked on grid paper
 *   ruled   — language, literature and the humanities
 *   plain   — art, music and sport, where you rarely write at all
 */

export const PAPER = {
  SQUARED: "squared",
  RULED: "ruled",
  PLAIN: "plain",
};

export const SUBJECTS = [
  { id: "math", name: "მათემატიკა", monogram: "მა", paper: PAPER.SQUARED },
  { id: "physics", name: "ფიზიკა", monogram: "ფი", paper: PAPER.SQUARED },
  { id: "chemistry", name: "ქიმია", monogram: "ქი", paper: PAPER.SQUARED },
  { id: "biology", name: "ბიოლოგია", monogram: "ბი", paper: PAPER.RULED },
  { id: "geography", name: "გეოგრაფია", monogram: "გე", paper: PAPER.RULED },
  { id: "history", name: "ისტორია", monogram: "ის", paper: PAPER.RULED },
  { id: "geo-lang", name: "ქართული ენა", monogram: "ქე", paper: PAPER.RULED },
  {
    id: "geo-lit",
    name: "ქართული ლიტერატურა",
    monogram: "ქლ",
    paper: PAPER.RULED,
  },
  { id: "english", name: "ინგლისური", monogram: "ინ", paper: PAPER.RULED },
  { id: "german", name: "გერმანული", monogram: "გერ", paper: PAPER.RULED },
  {
    id: "civics",
    name: "სამოქალაქო განათლება",
    monogram: "სგ",
    paper: PAPER.RULED,
  },
  { id: "art", name: "ხელოვნება", monogram: "ხე", paper: PAPER.PLAIN },
  { id: "music", name: "მუსიკა", monogram: "მუ", paper: PAPER.PLAIN },
  { id: "sport", name: "სპორტი", monogram: "სპ", paper: PAPER.PLAIN },
];

const BY_ID = new Map(SUBJECTS.map((s) => [s.id, s]));

/** Falls back to a neutral entry so an unknown id never blanks a card. */
export function getSubject(id) {
  return (
    BY_ID.get(id) ?? {
      id,
      name: id ?? "სხვა",
      monogram: "—",
      paper: PAPER.PLAIN,
    }
  );
}

export const PAPER_CLASS = {
  [PAPER.SQUARED]: "paper-squared",
  [PAPER.RULED]: "paper-ruled",
  [PAPER.PLAIN]: "paper-plain",
};

/** Subject ids, for the database CHECK constraint and form validation. */
export const SUBJECT_IDS = SUBJECTS.map((s) => s.id);
