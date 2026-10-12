import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
} from "lucide-react";
import Sheet from "./Sheet.jsx";
import { Field } from "./LoginSheet.jsx";
import {
  MIN_PASSWORD,
  addPerson,
  listPeople,
  removePerson,
  setPassword,
  setRole,
  signInNote,
  suggestPassword,
} from "../lib/people.js";
import { isSupabaseConfigured } from "../lib/supabase.js";

/**
 * Who may post, and the one place that changes.
 *
 * Only an owner opens this. Three fields and a button is the whole flow:
 * the account is made, and the sheet hands back the two lines the new rep
 * needs, because the owner is going to have to send them anyway and
 * retyping a password off a screen is how it gets mistyped.
 *
 * Deliberately no email invitations. The class is a handful of people who
 * see each other daily, a password read out loud arrives faster than mail
 * that needs a verified sending domain, and nobody is left waiting on a
 * link that landed in spam.
 */

const blank = () => ({
  displayName: "",
  email: "",
  password: suggestPassword(),
  owner: false,
});

export default function PeopleSheet({ open, onClose, rep, onToast }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  // The sign-in details to pass on, after an add or a password reset.
  const [handoff, setHandoff] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPeople(await listPeople());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setForm(blank());
    setHandoff(null);
    setConfirming(null);
    load();
  }, [open, load]);

  /** Runs an action, turns its failure into a message, and reloads. */
  async function run(action, done) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      await load();
      done?.(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    const { email, password } = form;
    await run(
      () =>
        addPerson({
          email,
          password,
          displayName: form.displayName,
          role: form.owner ? "owner" : "rep",
        }),
      () => {
        setHandoff({ email: email.trim().toLowerCase(), password });
        setForm(blank());
        setCopied(false);
        onToast?.("დაემატა");
      },
    );
  }

  async function handleReset(person) {
    const password = suggestPassword();
    await run(
      () => setPassword(person.id, password),
      () => {
        setHandoff({ email: person.email, password });
        setCopied(false);
        onToast?.("ახალი პაროლი დაყენდა");
      },
    );
  }

  async function copyHandoff() {
    try {
      await navigator.clipboard.writeText(signInNote(handoff));
      setCopied(true);
      onToast?.("შესვლის მონაცემები დაკოპირდა");
    } catch {
      onToast?.("კოპირება ვერ მოხერხდა", { tone: "error" });
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="ვინ ამატებს დავალებებს"
      description="დაამატე კლასის უფროსი, მოუხსენი უფლება ან შეუცვალე პაროლი."
    >
      <div className="flex flex-col gap-5">
        {/* ---- The list ------------------------------------------- */}
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-paper-3">
            <Loader2 size={16} className="animate-spin" />
            ვტვირთავ
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {people.map((person) => {
              const isSelf = person.id === rep?.id;
              return (
                <li
                  key={person.id}
                  className="rounded-xl border border-ink-600 bg-ink-800/60 px-3 py-2.5"
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base text-paper">
                        {person.display_name}
                        {person.role === "owner" && (
                          <span className="ml-2 rounded border border-blue-dim bg-blue-dim/40 px-1.5 py-0.5 text-meta text-blue-pen">
                            ადმინი
                          </span>
                        )}
                        {isSelf && (
                          <span className="ml-2 text-meta text-paper-3">შენ</span>
                        )}
                      </p>
                      <p className="truncate text-meta text-paper-3">
                        {person.email}
                      </p>
                    </div>

                    {!isSelf && (
                      <div className="flex shrink-0 items-center gap-1">
                        <IconButton
                          label={
                            person.role === "owner"
                              ? "ადმინის უფლების მოხსნა"
                              : "ადმინად დაყენება"
                          }
                          pressed={person.role === "owner"}
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              setRole(
                                person.id,
                                person.role === "owner" ? "rep" : "owner",
                              ),
                            )
                          }
                        >
                          <Shield size={16} strokeWidth={1.75} />
                        </IconButton>

                        <IconButton
                          label="ახალი პაროლი"
                          disabled={busy}
                          onClick={() => handleReset(person)}
                        >
                          <KeyRound size={16} strokeWidth={1.75} />
                        </IconButton>

                        <IconButton
                          label="წაშლა"
                          danger
                          disabled={busy}
                          onClick={() =>
                            setConfirming(
                              confirming === person.id ? null : person.id,
                            )
                          }
                        >
                          <Trash2 size={16} strokeWidth={1.75} />
                        </IconButton>
                      </div>
                    )}
                  </div>

                  {/* Removal asks once, in place. A tap on a phone is too
                      easy to make by accident, and this one cannot be
                      taken back from a toast. */}
                  {confirming === person.id && (
                    <div className="mt-2.5 flex items-center gap-2 border-t border-hairline pt-2.5">
                      <p className="flex-1 text-sm text-paper-2">
                        {person.display_name} ვერ დაამატებს დავალებებს და
                        ანგარიში წაიშლება.
                      </p>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(() => removePerson(person.id, rep?.id), () => {
                            setConfirming(null);
                            onToast?.("წაიშალა");
                          })
                        }
                        className="min-h-11 shrink-0 rounded-lg border border-red-dim bg-red-dim/30 px-3 text-sm text-red-text transition-colors hover:bg-red-dim/50 disabled:opacity-60"
                      >
                        წაშლა
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* ---- The details to pass on ------------------------------ */}
        {handoff && (
          <div className="rounded-xl border border-blue-dim bg-blue-dim/20 p-3">
            <p className="text-sm text-paper-2">
              გაუგზავნე ეს — პაროლი მეორედ ნაჩვენები არ იქნება.
            </p>
            <p className="mt-2 break-all text-sm text-paper">
              {handoff.email}
              <br />
              <span className="tnum">{handoff.password}</span>
            </p>
            <button
              type="button"
              onClick={copyHandoff}
              className="mt-2.5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-ink-600 bg-ink-700 px-3 text-sm text-paper transition-colors hover:bg-ink-600"
            >
              {copied ? (
                <Check size={16} strokeWidth={2} className="text-blue-pen" />
              ) : (
                <Copy size={16} strokeWidth={1.75} />
              )}
              {copied ? "დაკოპირდა" : "დააკოპირე"}
            </button>
          </div>
        )}

        {/* ---- Adding --------------------------------------------- */}
        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-4 border-t border-hairline pt-4"
        >
          <Field label="სახელი" hint="ასე გამოჩნდება ბარათზე: „დაამატა ნინომ“">
            <input
              required
              maxLength={40}
              value={form.displayName}
              onChange={(e) =>
                setForm({ ...form, displayName: e.target.value })
              }
              className="min-h-12 w-full rounded-lg border border-ink-600 bg-ink-700 px-3 text-base text-paper outline-none transition-colors focus:border-blue-pen"
            />
          </Field>

          <Field label="ელფოსტა" hint="ამით შემოვა — წერილი არ იგზავნება.">
            <input
              type="email"
              required
              autoComplete="off"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="min-h-12 w-full rounded-lg border border-ink-600 bg-ink-700 px-3 text-base text-paper outline-none transition-colors focus:border-blue-pen"
            />
          </Field>

          <Field label="პაროლი" hint={`სულ მცირე ${MIN_PASSWORD} სიმბოლო.`}>
            <div className="flex gap-2">
              <input
                required
                minLength={MIN_PASSWORD}
                autoComplete="off"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="tnum min-h-12 w-full min-w-0 rounded-lg border border-ink-600 bg-ink-700 px-3 text-base text-paper outline-none transition-colors focus:border-blue-pen"
              />
              <button
                type="button"
                aria-label="სხვა პაროლი"
                onClick={() => setForm({ ...form, password: suggestPassword() })}
                className="grid min-h-12 w-12 shrink-0 place-items-center rounded-lg border border-ink-600 text-paper-2 transition-colors hover:bg-ink-700 hover:text-paper"
              >
                <RefreshCw size={16} strokeWidth={1.75} />
              </button>
            </div>
          </Field>

          <button
            type="button"
            role="switch"
            aria-checked={form.owner}
            onClick={() => setForm({ ...form, owner: !form.owner })}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-ink-600 px-4 text-left transition-colors hover:bg-ink-700"
          >
            <span
              aria-hidden="true"
              className={`grid size-[22px] shrink-0 place-items-center rounded border transition-colors ${
                form.owner
                  ? "border-blue-pen bg-blue-pen text-ink-900"
                  : "border-ink-600 text-transparent"
              }`}
            >
              <Check size={13} strokeWidth={3} />
            </span>
            <span className="flex-1">
              <span className="block text-base text-paper">
                ადმინისტრატორია
              </span>
              <span className="block text-meta text-paper-3">
                სხვების დამატებაც შეეძლება.
              </span>
            </span>
          </button>

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
            {busy ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <UserPlus size={17} strokeWidth={1.75} />
            )}
            {busy ? "ვამატებ" : "დამატება"}
          </button>

          <p className="measure text-meta text-paper-3">
            {isSupabaseConfigured
              ? "უკვე არსებული ელფოსტით დამატება პაროლს ცვლის — დავიწყებული პაროლი ასე აღდგება."
              : "საცდელი რეჟიმი — ბაზა მიერთებული არ არის, ამიტომ ეს სია გვერდის დატოვებისთანავე დაიკარგება."}
          </p>
        </form>
      </div>
    </Sheet>
  );
}

function IconButton({ label, children, pressed, danger, disabled, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`grid size-11 place-items-center rounded-lg border transition-colors disabled:opacity-50 ${
        pressed
          ? "border-blue-pen bg-blue-dim/30 text-blue-pen"
          : danger
            ? "border-ink-600 text-paper-3 hover:bg-red-dim/30 hover:text-red-text"
            : "border-ink-600 text-paper-2 hover:bg-ink-700 hover:text-paper"
      }`}
    >
      {children}
    </button>
  );
}
