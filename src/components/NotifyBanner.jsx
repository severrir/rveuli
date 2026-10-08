import { useEffect, useState } from "react";
import { Bell, Share, X } from "lucide-react";
import {
  disableReminders,
  enableReminders,
  isIos,
  isPushConfigured,
  isPushSupported,
  isStandalone,
  isSubscribed,
  permission,
} from "../lib/push.js";

const DISMISS_KEY = "rveuli.notify-dismissed.v1";
const VISITS_KEY = "rveuli.visits.v1";

/**
 * The reminder offer.
 *
 * It is deliberately not shown on a first visit. Asking for notification
 * permission before someone knows what the app is gets a refusal that the
 * browser then remembers forever, so this waits until the third open.
 */
export default function NotifyBanner({ onToast }) {
  const [state, setState] = useState("hidden"); // hidden | offer | install | on

  useEffect(() => {
    let cancelled = false;

    async function decide() {
      if (!isPushSupported()) return;
      // Nothing can send the push yet, so do not offer it.
      if (!isPushConfigured()) return;

      let dismissed = false;
      let visits = 0;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) === "1";
        visits = Number(localStorage.getItem(VISITS_KEY) ?? 0) + 1;
        localStorage.setItem(VISITS_KEY, String(visits));
      } catch {
        return; // No storage, no nagging.
      }

      if (await isSubscribed()) {
        if (!cancelled) setState("on");
        return;
      }
      if (dismissed || visits < 3 || permission() === "denied") return;

      // On iPhone, Web Push only works once the app is on the Home Screen.
      if (isIos() && !isStandalone()) {
        if (!cancelled) setState("install");
        return;
      }
      if (!cancelled) setState("offer");
    }

    decide();
    return () => {
      cancelled = true;
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Dismissal lasts this session only.
    }
    setState("hidden");
  }

  async function turnOn() {
    try {
      const ok = await enableReminders();
      if (ok) {
        setState("on");
        onToast?.("შეხსენებები ჩაირთო — ყოველ საღამოს 19:00-ზე");
      } else {
        onToast?.("ბრაუზერმა ნებართვა არ მოგვცა", { tone: "error" });
        setState("hidden");
      }
    } catch (err) {
      onToast?.(err.message || "შეხსენებები ვერ ჩაირთო", { tone: "error" });
    }
  }

  async function turnOff() {
    await disableReminders();
    setState("hidden");
    onToast?.("შეხსენებები გამოირთო");
  }

  if (state === "hidden") return null;

  if (state === "on") {
    return (
      <div className="mx-4 mb-3 flex items-center gap-2 text-meta text-paper-3">
        <Bell size={13} strokeWidth={1.75} aria-hidden="true" />
        <span className="flex-1">შეხსენება ყოველ საღამოს 19:00-ზე</span>
        <button
          type="button"
          onClick={turnOff}
          className="min-h-9 rounded px-2 text-blue-pen underline-offset-4 hover:underline"
        >
          გამორთვა
        </button>
      </div>
    );
  }

  const install = state === "install";

  return (
    <div className="relative mx-4 mb-4 rounded-r-[10px] border border-l-0 border-hairline bg-ink-800 py-3 pl-10 pr-3">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-[22px] w-[1.5px] rounded-full bg-blue-pen"
      />
      <button
        type="button"
        onClick={dismiss}
        aria-label="დახურვა"
        className="absolute right-1 top-1 grid size-9 place-items-center rounded text-paper-3 transition-colors hover:text-paper"
      >
        <X size={15} strokeWidth={2} />
      </button>

      <h3 className="font-serif text-base font-semibold text-paper">
        {install ? "დაამატე მთავარ ეკრანზე" : "შეგახსენოთ საღამოს?"}
      </h3>
      <p className="mt-1 measure pr-6 text-sm text-paper-2">
        {install
          ? "iPhone-ზე შეხსენება მხოლოდ მაშინ მუშაობს, თუ რვეული მთავარ ეკრანზეა. გახსენი გაზიარების ღილაკი და აირჩიე „Add to Home Screen“."
          : "ყოველ საღამოს 19:00-ზე მოგივა შეტყობინება, თუ ხვალისთვის დავალება გაქვს."}
      </p>

      {install ? (
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-meta text-paper-3">
          <Share size={14} strokeWidth={1.75} aria-hidden="true" />
          Safari-ს გაზიარების ღილაკი
        </p>
      ) : (
        <button
          type="button"
          onClick={turnOn}
          className="mt-2.5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-paper px-4 text-sm font-semibold text-ink-900"
        >
          <Bell size={15} strokeWidth={2} />
          შეხსენების ჩართვა
        </button>
      )}
    </div>
  );
}
