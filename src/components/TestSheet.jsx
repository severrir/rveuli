import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Sheet from "./Sheet.jsx";
import { Field } from "./LoginSheet.jsx";
import { SUBJECTS } from "../lib/subjects.js";
import { TEST_KINDS } from "../lib/tests.js";
import { countdown } from "../lib/tests.js";
import {
  formatDate,
  fromLocalInputValue,
  toLocalInputValue,
  weekdayLocative,
} from "../lib/georgian.js";

/**
 * Setting a წერა.
 *
 * The one field a rep cannot skip is what it is on. A date with no subject
 * matter is the thing that makes a class anxious rather than prepared, so
 * `topics` is required here and `not null` in the database.
 *
 * Adding one notifies every student who left announcements on, which is
 * said plainly on the button rather than discovered afterwards.
 */

/** Three days out at 09:00 Tbilisi — the usual notice for a test. */
function defaultWhen() {
  const t = new Date(Date.now() + 3 * 86400000);
  return new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 5, 0),
  );
}

export default function TestSheet({ open, onClose, editing, onSave }) {
  const blank = useMemo(
    () => ({
      subject: SUBJECTS[0].id,
      kind: "control",
      topics: "",
      note: "",
      writtenAt: toLocalInputValue(defaultWhen()),
    }),
    [],
  );

  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    // `editing` is {} for a new test and a full object when editing, so the
    // presence of a date — not truthiness — decides which branch applies.
    setForm(
      editing?.writtenAt
        ? {
            subject: editing.subject,
            kind: editing.kind,
            topics: editing.topics,
            note: editing.note ?? "",
            writtenAt: toLocalInputValue(editing.writtenAt),
          }
        : blank,
    );
  }, [open, editing, blank]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const whenPreview = useMemo(() => {
    const d = fromLocalInputValue(form.writtenAt);
    if (!d || Number.isNaN(d.getTime())) return null;
    return `${weekdayLocative(d)}, ${formatDate(d)} — ${countdown(d).label}`;
  }, [form.writtenAt]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.topics.trim()) {
      setError("ჩაწერე, რაზეა წერა.");
      return;
    }
    const writtenAt = fromLocalInputValue(form.writtenAt);
    if (!writtenAt || Number.isNaN(writtenAt.getTime())) {
      setError("თარიღი არასწორია.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSave({ ...form, writtenAt });
      onClose();
    } catch {
      setError("ვერ შევინახე. შეამოწმე კავშირი და სცადე ხელახლა.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-lg border border-ink-600 bg-ink-700 px-3 text-base text-paper outline-none transition-colors focus:border-blue-pen";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing?.id ? "წერის რედაქტირება" : "წერის დამატება"}
      description={
        editing?.id
          ? "ცვლილება მაშინვე დაინახავს მთელი კლასი."
          : "დამატებისთანავე კლასს შეტყობინება მივა."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="საგანი">
          <select
            value={form.subject}
            onChange={(e) => set({ subject: e.target.value })}
            className={inputClass}
          >
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id} className="bg-ink-700">
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="რა სახის წერაა">
          <select
            value={form.kind}
            onChange={(e) => set({ kind: e.target.value })}
            className={inputClass}
          >
            {TEST_KINDS.map((k) => (
              <option key={k.id} value={k.id} className="bg-ink-700">
                {k.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="რაზეა"
          hint="პარაგრაფები, თემები, თავები — რასაც უნდა მოემზადონ."
        >
          <textarea
            rows={3}
            required
            maxLength={400}
            value={form.topics}
            onChange={(e) => set({ topics: e.target.value })}
            placeholder="მესამე თავი — სიჩქარე, აჩქარება, თავისუფალი ვარდნა"
            className={`${inputClass} resize-y py-2.5 leading-relaxed`}
          />
        </Field>

        <Field label="თარიღი">
          <input
            type="datetime-local"
            required
            value={form.writtenAt}
            onChange={(e) => set({ writtenAt: e.target.value })}
            className={inputClass}
          />
          {/* The native picker formats to the browser's locale, which may
              not be Georgian. Echo the choice in the app's own words. */}
          {whenPreview && (
            <span className="mt-1.5 block text-meta text-paper-3">
              {whenPreview}
            </span>
          )}
        </Field>

        <Field label="შენიშვნა" optional>
          <textarea
            rows={3}
            maxLength={900}
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="რა იქონიონ თან, რამდენი გაკვეთილი დასჭირდება, რა არ შეიძლება."
            className={`${inputClass} resize-y py-2.5 leading-relaxed`}
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-red-text">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-lg border border-ink-600 text-base text-paper-2 transition-colors hover:bg-ink-700 hover:text-paper"
          >
            გაუქმება
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-paper text-base font-semibold text-ink-900 transition-opacity disabled:opacity-60"
          >
            {busy && <Loader2 size={17} className="animate-spin" />}
            {editing?.id ? "შენახვა" : "დამატება"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
