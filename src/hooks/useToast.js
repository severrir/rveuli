import { useCallback, useRef, useState } from "react";

let seq = 0;

/**
 * Toasts confirm what just happened, in the same words as the control that
 * caused it: დამატება → დაემატა. A toast may also carry one action, which
 * is how deleting offers დაბრუნება instead of interrupting with a dialog.
 */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (message, { action, tone = "info", duration = 4200 } = {}) => {
      clearTimeout(timer.current);
      setToast({ id: ++seq, message, action, tone });
      timer.current = setTimeout(() => setToast(null), duration);
    },
    [],
  );

  return { toast, show, dismiss };
}
