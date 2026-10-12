import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import Sheet from "./Sheet.jsx";
import { Field } from "./LoginSheet.jsx";
import { MAX_OPTIONS, MIN_OPTIONS, optionId } from "../lib/polls.js";
import {
  formatDate,
  formatTime,
  fromLocalInputValue,
  toLocalInputValue,
  weekdayLocative,
} from "../lib/georgian.js";

/**
 * Putting something to the class.
 *
 * Options are typed into a list that grows rather than a comma-separated
 * field, because the labels are Georgian sentences — "პარასკევს,
 * გაკვეთილების შემდეგ" has a comma in it, and that is exactly the input a
 * rep would type first.
 *
 * The ids are letters assigned by position, so a ballot reads a, b, c
 * rather than carrying a uuid per answer. Editing a poll that already has
 * votes therefore keeps the ids stable for the rows that stay put, and the
 * warning below says what happens to the rest.
 */
export default function PollSheet({ open, onClose, editing, onSave }) {
  const blank = useMemo(
    () => ({
      question: "",
      options: ["", ""],
      closesAt: "",
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
      editing?.id
        ? {
            question: editing.question,
            options: editing.options.map((o) => o.label),
            closesAt: editing.closesAt
              ? toLocalInputValue(editing.closesAt)
              : "",
          }
        : blank,
    );
  }, [open, editing, blank]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const setOption = (index, value) =>
    setForm((f) => ({
      ...f,
      options: f.options.map((o, i) => (i === index ? value : o)),
    }));

  const addOption = () =>
    setForm((f) =>
      f.options.length >= MAX_OPTIONS
        ? f
        : { ...f, options: [...f.options, ""] },
    );

  const removeOption = (index) =>
    setForm((f) =>
      f.options.length <= MIN_OPTIONS
        ? f
        : { ...f, options: f.options.filter((_, i) => i !== index) },
    );

  const closesPreview = useMemo(() => {
    if (!form.closesAt) return null;
    const d = fromLocalInputValue(form.closesAt);
    if (!d || Number.isNaN(d.getTime())) return null;
    return `იხურება ${weekdayLocative(d)}, ${formatDate(d)}, ${formatTime(d)}`;
  }, [form.closesAt]);

  async function handleSubmit(e) {
    e.preventDefault();

    const question = form.question.trim();
    if (question.length < 4) {
      setError("კითხვა ძალიან მოკლეა.");
      return;
    }

    const labels = form.options.map((o) => o.trim()).filter(Boolean);
    if (labels.length < MIN_OPTIONS) {
      setError(`სულ მცირე ${MIN_OPTIONS} პასუხი უნდა იყოს.`);
      return;
    }
    if (new Set(labels).size !== labels.length) {
      setError("ორი ერთნაირი პასუხია.");
      return;
    }

    let closesAt = null;
    if (form.closesAt) {
      closesAt = fromLocalInputValue(form.closesAt);
      if (!closesAt || Number.isNaN(closesAt.getTime())) {
        setError("დახურვის დრო არასწორია.");
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      await onSave({
        question,
        options: labels.map((label, i) => ({ id: optionId(i), label })),
        closesAt,
      });
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
      title={editing?.id ? "კენჭისყრის რედაქტირება" : "კენჭისყრის დამატება"}
      description="ერთი ხმა ერთ ტელეფონზე. ვინ რას აირჩევს, არავინ ხედავს — მხოლოდ ჯამი."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="კითხვა">
          <input
            type="text"
            required
            maxLength={200}
            value={form.question}
            onChange={(e) => set({ question: e.target.value })}
            placeholder="სად წავიდეთ ექსკურსიაზე?"
            className={inputClass}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm text-paper-2">
            პასუხები{" "}
            <span className="text-paper-3">
              {MIN_OPTIONS}–{MAX_OPTIONS}
            </span>
          </span>

          <ul className="flex flex-col gap-2">
            {form.options.map((option, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="tnum w-5 shrink-0 text-center text-meta text-paper-3"
                >
                  {optionId(i)}
                </span>
                <input
                  type="text"
                  maxLength={100}
                  value={option}
                  onChange={(e) => setOption(i, e.target.value)}
                  aria-label={`პასუხი ${i + 1}`}
                  placeholder={i === 0 ? "ყაზბეგი" : "ვარძია"}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeOption(i)}
                  disabled={form.options.length <= MIN_OPTIONS}
                  aria-label={`პასუხი ${i + 1} — მოცილება`}
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-paper-3 transition-colors hover:text-red-text disabled:opacity-30 disabled:hover:text-paper-3"
                >
                  <X size={15} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>

          {form.options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-dashed border-ink-600 px-3 text-sm text-paper-2 transition-colors hover:border-blue-pen hover:text-paper"
            >
              <Plus size={15} strokeWidth={2} />
              პასუხის დამატება
            </button>
          )}
        </div>

        <Field
          label="ავტომატური დახურვა"
          optional
          hint="თუ ცარიელია, ღია დარჩება სანამ ხელით არ დახურავ."
        >
          <input
            type="datetime-local"
            value={form.closesAt}
            onChange={(e) => set({ closesAt: e.target.value })}
            className={inputClass}
          />
          {closesPreview && (
            <span className="mt-1.5 block text-meta text-paper-3">
              {closesPreview}
            </span>
          )}
        </Field>

        {/* Said before saving, not after: the ids follow position, so
            reordering or deleting an answer moves the votes that were on
            it. Worth knowing while the poll is still being written. */}
        {editing?.id && (
          <p className="rounded-lg border border-ink-600 bg-ink-700/50 px-3 py-2 text-meta text-paper-2">
            პასუხების თანმიმდევრობის შეცვლა უკვე მიცემულ ხმებს არევს.
            ტექსტის შესწორება უსაფრთხოა.
          </p>
        )}

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
