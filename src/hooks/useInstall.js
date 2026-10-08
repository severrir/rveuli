import { useCallback, useEffect, useState } from "react";

/**
 * Installing the board as an app.
 *
 * Chrome and Edge fire `beforeinstallprompt`, which must be captured and
 * replayed later from a real tap — the browser refuses a prompt that was
 * not triggered by a gesture. Safari fires nothing at all and installs only
 * through its own Share menu, so iOS gets instructions instead of a button
 * that would do nothing.
 */

const isIosSafari = () => {
  if (typeof navigator === "undefined") return false;
  const ios =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports as a Mac, but with a touch screen.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  // Chrome and Firefox on iOS cannot install either, and say so differently.
  return ios && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
};

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true);

export function useInstall() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e) => {
      // Stop the browser's own mini-infobar so the app can ask in context.
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    const onMode = (e) => setInstalled(e.matches);
    mq.addEventListener?.("change", onMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onMode);
    };
  }, []);

  /** Returns "accepted", "dismissed", or "unavailable". */
  const install = useCallback(async () => {
    if (!prompt) return "unavailable";
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    // The event is single-use whatever the answer.
    setPrompt(null);
    return outcome;
  }, [prompt]);

  return {
    installed,
    canPrompt: Boolean(prompt),
    needsIosInstructions: !installed && isIosSafari(),
    install,
  };
}
