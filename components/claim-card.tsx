import type { ClaimResult, Source } from "@/lib/schemas";
import { VERDICT_STYLES, type VerdictOrError } from "@/lib/verdict-style";
import { ConfidenceBar } from "./confidence-bar";
import { VerdictBadge } from "./verdict-badge";

export function Shell({
  verdict,
  tone,
  index,
  busy,
  kind = "claim",
  children,
}: {
  verdict: VerdictOrError | null;
  /** Overrides the verdict colours (opinion cards). */
  tone?: { bar: string; wash: string };
  index: number;
  busy?: boolean;
  kind?: "claim" | "opinion";
  children: React.ReactNode;
}) {
  const style = tone ?? (verdict ? VERDICT_STYLES[verdict] : null);
  return (
    <article
      aria-busy={busy || undefined}
      aria-labelledby={`${kind}-${index}`}
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
      className={`rise-in lift relative overflow-hidden rounded-2xl border border-zinc-200 bg-white bg-gradient-to-br to-transparent to-40% shadow-sm hover:shadow-lg hover:shadow-zinc-900/10 dark:hover:shadow-black/40 dark:border-zinc-800 dark:bg-zinc-900 ${style?.wash ?? ""}`}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${style?.bar ?? "bg-zinc-200 dark:bg-zinc-700"}`}
      />
      <div className="p-5 pl-6 sm:p-6 sm:pl-7">{children}</div>
    </article>
  );
}

export function ClaimHeader({
  index,
  text,
  right,
  kind = "claim",
}: {
  index: number;
  text: string;
  right: React.ReactNode;
  kind?: "claim" | "opinion";
}) {
  const label = kind === "claim" ? "Claim" : "Opinion";
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label} {index}
        </p>
        <h3 id={`${kind}-${index}`} className="mt-1 text-[1.05rem] font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
          <span className="sr-only">{label} {index}: </span>
          {text}
        </h3>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

export function PendingClaimCard({ index, text }: { index: number; text: string }) {
  return (
    <Shell verdict={null} index={index} busy>
      <ClaimHeader
        index={index}
        text={text}
        right={
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200">
            <span
              aria-hidden="true"
              className="size-3.5 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700 dark:border-indigo-800 dark:border-t-indigo-300"
            />
            Researching…
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

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function SourceList({ sources }: { sources: Source[] }) {
  if (sources.length === 0) {
    return (
      <p className="mt-5 text-sm text-zinc-500 dark:text-zinc-400">
        No sources could be confirmed for this claim.
      </p>
    );
  }
  return (
    <details className="group mt-5">
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg py-1 text-sm font-medium text-indigo-700 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4 transition-transform group-open:rotate-90" fill="currentColor">
          <path d="M7.2 4.7a.75.75 0 0 1 1.06 0l4.77 4.77a.75.75 0 0 1 0 1.06l-4.77 4.77a.75.75 0 1 1-1.06-1.06L11.44 10 7.2 5.76a.75.75 0 0 1 0-1.06Z" />
        </svg>
        <span className="group-open:hidden">Show {sources.length} source{sources.length === 1 ? "" : "s"}</span>
        <span className="hidden group-open:inline">Hide sources</span>
        <span aria-hidden="true" className="flex flex-wrap gap-1 group-open:hidden">
          {sources.slice(0, 3).map((s) => (
            <span key={s.url} className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-normal text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {hostname(s.url)}
            </span>
          ))}
        </span>
      </summary>
      <ol className="mt-3 space-y-2">
        {sources.map((s) => (
          <li key={s.url}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white/70 p-3 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-950/20"
            >
              <span className="min-w-0">
                <span className="block font-medium text-zinc-900 group-hover/link:text-indigo-800 dark:text-zinc-100 dark:group-hover/link:text-indigo-200">
                  {s.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {[s.publisher ?? hostname(s.url), s.date].filter(Boolean).join(" · ")}
                </span>
              </span>
              <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-zinc-400 group-hover/link:text-indigo-600 dark:group-hover/link:text-indigo-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-3M11 4h5v5M16 4l-7 7" />
              </svg>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function ClaimCard({ index, result }: { index: number; result: ClaimResult }) {
  if (result.status === "error") {
    return (
      <Shell verdict="Error" index={index}>
        <ClaimHeader index={index} text={result.text} right={<VerdictBadge verdict="Error" />} />
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{result.error}</p>
      </Shell>
    );
  }

  return (
    <Shell verdict={result.verdict} index={index}>
      <ClaimHeader index={index} text={result.text} right={<VerdictBadge verdict={result.verdict} />} />
      <div className="mt-4">
        <ConfidenceBar value={result.confidence} verdict={result.verdict} />
      </div>
      <p className="mt-4 leading-relaxed text-zinc-700 dark:text-zinc-300">{result.explanation}</p>
      <SourceList sources={result.sources} />
    </Shell>
  );
}
