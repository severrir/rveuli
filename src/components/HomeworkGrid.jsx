import HomeworkCard from "./HomeworkCard.jsx";
import EmptyState from "./EmptyState.jsx";

/**
 * The feed.
 *
 * Only the first few cards carry the entrance animation, and only on first
 * paint — a stagger that runs down a long list on every filter change turns
 * into noise, and makes the board feel slower than it is.
 */
const STAGGER_LIMIT = 6;

export default function HomeworkGrid({
  items,
  doneSet,
  firstPaint,
  emptyState,
  ...cardProps
}) {
  if (items.length === 0) return emptyState ?? <EmptyState />;

  return (
    <ul className="flex flex-col gap-2.5 px-4 sm:grid sm:grid-cols-2 sm:items-start xl:grid-cols-3">
      {items.map((item, i) => (
        <li key={item.id}>
          <HomeworkCard
            item={item}
            isDone={doneSet.has(item.id)}
            animate={firstPaint && i < STAGGER_LIMIT}
            style={
              firstPaint && i < STAGGER_LIMIT
                ? { animationDelay: `${120 + i * 45}ms` }
                : undefined
            }
            {...cardProps}
          />
        </li>
      ))}
    </ul>
  );
}
