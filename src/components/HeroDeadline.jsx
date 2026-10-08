import { getSubject } from "../lib/subjects.js";
import { describeDue, formatTime, weekdayLocative } from "../lib/georgian.js";
import { useNow } from "../hooks/useNow.js";

/**
 * The opening answer to the only question a student actually has: what do I
 * have to do next? One unfinished deadline, named large, with the counts
 * underneath as a quiet single line rather than a row of metric tiles.
 */
export default function HeroDeadline({ next, weekTotal, weekDone }) {
  const now = useNow();

  if (!next) {
    return (
      <header className="animate-settle px-4 pb-5 pt-6">
        <h1 className="font-serif text-2xl font-semibold text-paper">
          ყველაფერი შესრულებულია
        </h1>
        <p className="mt-1.5 measure text-sm text-paper-2">
          ამ კვირაში დავალება აღარ გელოდება. დანარჩენი არქივშია.
        </p>
      </header>
    );
  }

  const subject = getSubject(next.subject);
  const due = describeDue(next.dueAt, now);
  const urgent = due.tone === "overdue" || due.tone === "urgent";

  return (
    <header className="relative animate-settle px-4 pb-4 pt-5">
      <p className="text-sm text-paper-3">შემდეგი</p>

      <div className="mt-1 flex items-start gap-3">
        {/* The rule continues from the cards up into the hero. */}
        <span
          aria-hidden="true"
          className="animate-rule mt-1.5 w-[2px] shrink-0 self-stretch rounded-full"
          style={{
            background: urgent
              ? "var(--color-red-pen)"
              : "var(--color-ink-600)",
          }}
        />
        <div className="min-w-0">
          <h1 className="font-serif text-2xl font-semibold text-paper sm:text-3xl">
            {subject.name}
          </h1>
          <p className="mt-1 measure text-base text-paper-2">{next.title}</p>
          <p
            className={`tnum mt-2 text-lg font-semibold ${
              urgent ? "text-red-text" : "text-paper"
            }`}
          >
            {due.label}
            <span className="ml-2 text-sm font-normal text-paper-3">
              {due.tone === "overdue"
                ? due.detail
                : `${weekdayLocative(next.dueAt)}, ${formatTime(next.dueAt)}`}
            </span>
          </p>
        </div>
      </div>

      <p className="tnum mt-4 border-t border-hairline pt-3 text-sm text-paper-3">
        ამ კვირაში {weekTotal} დავალება, {weekDone} შესრულებული
      </p>
    </header>
  );
}
