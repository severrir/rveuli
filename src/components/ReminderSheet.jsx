import { useEffect, useState } from "react";
import { Bell, BellOff, Check, Loader2, Plus, Share } from "lucide-react";
import Sheet from "./Sheet.jsx";
import {
  DEFAULT_SETTINGS,
  HOUR_CHOICES,
  disableReminders,
  enableReminders,
  isIos,
  isPushSupported,
  isStandalone,
  isSubscribed,
  permission,
  readSettings,
  updateSettings,
} from "../lib/push.js";

/**
 * Reminder settings: on or off, what time, and whether to stay quiet on
 * nights before a free day.
 *
 * Everything here is per device, because students have no account.
 * Changing the time while reminders are on updates the schedule without
 * asking permission again — a browser grants that once, and spending it on
 * a settings change would be careless.
 */
export default function ReminderSheet({ open, onClose, onToast }) {
  const [on, setOn] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSettings(readSettings());
    isSubscribed().then((v) => {
      setOn(v);
      setChecked(true);
    });
  }, [open]);

  const supported = isPushSupported();
  const blocked = permission() === "denied";
  const needsInstall = isIos() && !isStandalone();

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await disableReminders();
        setOn(false);
        onToast?.("შეხსენებები გამოირთო");
      } else {
        const ok = await enableReminders(settings);
        setOn(ok);
        if (ok) {
          onToast?.(
            `შეხსენება ჩაირთო, ${String(settings.hour).padStart(2, "0")}:00`,
          );
        } else {
          onToast?.("ბრაუზერმა ნებართვა არ მოგვცა", { tone: "error" });
        }
      }
    } catch (err) {
      onToast?.(err.message || "ვერ შევცვალე", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  /** Settings apply immediately; there is no save button to forget. */
  async function change(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await updateSettings(next);
    } catch {
      onToast?.("ვერ შევინახე. სცადე ხელახლა.", { tone: "error" });
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="შეხსენებები"
      description="საღამოს შეტყობინება, თუ ხვალისთვის დავალება გაქვს."
    >
      {!supported ? (
        <p className="measure text-base text-paper-2">
          ამ ბრაუზერს შეტყობინებები არ შეუძლია. სცადე Chrome ან Safari.
        </p>
      ) : needsInstall ? (
        <div className="flex flex-col gap-4">
          <p className="measure text-base text-paper-2">
            iPhone-ზე შეტყობინება მხოლოდ მაშინ მუშაობს, თუ რვეული მთავარ
            ეკრანზეა დამატებული.
          </p>
          <ol className="flex flex-col gap-3">
            <li className="flex items-start gap-2 text-base text-paper">
              <Share
                size={17}
                strokeWidth={1.75}
                aria-hidden="true"
                className="mt-1 shrink-0 text-blue-pen"
              />
              დააჭირე გაზიარების ღილაკს ბრაუზერის ქვედა ზოლში.
            </li>
            <li className="flex items-start gap-2 text-base text-paper">
              <Plus
                size={17}
                strokeWidth={2}
                aria-hidden="true"
                className="mt-1 shrink-0 text-blue-pen"
              />
              აირჩიე „Add to Home Screen“, მერე დაბრუნდი აქ.
            </li>
          </ol>
        </div>
      ) : blocked ? (
        <p className="measure text-base text-paper-2">
          შეტყობინებები ბრაუზერში დაბლოკილია. გახსენი საიტის პარამეტრები
          მისამართის ველთან და დაუშვი შეტყობინებები.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={busy || !checked}
            onClick={toggle}
            className={`flex min-h-14 items-center gap-3 rounded-xl border px-4 text-left transition-colors disabled:opacity-60 ${
              on
                ? "border-blue-dim bg-blue-dim/25"
                : "border-ink-600 hover:bg-ink-700"
            }`}
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin text-paper-2" />
            ) : on ? (
              <Bell size={18} strokeWidth={1.75} className="text-blue-pen" />
            ) : (
              <BellOff size={18} strokeWidth={1.75} className="text-paper-3" />
            )}
            <span className="flex-1">
              <span className="block text-base text-paper">
                {on ? "ჩართულია" : "გამორთულია"}
              </span>
              <span className="tnum block text-meta text-paper-3">
                {on
                  ? `ყოველ საღამოს ${String(settings.hour).padStart(2, "0")}:00`
                  : "დააჭირე ჩასართავად"}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                on ? "bg-blue-pen" : "bg-ink-600"
              }`}
            >
              <span
                className={`absolute top-0.5 size-5 rounded-full bg-paper transition-[left] duration-200 ${
                  on ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          <fieldset className="min-w-0" disabled={!on}>
            <legend className="mb-2 text-sm text-paper-2">
              როდის შეგახსენოთ
            </legend>
            <div
              className={`rail -mx-4 flex gap-1.5 px-4 pb-1 ${
                on ? "" : "opacity-45"
              }`}
            >
              {HOUR_CHOICES.map((h) => {
                const active = settings.hour === h;
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={active}
                    onClick={() => change({ hour: h })}
                    className={`tnum min-h-11 shrink-0 scroll-ml-4 rounded-lg border px-3.5 text-sm transition-colors [scroll-snap-align:start] ${
                      active
                        ? "border-blue-pen bg-blue-dim/30 text-paper"
                        : "border-ink-600 text-paper-2 hover:bg-ink-700"
                    }`}
                  >
                    {String(h).padStart(2, "0")}:00
                  </button>
                );
              })}
            </div>
          </fieldset>

          <button
            type="button"
            role="switch"
            aria-checked={settings.schoolNightsOnly}
            disabled={!on}
            onClick={() =>
              change({ schoolNightsOnly: !settings.schoolNightsOnly })
            }
            className={`flex min-h-14 items-center gap-3 rounded-xl border border-ink-600 px-4 text-left transition-colors disabled:opacity-45 ${
              on ? "hover:bg-ink-700" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className={`grid size-[22px] shrink-0 place-items-center rounded border transition-colors ${
                settings.schoolNightsOnly
                  ? "border-blue-pen bg-blue-pen text-ink-900"
                  : "border-ink-600 text-transparent"
              }`}
            >
              <Check size={13} strokeWidth={3} />
            </span>
            <span className="flex-1">
              <span className="block text-base text-paper">
                მხოლოდ სასწავლო დღის წინ
              </span>
              <span className="block text-meta text-paper-3">
                შაბათ საღამოს არ შეგაწუხებს.
              </span>
            </span>
          </button>

          <p className="measure border-t border-hairline pt-3 text-meta text-paper-3">
            შეხსენება ამ მოწყობილობაზეა შენახული — სხვა ტელეფონზე ცალკე
            ჩაირთვება. შეტყობინება მოდის მხოლოდ მაშინ, თუ ხვალისთვის
            დავალება ნამდვილად არის.
          </p>
        </div>
      )}
    </Sheet>
  );
}
