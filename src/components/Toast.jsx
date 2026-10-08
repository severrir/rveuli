import { useEffect, useRef } from "react";

/**
 * Confirmation in the same words as the control that caused it, and the one
 * place an undo is offered. Deleting shows დაბრუნება here instead of
 * interrupting with a confirm dialog, which is both kinder and safer on a
 * phone where the delete button is a thumb-width away from everything else.
 */
export default function Toast({ toast, onDismiss }) {
  const actionRef = useRef(null);

  // Announce politely; never steal focus from whatever the person is doing.
  useEffect(() => {
    if (!toast) return;
    const onKey = (e) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast, onDismiss]);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
    >
      {toast && (
        <div
          key={toast.id}
          className="animate-toast pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-ink-600 bg-ink-700 py-2.5 pl-4 pr-2.5 shadow-[0_10px_30px_-10px_rgb(0_0_0/0.8)]"
        >
          <span
            aria-hidden="true"
            className={`h-6 w-[2px] shrink-0 rounded-full ${
              toast.tone === "error" ? "bg-red-pen" : "bg-blue-pen"
            }`}
          />
          <p className="flex-1 text-sm text-paper">{toast.message}</p>
          {toast.action && (
            <button
              ref={actionRef}
              type="button"
              onClick={() => {
                toast.action.onClick();
                onDismiss();
              }}
              className="min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold text-blue-pen transition-colors hover:bg-blue-dim/40"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
