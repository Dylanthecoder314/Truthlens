import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import { Disclaimer } from "@/components/disclaimer";
import { ResultsView } from "@/components/results-view";
import { getCheck } from "@/lib/db";
import type { ClaimResult } from "@/lib/schemas";

export const dynamic = "force-dynamic";

async function load(id: string) {
  if (!/^[A-Za-z0-9]{6,32}$/.test(id)) return null;
  return getCheck(id);
}

export async function generateMetadata({ params }: PageProps<"/check/[id]">): Promise<Metadata> {
  const check = await load((await params).id);
  if (!check) return { title: "Check not found" };
  const total = check.claims.length;
  return {
    title: check.input.title ?? "Fact-check result",
    description: `${total} claim${total === 1 ? "" : "s"} checked. ${check.summary.text}`.slice(0, 200),
  };
}

export default async function CheckPage({ params }: PageProps<"/check/[id]">) {
  const { id } = await params;
  const check = await load(id);
  if (!check) notFound();

  const results: Record<string, ClaimResult> = Object.fromEntries(
    check.claims.map((c) => [c.id, c]),
  );
  const created = new Date(check.createdAt);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/history" className="underline underline-offset-2">
            History
          </Link>{" "}
          / Check {check.id}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="h-display fade-up text-4xl font-semibold tracking-tight sm:text-5xl">Fact-check result</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Checked on{" "}
              <time dateTime={check.createdAt}>
                {created.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })} UTC
              </time>
            </p>
          </div>
          <CopyLinkButton path={`/check/${check.id}`} />
        </div>
      </header>

      <ResultsView
        input={check.input}
        claims={check.claims.map((c) => ({ id: c.id, text: c.text }))}
        claimsKnown
        results={results}
        opinions={check.opinions.map((o) => ({ id: o.id, text: o.text }))}
        opinionResults={Object.fromEntries(check.opinions.map((o) => [o.id, o]))}
        notCheckable={check.notCheckable}
        summary={check.summary}
        notices={check.notices}
        streaming={false}
      />

      <Disclaimer />

      <p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/30 hover:bg-indigo-700 dark:hover:bg-indigo-500"
        >
          Check something else
        </Link>
      </p>
    </div>
  );
}
