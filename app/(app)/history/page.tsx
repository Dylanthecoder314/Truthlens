import type { Metadata } from "next";
import Link from "next/link";
import { VerdictBadge } from "@/components/verdict-badge";
import { listRecentChecks } from "@/lib/db";
import { VERDICT_ORDER } from "@/lib/verdict-style";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const items = await listRecentChecks(20);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="h-display fade-up text-4xl font-semibold tracking-tight sm:text-5xl">History</h1>
        <p className="text-zinc-700 dark:text-zinc-300">The 20 most recent checks.</p>
      </header>

      {items.length === 0 ? (
        <div className="fade-up rounded-2xl border border-dashed border-zinc-300 bg-white/50 p-10 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
          <p className="text-zinc-700 dark:text-zinc-300">No checks yet.</p>
          <Link href="/" className="mt-2 inline-block font-medium text-indigo-700 underline underline-offset-2 dark:text-indigo-300">
            Run your first check
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={item.id} className="fade-up" style={{ "--i": Math.min(i, 10) } as React.CSSProperties}>
              <Link
                href={`/check/${item.id}`}
                className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500/50"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-medium uppercase tracking-wide dark:bg-zinc-800">
                    {item.inputType}
                  </span>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
                  </time>
                  <span>
                    {item.claimCount === 0
                      ? "No checkable claims"
                      : `${item.claimCount} claim${item.claimCount === 1 ? "" : "s"}`}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 font-medium text-zinc-900 dark:text-zinc-100">{item.preview}</p>
                {item.claimCount > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {VERDICT_ORDER.filter((v) => item.counts[v] > 0).map((v) => (
                      <span key={v} className="inline-flex items-center gap-1">
                        <VerdictBadge verdict={v} size="sm" />
                        <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                          ×{item.counts[v]}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
