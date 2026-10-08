import { Archive, CalendarRange, ListChecks, Plus } from "lucide-react";

/**
 * Thumb-zone navigation. The bar clears the iOS home indicator through the
 * safe-area inset, and the add button floats above it for signed-in reps so
 * the three tabs keep the same positions whoever is looking.
 */
const TABS = [
  { id: "feed", label: "დავალებები", icon: ListChecks },
  { id: "week", label: "კვირა", icon: CalendarRange },
  { id: "archive", label: "არქივი", icon: Archive },
];

export default function BottomNav({ view, onViewChange, isRep, onAdd, badge }) {
  return (
    <>
      {isRep && (
        <button
          type="button"
          onClick={onAdd}
          className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-red-pen pl-4 pr-5 text-base font-semibold text-ink-900 shadow-[0_6px_20px_-6px_rgb(226_72_58/0.7)] transition-transform duration-200 ease-[var(--ease-tap)] hover:scale-[1.03] active:scale-[0.97]"
        >
          <Plus size={20} strokeWidth={2.5} />
          დამატება
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
                className={`relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                  active ? "text-paper" : "text-paper-3 hover:text-paper-2"
                }`}
              >
                <span className="relative">
                  <Icon size={21} strokeWidth={active ? 2 : 1.6} />
                  {tab.id === "feed" && badge > 0 && (
                    <span className="tnum absolute -right-2.5 -top-1.5 grid min-w-[17px] place-items-center rounded-full bg-red-pen px-1 text-[10px] font-bold leading-[17px] text-ink-900">
                      {badge}
                    </span>
                  )}
                </span>
                <span className="text-[11px] leading-none">{tab.label}</span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-5 top-0 h-[2px] rounded-full bg-blue-pen transition-[opacity,transform] duration-300 ${
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
