import { useEffect, useMemo, useState } from "react";
import { Loader2, Paperclip, Pin, X } from "lucide-react";
import Sheet from "./Sheet.jsx";
import { Field } from "./LoginSheet.jsx";
import { SUBJECTS } from "../lib/subjects.js";
import {
  toLocalInputValue,
  fromLocalInputValue,
  describeDue,
  formatTime,
  weekdayLocative,
} from "../lib/georgian.js";
import { uploadAttachment } from "../lib/repository.js";
import { compressImage, formatBytes } from "../lib/compressImage.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = "image/*,application/pdf,.doc,.docx";

/** Tomorrow at 09:00 Tbilisi — what a rep means nine times out of ten. */
function defaultDue() {
  const t = new Date(Date.now() + 86400000);
  return new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), 5, 0),
  );
}

export default function HomeworkSheet({ open, onClose, editing, onSave }) {
  const blank = useMemo(
    () => ({
      subject: SUBJECTS[0].id,
      title: "",
      details: "",
      dueAt: toLocalInputValue(defaultDue()),
      isPinned: false,
      linkUrl: "",
      attachments: [],
    }),
    [],
  );

  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // Load the entry being edited (or duplicated) each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setError(null);
    // `editing` is {} for a new entry and a full object for edit/duplicate,
    // so presence of a date — not truthiness — decides which branch applies.
    setForm(
      editing?.dueAt
        ? {
            subject: editing.subject,
            title: editing.title,
            details: editing.details ?? "",
            dueAt: toLocalInputValue(editing.dueAt),
            isPinned: editing.isPinned,
            linkUrl: editing.linkUrl ?? "",
            attachments: editing.attachments ?? [],
          }
        : blank,
    );
  }, [open, editing, blank]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function handleFiles(event) {
    const files = [...event.target.files];
    event.target.value = "";
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const added = [];
      for (const file of files) {
        if (file.size > MAX_FILE_BYTES) {
          setError(`„${file.name}“ 10 მბ-ზე დიდია.`);
          continue;
        }
        const compressed = await compressImage(file);
        added.push(await uploadAttachment(file, compressed));
      }
      set({ attachments: [...form.attachments, ...added] });
    } catch {
      setError("ფაილი ვერ აიტვირთა. სცადე ხელახლა.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("სათაური აუცილებელია.");
      return;
    }
    const dueAt = fromLocalInputValue(form.dueAt);
    if (!dueAt || Number.isNaN(dueAt.getTime())) {
      setError("ვადა არასწორია.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await onSave({ ...form, dueAt });
      onClose();
    } catch {
      setError("ვერ შევინახე. შეამოწმე კავშირი და სცადე ხელახლა.");
    } finally {
      setBusy(false);
    }
  }

  const duePreview = useMemo(() => {
    const d = fromLocalInputValue(form.dueAt);
    if (!d || Number.isNaN(d.getTime())) return null;
    return `${weekdayLocative(d)}, ${formatTime(d)} — ${describeDue(d).label}`;
  }, [form.dueAt]);

  const inputClass =
    "min-h-12 w-full rounded-lg border border-ink-600 bg-ink-700 px-3 text-base text-paper outline-none transition-colors focus:border-blue-pen";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing?.id ? "დავალების რედაქტირება" : "დავალების დამატება"}
      description={
        editing?.id ? "ცვლილება მაშინვე დაინახავს მთელი კლასი." : undefined
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

        <Field label="სათაური" hint="რა უნდა გაკეთდეს — მოკლედ.">
          <input
            type="text"
            required
            maxLength={140}
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="გვ. 142, სავარჯიშო 4–9"
            className={inputClass}
          />
        </Field>

        <Field label="დეტალები" optional>
          <textarea
            rows={4}
            maxLength={900}
            value={form.details}
            onChange={(e) => set({ details: e.target.value })}
            placeholder="რა უნდა გაკეთდეს ზუსტად, რა უნდა მოიტანონ, როგორ შემოწმდება."
            className={`${inputClass} resize-y py-2.5 leading-relaxed`}
          />
        </Field>

        <Field label="ვადა">
          <input
            type="datetime-local"
            required
            value={form.dueAt}
            onChange={(e) => set({ dueAt: e.target.value })}
            className={inputClass}
          />
          {/* The native picker formats to the browser's locale, which may
              not be Georgian. Echo the choice in the app's own words so
              the rep can always confirm what they actually set. */}
          {duePreview && (
            <span className="mt-1.5 block text-meta text-paper-3">
              {duePreview}
            </span>
          )}
        </Field>

        <Field label="ბმული" optional>
          <input
            type="url"
            value={form.linkUrl}
            onChange={(e) => set({ linkUrl: e.target.value })}
            placeholder="https://"
            className={inputClass}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-sm text-paper-2">
            ფოტო ან ფაილი{" "}
            <span className="text-paper-3">არასავალდებულო</span>
          </span>
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-ink-600 px-4 text-sm text-paper-2 transition-colors hover:border-blue-pen hover:text-paper">
            {uploading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Paperclip size={16} strokeWidth={1.75} />
            )}
            {uploading ? "იტვირთება" : "არჩევა"}
            <input
              type="file"
              multiple
              accept={ACCEPT}
              onChange={handleFiles}
              className="sr-only"
            />
          </label>
          <p className="mt-1 text-meta text-paper-3">
            სახელმძღვანელოს გვერდის ფოტო ავტომატურად შემცირდება. მაქსიმუმ 10 მბ.
          </p>

          {form.attachments.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {form.attachments.map((a, i) => (
                <li
                  key={a.path ?? a.url ?? i}
                  className="flex items-center gap-2 rounded-lg border border-hairline bg-ink-700/60 py-1.5 pl-3 pr-1.5"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-paper-2">
                    {a.name}
                  </span>
                  <span className="tnum shrink-0 text-meta text-paper-3">
                    {formatBytes(a.size)}
                  </span>
                  <button
                    type="button"
                    aria-label={`${a.name} — მოცილება`}
                    onClick={() =>
                      set({
                        attachments: form.attachments.filter((_, j) => j !== i),
                      })
                    }
                    className="grid size-9 shrink-0 place-items-center rounded text-paper-3 transition-colors hover:text-red-text"
                  >
                    <X size={15} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={form.isPinned}
          onClick={() => set({ isPinned: !form.isPinned })}
          className={`inline-flex min-h-12 items-center gap-2.5 rounded-lg border px-3.5 text-sm transition-colors ${
            form.isPinned
              ? "border-red-dim bg-red-dim/20 text-paper"
              : "border-ink-600 text-paper-2 hover:bg-ink-700"
          }`}
        >
          <Pin
            size={16}
            strokeWidth={1.75}
            className={form.isPinned ? "text-red-text" : ""}
          />
          მნიშვნელოვანი — ყველაფრის თავში
        </button>

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
            disabled={busy || uploading}
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
