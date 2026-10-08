import { Bell, LogIn, LogOut } from "lucide-react";
import InstallButton from "./InstallButton.jsx";

/**
 * The header stays put while the board scrolls under it, so the class and
 * the current role are always answerable. The blur is here to keep the
 * title legible over moving cards, not as an effect.
 */
export default function Navbar({ rep, onSignIn, onSignOut, onToast, onReminders }) {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-ink-900/92 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-lg font-semibold leading-tight text-paper">
            რვეული
          </h1>
          <p className="truncate text-meta text-paper-3">
            {/* Three controls leave ~129px here; the full school name
                needs 146 and was being cut mid-word. */}
            <span className="sm:hidden">IX კლასი</span>
            <span className="hidden sm:inline">
              რუსთავის №4 საჯარო სკოლა, IX კლასი
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onReminders}
          aria-label="შეხსენებები"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-ink-600 text-paper-2 transition-colors hover:bg-ink-700 hover:text-paper"
        >
          <Bell size={16} strokeWidth={1.75} />
        </button>

        <InstallButton onToast={onToast} />

        {rep ? (
          <>
            <span className="hidden text-right text-meta leading-tight text-paper-2 sm:block">
              {rep.display_name}
              <span className="block text-paper-3">კლასის უფროსი</span>
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-ink-600 px-3 text-sm text-paper-2 transition-colors hover:bg-ink-700 hover:text-paper"
              aria-label="გასვლა"
            >
              <LogOut size={16} strokeWidth={1.75} />
              <span className="hidden sm:inline">გასვლა</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink-600 px-3 text-sm text-paper-2 transition-colors hover:bg-ink-700 hover:text-paper"
          >
            <LogIn size={16} strokeWidth={1.75} />
            შესვლა
          </button>
        )}
      </div>
    </header>
  );
}
