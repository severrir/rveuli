import { useCallback, useEffect, useState } from "react";

/**
 * Installing the board as an app.
 *
 * Chrome and Edge fire `beforeinstallprompt`, which must be captured and
 * replayed from a real tap — the browser refuses a prompt that did not come
 * from a gesture. But that event only fires once the browser decides the
 * app is eligible, and never at all in Safari or Firefox. A button that
 * waits for it is invisible most of the time, so the offer stays up until
 * the app is installed and falls back to instructions for the platform in
 * front of us.
 */

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

const isIos = () =>
  /iphone|ipad|ipod/i.test(ua()) ||
  // iPadOS reports as a Mac, but with a touch screen.
  (typeof navigator !== "undefined" &&
    navigator.platform === "MacIntel" &&
    navigator.maxTouchPoints > 1);

const isAndroid = () => /android/i.test(ua());
const isFirefox = () => /firefox|fxios/i.test(ua());

/** Which set of manual steps to show when we cannot prompt. */
export function installPlatform() {
  if (isIos()) return "ios";
  if (isAndroid()) return "android";
  if (isFirefox()) return "firefox";
  return "desktop";
}

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    window.navigator.standalone === true);

export function useInstall() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e) => {
      // Suppress the browser's own mini-infobar; we ask in context instead.
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
    platform: installPlatform(),
    install,
  };
}
