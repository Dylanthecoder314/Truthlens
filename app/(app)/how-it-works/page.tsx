import type { Metadata } from "next";
import { VerdictBadge } from "@/components/verdict-badge";
import { VERDICTS } from "@/lib/schemas";
import { VERDICT_STYLES } from "@/lib/verdict-style";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    title: "1. Find the claims",
    body: "An AI model reads your text and pulls out each specific factual claim that evidence could confirm or refute. Opinions are pulled out separately and weighed rather than ruled true or false: you get the strongest points for and against, plus sources. Predictions and vague statements are listed as not checkable, with a reason.",
  },
  {
    title: "2. Research each claim",
    body: "Each claim is researched separately with live web search. The model is told to prefer primary sources (official statistics, original studies, records, transcripts) and reputable outlets, and to answer “Unverifiable” rather than guess.",
  },
  {
    title: "3. Only show sources that were retrieved",
    body: "Before a source is shown, TruthLens checks that the page actually appeared in the search results for that claim. Links the model did not retrieve are dropped, so every source is a page that was really consulted.",
  },
  {
    title: "4. Summarise",
    body: "Results stream in as each claim finishes. A final summary describes how accurate the text is overall, and the whole check is saved with a shareable link.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <h1 className="h-display fade-up text-4xl font-semibold tracking-tight sm:text-5xl">How it works</h1>
        <p className="text-lg text-zinc-700 dark:text-zinc-300">
          TruthLens uses an AI model with live web search to help you judge factual claims quickly,
          and shows its sources so you can check its work.
        </p>
      </header>

      <section
        aria-labelledby="disclaimer-heading"
        className="reveal rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-amber-950 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-50"
      >
        <h2 id="disclaimer-heading" className="text-lg font-semibold">
          Important: AI fact-checks can be wrong
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The model can misread a source, miss context, or rely on outdated or low-quality pages.</li>
          <li>Search results change over time, and very recent events may not be covered yet.</li>
          <li>A confidence score is the model&apos;s own estimate, not a statistical guarantee.</li>
          <li>
            <strong>Always read the linked sources</strong> before you rely on or share a verdict,
            especially for health, legal, financial or safety decisions.
          </li>
        </ul>
      </section>

      <section aria-labelledby="method-heading" className="space-y-4">
        <h2 id="method-heading" className="text-xl font-semibold">
          The method
        </h2>
        <ol className="space-y-4">
          {STEPS.map((s) => (
            <li key={s.title} className="reveal lift rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="verdicts-heading" className="space-y-4">
        <h2 id="verdicts-heading" className="text-xl font-semibold">
          What the verdicts mean
        </h2>
        <dl className="reveal divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {VERDICTS.map((v) => (
            <div key={v} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <dt className="sm:w-40">
                <VerdictBadge verdict={v} />
              </dt>
              <dd className="text-zinc-700 dark:text-zinc-300">{VERDICT_STYLES[v].description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="limits-heading" className="space-y-2">
        <h2 id="limits-heading" className="text-xl font-semibold">
          Limits
        </h2>
        <p className="text-zinc-700 dark:text-zinc-300">
          Inputs are limited to 8,000 characters and up to 12 claims per check (5 when running on the free Groq tier). Each visitor can run
          10 checks per hour. Checks are saved and appear on the public History page, so
          don&apos;t paste private information.
        </p>
      </section>
    </div>
  );
}
