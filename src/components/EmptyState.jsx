/**
 * An empty board is an invitation, not an apology. Each state says what is
 * true and, where there is one, what to do next.
 */
export default function EmptyState({ variant = "none", query, onClear }) {
  const copy = {
    none: {
      title: "დავალება არ არის",
      body: "კარგი კვირაა. როგორც კი კლასის უფროსი დაამატებს, აქ გამოჩნდება.",
    },
    "none-rep": {
      title: "ჯერ არაფერია",
      body: "დაამატე პირველი დავალება — ქვემოთ, პლიუსის ღილაკით.",
    },
    search: {
      title: "ვერაფერი ვიპოვე",
      body: `„${query}“ არცერთ დავალებას არ ემთხვევა. სცადე სხვა სიტყვა ან სხვა საგანი.`,
    },
    week: {
      title: "ამ კვირაში სუფთაა",
      body: "ორშაბათიდან შაბათამდე ვადა არცერთ დავალებას არ აქვს.",
    },
    archive: {
      title: "არქივი ცარიელია",
      body: "დასრულებული და ვადაგასული დავალებები აქ ჩამოვა.",
    },
    error: {
      title: "დავალებები ვერ ჩაიტვირთა",
      body: "შეამოწმე ინტერნეტი და სცადე ხელახლა.",
    },
  }[variant];

  return (
    <div className="px-4 py-12">
      <div className="relative mx-auto max-w-sm pl-10">
        {/* The margin rule, drawn on an empty page. */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-[22px] w-[1.5px] rounded-full bg-ink-600"
        />
        <h2 className="font-serif text-xl font-semibold text-paper">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm text-paper-2">{copy.body}</p>
        {variant === "search" && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="mt-4 min-h-11 rounded-lg border border-ink-600 px-4 text-sm text-paper transition-colors hover:bg-ink-700"
          >
            ძებნის გასუფთავება
          </button>
        )}
      </div>
    </div>
  );
}
