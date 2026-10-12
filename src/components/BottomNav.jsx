import {
  CalendarDays,
  CalendarRange,
  ListChecks,
  PenLine,
  Plus,
  Vote,
} from "lucide-react";

/**
 * Thumb-zone navigation. The bar clears the iOS home indicator through the
 * safe-area inset, and the add button floats above it for signed-in reps so
 * the five tabs keep the same positions whoever is looking.
 *
 * `addLabel` changes with the tab, because the one button has to mean four
 * different things: a homework on the board, a წერა in the term, an event
 * in the diary, a question put to the class. A plus that silently added
 * the wrong kind of thing would be worse than four separate buttons.
 *
 * The ballot tab is labelled კენჭისყრა, the single-word form, rather than
 * კენჭის ყრა: at five tabs the label has one line and about ten characters
 * before it wraps, and the one-word spelling is the standard orthography
 * anyway.
 *
 * **Five is the ceiling.** არქივი used to sit here and now lives as a
 * segmented control inside დავალებები, which is where it belongs anyway —
 * it is the same homework seen later, not a separate section. Six tabs at
 * 360px gives each one about 60px, which is narrower than "დავალებები"
 * can be set without wrapping.
 */
const TABS = [
  { id: "feed", label: "დავალებები", icon: ListChecks },
  { id: "tests", label: "წერები", icon: PenLine },
  { id: "events", label: "ევენთები", icon: CalendarDays },
  { id: "polls", label: "კენჭისყრა", icon: Vote },
  { id: "week", label: "კვირა", icon: CalendarRange },
];

export default function BottomNav({
  view,
  onViewChange,
  isRep,
  onAdd,
  addLabel = "დამატება",
  badge,
}) {
  return (
    <>
      {isRep && (
        <button
          type="button"
          onClick={onAdd}
          className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-red-pen pl-4 pr-5 text-base font-semibold text-ink-900 shadow-[0_6px_20px_-6px_rgb(226_72_58/0.7)] transition-transform duration-200 ease-[var(--ease-tap)] hover:scale-[1.03] active:scale-[0.97]"
        >
          <Plus size={20} strokeWidth={2.5} />
          {addLabel}
        </button>
      )}

      <nav
        aria-label="ხედები"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-ink-850/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-md">
          {TABS.map((tab) => {
            const active = view === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onViewChange(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-0.5 transition-colors ${
                  active ? "text-paper" : "text-paper-3 hover:text-paper-2"
                }`}
              >
                <span className="relative">
                  <Icon size={20} strokeWidth={active ? 2 : 1.6} />
                  {tab.id === "feed" && badge > 0 && (
                    <span className="tnum absolute -right-2.5 -top-1.5 grid min-w-[17px] place-items-center rounded-full bg-red-pen px-1 text-[10px] font-bold leading-[17px] text-ink-900">
                      {badge}
                    </span>
                  )}
                </span>
                {/* 10px rather than 11: დავალებები and კენჭისყრა are ten
                    characters each, and at five tabs that is what keeps
                    them on one line on a 360px phone. */}
                <span className="text-[10px] leading-none">{tab.label}</span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 top-0 h-[2px] rounded-full bg-blue-pen transition-[opacity,transform] duration-300 ${
                    active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
