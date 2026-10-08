import { useState } from "react";
import {
  Check,
  Copy,
  Ellipsis,
  FileText,
  Image as ImageIcon,
  Link2,
  Pencil,
  Pin,
  PinOff,
  CopyPlus,
  Trash2,
} from "lucide-react";
import { getSubject, PAPER_CLASS } from "../lib/subjects.js";
import { describeDue, ergative, relativeAgo } from "../lib/georgian.js";
import { useNow } from "../hooks/useNow.js";

/**
 * A single sheet from the notebook.
 *
 * The left margin rule is the whole status system: solid red when the
 * deadline is on you, drawn lightly when it is a few days out, faint when it
 * is far off, and extinguished once you tick the work done. Overdue work
 * gets the rule drawn twice, the way you would go back over a line in pen.
 * That is why no card here needs a coloured badge.
 */

const RULE = {
  overdue: "var(--color-red-pen)",
  urgent: "var(--color-red-pen)",
  soon: "var(--color-red-dim)",
  later: "var(--color-ink-600)",
};

function AttachmentChip({ attachment }) {
  const Icon = attachment.type?.startsWith("image/") ? ImageIcon : FileText;
  const content = (
    <>
      <Icon size={13} strokeWidth={1.75} className="shrink-0 text-paper-3" />
      <span className="truncate">{attachment.name}</span>
    </>
  );

  const className =
    "inline-flex min-h-11 max-w-[190px] items-center gap-1.5 rounded-lg border border-hairline bg-ink-700/70 px-3 py-1 text-meta text-paper-2 no-underline transition-colors hover:border-ink-600 hover:text-paper";

  return attachment.url ? (
    <a href={attachment.url} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}

export default function HomeworkCard({
  item,
  isDone,
  onToggleDone,
  onCopy,
  isRep,
  onEdit,
  onTogglePin,
  onDuplicate,
  onDelete,
  style,
  animate = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const now = useNow();

  const subject = getSubject(item.subject);
  const due = describeDue(item.dueAt, now);
  const tone = isDone ? "done" : due.tone;
  const ruleColor = isDone ? "var(--color-spent)" : RULE[due.tone];
  const isLate = tone === "overdue";

  const dueTextClass =
    isDone
      ? "text-spent"
      : tone === "overdue" || tone === "urgent"
        ? "text-red-text"
        : tone === "soon"
          ? "text-paper-2"
          : "text-paper-3";

  return (
    <article
      style={style}
      className={[
        "group relative rounded-r-[10px] border border-l-0 border-hairline bg-ink-800",
        PAPER_CLASS[subject.paper],
        "transition-[opacity,background-color] duration-300",
        isDone ? "opacity-55" : "opacity-100",
        animate ? "animate-settle" : "",
      ].join(" ")}
    >
      {/* The margin: a strip of blank paper, then the drawn rule. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-[22px] w-[1.5px] rounded-full transition-colors duration-300"
        style={{ background: ruleColor }}
      />
      {isLate && (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-[26px] w-[1.5px] rounded-full bg-red-pen/35"
        />
      )}
      {item.isPinned && !isDone && (
        <span
          aria-hidden="true"
          className="absolute left-[7px] top-[25px] h-[2px] w-[9px] rounded-full bg-red-pen"
        />
      )}

      <div className="py-4 pl-10 pr-4">
        {/* Subject names itself in serif; the deadline answers from the right. */}
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-serif text-lg font-semibold text-paper">
            {subject.name}
            {item.isPinned && !isDone && (
              <span className="ml-2 align-middle font-sans text-meta font-normal text-red-text">
                მნიშვნელოვანი
              </span>
            )}
          </h3>
          <div className="shrink-0 text-right">
            <div className={`text-sm font-semibold ${dueTextClass}`}>
              {isDone ? "შესრულებულია" : due.label}
            </div>
            {!isDone && (
              <div className="tnum text-meta text-paper-3">{due.detail}</div>
            )}
          </div>
        </div>

        <p
          className={`mt-1.5 measure text-base ${
            isDone ? "text-paper-3 line-through decoration-spent" : "text-paper"
          }`}
        >
          {item.title}
        </p>

        {item.details && (
          <>
            <p
              className={`mt-1 measure text-sm text-paper-2 ${
                expanded ? "" : "line-clamp-3"
              }`}
            >
              {item.details}
            </p>
            {item.details.length > 120 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="-ml-1 mt-0.5 inline-flex min-h-11 items-center px-1 text-meta text-blue-pen underline-offset-4 hover:underline"
              >
                {expanded ? "დახურვა" : "სრულად"}
              </button>
            )}
          </>
        )}

        {(item.linkUrl || item.attachments.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {item.linkUrl && (
              <a
                href={item.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 max-w-[220px] items-center gap-1.5 rounded-lg border border-blue-dim bg-blue-dim/25 px-3 py-1 text-meta text-blue-pen no-underline transition-colors hover:bg-blue-dim/50"
              >
                <Link2 size={13} strokeWidth={1.75} className="shrink-0" />
                <span className="truncate">ბმული</span>
              </a>
            )}
            {item.attachments.map((a, i) => (
              <AttachmentChip key={a.path ?? a.url ?? i} attachment={a} />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-end justify-between gap-2 border-t border-hairline pt-2.5">
          <p className="text-meta text-paper-3">
            {item.authorName
              ? `დაამატა ${ergative(item.authorName)}, ${relativeAgo(item.createdAt, now)}`
              : relativeAgo(item.createdAt, now)}
            {item.updatedAt ? ", შესწორებულია" : ""}
          </p>

          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => onCopy(item)}
              aria-label="დავალების კოპირება"
              className="grid size-11 place-items-center rounded text-paper-3 transition-colors hover:text-paper"
            >
              <Copy size={17} strokeWidth={1.75} />
            </button>

            {isRep && (
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-label="დავალების მართვა"
                className={`grid size-11 place-items-center rounded transition-colors ${
                  menuOpen ? "text-paper" : "text-paper-3 hover:text-paper"
                }`}
              >
                <Ellipsis size={18} strokeWidth={1.75} />
              </button>
            )}

            <button
              type="button"
              onClick={() => onToggleDone(item.id)}
              aria-pressed={isDone}
              className="grid size-11 place-items-center rounded"
            >
              <span className="sr-only">შესრულებულია</span>
              <span
                aria-hidden="true"
                className={`grid size-[22px] place-items-center rounded-full border transition-all duration-200 ${
                  isDone
                    ? "border-spent bg-spent text-ink-900"
                    : "border-ink-600 text-transparent hover:border-paper-3"
                }`}
              >
                <Check size={13} strokeWidth={3} />
              </span>
            </button>
          </div>
        </div>

        {/* Rep tools expand in place rather than covering the board. */}
        {isRep && menuOpen && (
          <div className="animate-settle mt-2 flex flex-wrap gap-1.5 border-t border-hairline pt-2.5">
            <RepAction icon={Pencil} label="რედაქტირება" onClick={() => { setMenuOpen(false); onEdit(item); }} />
            <RepAction
              icon={item.isPinned ? PinOff : Pin}
              label={item.isPinned ? "აღარ არის მნიშვნელოვანი" : "მნიშვნელოვანი"}
              onClick={() => { setMenuOpen(false); onTogglePin(item); }}
            />
            <RepAction icon={CopyPlus} label="გამეორება" onClick={() => { setMenuOpen(false); onDuplicate(item); }} />
            <RepAction
              icon={Trash2}
              label="წაშლა"
              danger
              onClick={() => { setMenuOpen(false); onDelete(item); }}
            />
          </div>
        )}
      </div>
    </article>
  );
}

function RepAction({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded border border-hairline px-3 text-sm transition-colors ${
        danger
          ? "text-red-text hover:border-red-dim hover:bg-red-dim/20"
          : "text-paper-2 hover:border-ink-600 hover:bg-ink-700 hover:text-paper"
      }`}
    >
      <Icon size={15} strokeWidth={1.75} />
      {label}
    </button>
  );
}
