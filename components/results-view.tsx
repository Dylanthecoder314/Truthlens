import type {
  CheckInput,
  ClaimResult,
  NotCheckable,
  OpinionResult,
  PendingClaim,
  Summary,
} from "@/lib/schemas";
import { countVerdicts } from "@/lib/schemas";
import { ClaimCard, PendingClaimCard } from "./claim-card";
import { OpinionCard, PendingOpinionCard } from "./opinion-card";
import { SummaryPanel } from "./summary-panel";

export interface ResultsViewProps {
  input: CheckInput | null;
  claims: PendingClaim[];
  results: Record<string, ClaimResult>;
  opinions: PendingClaim[];
  opinionResults: Record<string, OpinionResult>;
  notCheckable: NotCheckable[];
  summary: Summary | null;
  notices: string[];
  streaming: boolean;
  /** True once the claim list is known. */
  claimsKnown: boolean;
}

export function ResultsView(props: ResultsViewProps) {
  const { input, claims, results, opinions, opinionResults, notCheckable, summary, notices, streaming, claimsKnown } = props;
  const done = claims.map((c) => results[c.id]).filter((r): r is ClaimResult => Boolean(r));
  const counts = summary?.counts ?? countVerdicts(done);

  return (
    <div className="space-y-6">
      {input && (
        <section aria-label="Checked input" className="rounded-2xl border border-zinc-200 bg-white/60 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          {input.type === "url" && input.url ? (
            <p>
              Checked article:{" "}
              <a
                href={input.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-indigo-700 underline underline-offset-2 dark:text-indigo-300"
              >
                {input.title ?? input.url}
              </a>
            </p>
          ) : (
            <details>
              <summary className="cursor-pointer font-medium text-zinc-800 dark:text-zinc-200">
                Show the checked text
              </summary>
              <blockquote className="mt-3 whitespace-pre-wrap border-l-2 border-indigo-300 pl-3 leading-relaxed text-zinc-700 dark:border-indigo-500/50 dark:text-zinc-300">
                {input.text}
              </blockquote>
            </details>
          )}
        </section>
      )}

      {notices.length > 0 && (
        <ul className="space-y-1 rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950 dark:border-sky-500/30 dark:bg-sky-950/30 dark:text-sky-100">
          {notices.map((n) => (
            <li key={n}>ℹ︎ {n}</li>
          ))}
        </ul>
      )}

      <SummaryPanel
        counts={counts}
        total={claims.length}
        completed={done.length}
        summaryText={summary?.text ?? null}
        streaming={streaming}
      />

      <section aria-labelledby="claims-heading" className="space-y-4">
        <h2 id="claims-heading" className="flex items-baseline gap-2 text-lg font-semibold">
          Claims
          {claims.length > 0 && (
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">{claims.length}</span>
          )}
        </h2>
        {!claimsKnown ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-400"
            />
            Reading the text and finding checkable claims…
          </div>
        ) : claims.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-400">
            No checkable factual claims were found. Any opinions, predictions and vague statements are
            listed below.
          </p>
        ) : (
          <ol className="space-y-4">
            {claims.map((c, i) => {
              const r = results[c.id];
              return (
                <li key={c.id}>
                  {r ? (
                    <ClaimCard index={i + 1} result={r} />
                  ) : streaming ? (
                    <PendingClaimCard index={i + 1} text={c.text} />
                  ) : (
                    <ClaimCard
                      index={i + 1}
                      result={{ ...c, status: "error", error: "This claim wasn't checked because the check stopped early." }}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {opinions.length > 0 && (
        <section aria-labelledby="opinions-heading" className="space-y-4">
          <div>
            <h2 id="opinions-heading" className="flex items-baseline gap-2 text-lg font-semibold">
              Opinions
              <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">{opinions.length}</span>
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Opinions can&apos;t be true or false, so instead we weigh the evidence and informed views on both
              sides.
            </p>
          </div>
          <ol className="space-y-4">
            {opinions.map((o, i) => {
              const r = opinionResults[o.id];
              return (
                <li key={o.id}>
                  {r ? (
                    <OpinionCard index={i + 1} result={r} />
                  ) : streaming ? (
                    <PendingOpinionCard index={i + 1} text={o.text} />
                  ) : (
                    <OpinionCard
                      index={i + 1}
                      result={{ ...o, status: "error", error: "This opinion wasn't assessed because the check stopped early." }}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {notCheckable.length > 0 && (
        <section aria-labelledby="not-checkable-heading" className="space-y-3">
          <h2 id="not-checkable-heading" className="text-lg font-semibold">
            Not checkable
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Predictions, vague statements and personal taste can&apos;t be tested against evidence.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {notCheckable.map((n, i) => (
              <li
                key={`${i}-${n.text}`}
                className="rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <p className="text-zinc-800 dark:text-zinc-200">&ldquo;{n.text}&rdquo;</p>
                <p className="mt-2 inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {n.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
