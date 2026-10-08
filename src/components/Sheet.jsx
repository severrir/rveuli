import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * A bottom sheet: the mobile-native way to ask for a few fields without
 * losing the board behind it. It rises from the thumb, traps focus while
 * open, closes on Escape or a tap outside, and returns focus where it came
 * from so keyboard and screen-reader users are not dropped at the top.
 *
 * It renders through a portal to <body> rather than in place. `fixed` is
 * relative to the nearest ancestor with a filter, backdrop-filter or
 * transform, not to the viewport — so a sheet opened from a control inside
 * the blurred header was laid out against the 64px header and sat almost
 * entirely off-screen. A portal makes placement independent of wherever
 * the trigger happens to live.
 */
export default function Sheet({ open, onClose, title, description, children }) {
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusables = () =>
      panel?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [];

    focusables()[0]?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const list = [...focusables()];
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="დახურვა"
        onClick={onClose}
        className="animate-backdrop absolute inset-0 cursor-default bg-ink-900/70 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl border border-ink-600 bg-ink-850 sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start gap-3 border-b border-hairline px-4 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-xl font-semibold text-paper">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-paper-3">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="დახურვა"
            className="-mr-1 grid size-11 shrink-0 place-items-center rounded-lg text-paper-3 transition-colors hover:bg-ink-700 hover:text-paper"
          >
            <X size={19} strokeWidth={1.75} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
