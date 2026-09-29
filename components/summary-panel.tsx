import type { VerdictCounts } from "@/lib/schemas";
import { VERDICT_ORDER, VERDICT_STYLES } from "@/lib/verdict-style";
import { VerdictBadge } from "./verdict-badge";

export function SummaryPanel({
  counts,
  total,
  completed,
  summaryText,
  streaming,
}: {
  counts: VerdictCounts;
  total: number;
  completed: number;
  summaryText: string | null;
  streaming: boolean;
}) {
  const shown = VERDICT_ORDER.filter((v) => counts[v] > 0);
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <section
      aria-labelledby="summary-heading"
      className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg shadow-zinc-900/5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/30"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="summary-heading" className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Overall summary
          </h2>
          <p className="mt-1 text-2xl font-bold tracking-tight" aria-live="polite">
            {streaming
              ? total === 0
                ? "Finding claims…"
                : `Checking ${completed} of ${total}…`
              : `${total} claim${total === 1 ? "" : "s"} checked`}
          </p>
        </div>
        {streaming && total > 0 && (
          <span className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">{progress}%</span>
        )}
      </div>

      {total > 0 && (
        <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
          {shown.map((v) => (
            <div
              key={v}
              className={`${VERDICT_STYLES[v].bar} grow-x transition-[width] duration-500`}
              style={{ width: `${(counts[v] / total) * 100}%` }}
            />
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Verdict counts">
          {shown.map((v) => (
            <li key={v} className="inline-flex items-center gap-1.5">
              <VerdictBadge verdict={v} size="sm" />
              <span className="text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                ×{counts[v]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(summaryText || streaming) && (
        <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800">
          {summaryText ? (
            <p className="rise-in text-[1.05rem] leading-relaxed text-zinc-800 dark:text-zinc-200">{summaryText}</p>
          ) : (
            <div aria-hidden="true" className="space-y-2.5">
              <div className="shimmer h-3.5 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="shimmer h-3.5 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
