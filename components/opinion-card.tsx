import type { OpinionResult } from "@/lib/schemas";
import { OPINION_STYLES } from "@/lib/verdict-style";
import { ClaimHeader, Shell, SourceList } from "./claim-card";
import { ConfidenceBar } from "./confidence-bar";

function AssessmentBadge({ assessment }: { assessment: keyof typeof OPINION_STYLES }) {
  const style = OPINION_STYLES[assessment];
  return (
    <span
      title={style.description}
      className={`pop inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset ${style.badge}`}
    >
      <span aria-hidden="true" className="font-bold">{style.icon}</span>
      {assessment}
    </span>
  );
}

export function PendingOpinionCard({ index, text }: { index: number; text: string }) {
  return (
    <Shell verdict={null} index={index} kind="opinion" busy>
      <ClaimHeader
        index={index}
        kind="opinion"
        text={text}
        right={
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
            <span
              aria-hidden="true"
              className="size-3.5 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700 dark:border-violet-800 dark:border-t-violet-300"
            />
            Weighing evidence…
          </span>
        }
      />
      <div aria-hidden="true" className="mt-5 space-y-2.5">
        <div className="shimmer h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="shimmer h-3 w-11/12 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="shimmer h-3 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </Shell>
  );
}

function Points({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white/70 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
      <h4 className={`text-xs font-semibold uppercase tracking-wider ${tone}`}>{title}</h4>
      <ul className="mt-2 space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
        {items.map((p) => (
          <li key={p} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-current opacity-50" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OpinionCard({ index, result }: { index: number; result: OpinionResult }) {
  if (result.status === "error") {
    return (
      <Shell verdict="Error" index={index} kind="opinion">
        <ClaimHeader
          index={index}
          kind="opinion"
          text={result.text}
          right={
            <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-800 ring-1 ring-inset ring-zinc-500/40 dark:bg-zinc-800 dark:text-zinc-200">
              Couldn&apos;t assess
            </span>
          }
        />
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{result.error}</p>
      </Shell>
    );
  }

  const style = OPINION_STYLES[result.assessment];
  return (
    <Shell verdict={null} tone={style} index={index} kind="opinion">
      <ClaimHeader
        index={index}
        kind="opinion"
        text={result.text}
        right={<AssessmentBadge assessment={result.assessment} />}
      />
      <div className="mt-4">
        <ConfidenceBar value={result.confidence} barClass={style.bar} />
      </div>
      <p className="mt-4 leading-relaxed text-zinc-700 dark:text-zinc-300">{result.explanation}</p>
      {(result.supporting.length > 0 || result.opposing.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Points title="Points in favour" items={result.supporting} tone="text-teal-700 dark:text-teal-300" />
          <Points title="Points against" items={result.opposing} tone="text-rose-700 dark:text-rose-300" />
        </div>
      )}
      <SourceList sources={result.sources} />
    </Shell>
  );
}
