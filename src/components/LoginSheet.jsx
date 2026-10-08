import { useState } from "react";
import { Loader2 } from "lucide-react";
import Sheet from "./Sheet.jsx";
import { signIn, DEMO_EMAILS, DEMO_PASSWORD } from "../lib/auth.js";
import { isSupabaseConfigured } from "../lib/supabase.js";

/**
 * Only the class reps sign in. Students never see this unless they go
 * looking, and signing in grants nothing on its own — write access comes
 * from a row in `profiles`, enforced by the database.
 */
export default function LoginSheet({ open, onClose, onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const rep = await signIn(email, password);
      onSignedIn(rep);
      setEmail("");
      setPassword("");
      onClose();
    } catch (err) {
      setError(err.message || "შესვლა ვერ მოხერხდა.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="შესვლა"
      description="დავალებების დამატება მხოლოდ კლასის უფროსებს შეუძლიათ."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="ელფოსტა">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-ink-600 bg-ink-700 px-3 text-base text-paper outline-none transition-colors focus:border-blue-pen"
          />
        </Field>

        <Field label="პაროლი">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 w-full rounded-lg border border-ink-600 bg-ink-700 px-3 text-base text-paper outline-none transition-colors focus:border-blue-pen"
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-red-text">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-paper text-base font-semibold text-ink-900 transition-opacity disabled:opacity-60"
        >
          {busy && <Loader2 size={17} className="animate-spin" />}
          {busy ? "შემოწმება" : "შესვლა"}
        </button>

        {!isSupabaseConfigured && (
          <p className="rounded-lg border border-ink-600 bg-ink-700/60 p-3 text-meta text-paper-3">
            საცდელი რეჟიმი — ბაზა ჯერ მიერთებული არ არის. შედი{" "}
            <code className="text-paper-2">{DEMO_EMAILS[0]}</code> და პაროლით{" "}
            <code className="text-paper-2">{DEMO_PASSWORD}</code>, რომ
            დამატების ხელსაწყოები ნახო.
          </p>
        )}
      </form>
    </Sheet>
  );
}

export function Field({ label, hint, optional = false, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-paper-2">
        {label}
        {optional && (
          <span className="ml-1.5 text-paper-3">არასავალდებულო</span>
        )}
      </span>
      {children}
      {hint && <span className="mt-1 block text-meta text-paper-3">{hint}</span>}
    </label>
  );
}
