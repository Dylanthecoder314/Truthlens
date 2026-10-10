import Link from "next/link";

export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="flex items-start justify-center gap-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <span>
          AI fact-checks can be wrong. Read the sources before you rely on a verdict.{" "}
          <Link href="/how-it-works" className="font-medium text-zinc-800 underline underline-offset-2 dark:text-zinc-200">
            How it works
          </Link>
        </span>
      </p>
    );
  }
  return (
    <aside
      aria-label="Disclaimer"
      className="flex gap-3 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      <p>
        <strong className="font-semibold">AI fact-checks can be wrong.</strong> Verdicts come from an
        AI model reading live web searches. Open the sources before you rely on or share a result.{" "}
        <Link href="/how-it-works" className="font-medium underline underline-offset-2">
          How it works
        </Link>
      </p>
    </aside>
  );
}
