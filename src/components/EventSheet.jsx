import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Sheet from "./Sheet.jsx";
import { Field } from "./LoginSheet.jsx";
import { EVENT_KINDS, whenLabel } from "../lib/events.js";
import {
  formatDate,
  fromLocalInputValue,
  toLocalInputValue,
  weekdayLocative,
} from "../lib/georgian.js";

/**
 * Adding an ევენთი.
 *
 * The end time is optional, and that is the point: a parents' meeting
 * starts at six and ends when it ends, while an excursion has a bus back.
 * Forcing an end on everything would mean reps inventing one.
 */

/** A week out at 09:00 Tbilisi. */
function defaultStart() {
  const t = new Date(Date.now() + 7 * 86400000);
  return new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 5, 0),
  );
}

export default function EventSheet({ open, onClose, editing, onSave }) {
  const blank = useMemo(
    () => ({
      title: "",
      kind: "excursion",
      location: "",
      note: "",
      startsAt: toLocalInputValue(defaultStart()),
      endsAt: "",
    }),
    [],
  );

  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      editing?.startsAt
        ? {
            title: editing.title,
            kind: editing.kind,
            location: editing.location ?? "",
            note: editing.note ?? "",
            startsAt: toLocalInputValue(editing.startsAt),
            endsAt: editing.endsAt ? toLocalInputValue(editing.endsAt) : "",
          }
        : blank,
    );
  }, [open, editing, blank]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const startPreview = useMemo(() => {
    const d = fromLocalInputValue(form.startsAt);
    if (!d || Number.isNaN(d.getTime())) return null;
    return `${weekdayLocative(d)}, ${formatDate(d)} — ${whenLabel(d).label}`;
  }, [form.startsAt]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.title.trim()) {
      setError("სათაური აუცილებელია.");
      return;
    }

    const startsAt = fromLocalInputValue(form.startsAt);
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      setError("დაწყების დრო არასწორია.");
      return;
    }

    let endsAt = null;
    if (form.endsAt) {
      endsAt = fromLocalInputValue(form.endsAt);
      if (!endsAt || Number.isNaN(endsAt.getTime())) {
        setError("დასრულების დრო არასწორია.");
        return;
      }
      // Caught here as well as in the database, because the message the rep
      // reads should name the field rather than quote a constraint.
      if (endsAt <= startsAt) {
        setError("დასრულება დაწყებაზე გვიან უნდა იყოს.");
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      await onSave({ ...form, startsAt, endsAt });
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
      title={editing?.id ? "ევენთის რედაქტირება" : "ევენთის დამატება"}
      description={
        editing?.id
          ? "ცვლილება მაშინვე დაინახავს მთელი კლასი."
          : "დამატებისთანავე კლასს შეტყობინება მივა."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="სათაური">
          <input
            type="text"
            required
            maxLength={140}
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="ექსკურსია — ვარძია და ახალციხე"
            className={inputClass}
          />
        </Field>

        <Field label="რა სახის ევენთია">
          <select
            value={form.kind}
            onChange={(e) => set({ kind: e.target.value })}
            className={inputClass}
          >
            {EVENT_KINDS.map((k) => (
              <option key={k.id} value={k.id} className="bg-ink-700">
                {k.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="სად" optional hint="შეხვედრის ადგილი ან ოთახი.">
          <input
            type="text"
            maxLength={120}
            value={form.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="შეხვედრა სკოლის ეზოში"
            className={inputClass}
          />
        </Field>

        <Field label="დაწყება">
          <input
            type="datetime-local"
            required
            value={form.startsAt}
            onChange={(e) => set({ startsAt: e.target.value })}
            className={inputClass}
          />
          {/* The native picker formats to the browser's locale, which may
              not be Georgian. Echo the choice in the app's own words. */}
          {startPreview && (
            <span className="mt-1.5 block text-meta text-paper-3">
              {startPreview}
            </span>
          )}
        </Field>

        <Field
          label="დასრულება"
          optional
          hint="თუ ცარიელია, მხოლოდ დაწყების დრო გამოჩნდება."
        >
          <input
            type="datetime-local"
            value={form.endsAt}
            onChange={(e) => set({ endsAt: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="შენიშვნა" optional>
          <textarea
            rows={3}
            maxLength={900}
            value={form.note}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="რა იქონიონ თან, რამდენი ღირს, ვის მიმართონ."
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
