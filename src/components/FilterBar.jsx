import { useRef } from "react";
import { Search, X } from "lucide-react";
import { SUBJECTS } from "../lib/subjects.js";

/**
 * Search and subject filters.
 *
 * The pills are typographic: the active one is marked by an underline drawn
 * in ballpoint blue, like a word underlined in a notebook, rather than by a
 * filled colour chip. Red stays reserved for deadlines.
 */
export default function FilterBar({
  query,
  onQueryChange,
  subject,
  onSubjectChange,
  counts,
}) {
  const inputRef = useRef(null);

  return (
    <div className="px-4 pb-3">
      <div className="relative sm:max-w-md">
        <Search
          size={17}
          strokeWidth={1.75}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-paper-3"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="ძებნა დავალებებში"
          aria-label="ძებნა დავალებებში"
          className="min-h-11 w-full rounded-lg border border-ink-600 bg-ink-700 py-2 pl-10 pr-10 text-base text-paper outline-none transition-colors focus:border-blue-pen [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
            aria-label="ძებნის გასუფთავება"
            className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded text-paper-3 transition-colors hover:text-paper"
          >
            <X size={17} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div
        className="rail -mx-4 mt-3 flex gap-1 px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        role="group"
        aria-label="საგნის ფილტრი"
      >
        <Pill
          active={subject === "all"}
          onClick={() => onSubjectChange("all")}
          label="ყველა"
        />
        {SUBJECTS.filter((s) => counts[s.id] > 0).map((s) => (
          <Pill
            key={s.id}
            active={subject === s.id}
            onClick={() => onSubjectChange(s.id)}
            label={s.name}
            count={counts[s.id]}
          />
        ))}
      </div>
    </div>
  );
}

function Pill({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative min-h-11 shrink-0 scroll-ml-4 whitespace-nowrap px-3 text-sm transition-colors [scroll-snap-align:start] ${
        active ? "text-paper" : "text-paper-3 hover:text-paper-2"
      }`}
    >
      {label}
      {count != null && <span className="tnum ml-1.5 text-meta">{count}</span>}
      <span
        aria-hidden="true"
        className={`absolute inset-x-2 bottom-1.5 h-[2px] rounded-full bg-blue-pen transition-[opacity,transform] duration-300 ${
          active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
        }`}
      />
    </button>
  );
}
