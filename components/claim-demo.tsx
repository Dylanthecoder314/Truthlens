"use client";

import { useState } from "react";

const CLAIMS = [
  {
    text: "Humans only use 10% of their brains.",
    mark: "10% of their brains",
    verdict: "False",
    good: false,
    confidence: 95,
    steps: [
      ["Claim found", "A checkable statement about how much of the brain is in use."],
      ["Evidence", "Brain imaging shows activity across the whole brain over a day, including during sleep."],
      ["Verdict", "A long-running myth. No region of the brain sits idle."],
    ],
  },
  {
    text: "Water boils at 100°C at sea level.",
    mark: "100°C at sea level",
    verdict: "True",
    good: true,
    confidence: 98,
    steps: [
      ["Claim found", "A checkable statement with a condition attached: sea level."],
      ["Evidence", "At standard atmospheric pressure the boiling point of water is 100°C."],
      ["Verdict", "True as stated. The condition matters: it boils at lower temperatures at altitude."],
    ],
  },
  {
    text: "The Great Wall is visible from space with the naked eye.",
    mark: "visible from space",
    verdict: "Mostly false",
    good: false,
    confidence: 80,
    steps: [
      ["Claim found", "“Space” is vague, so the check has to pin down what it means."],
      ["Evidence", "Astronauts in low orbit report it is very hard to pick out, and it cannot be seen from the Moon."],
      ["Verdict", "The wall is long but narrow, and it blends into its surroundings."],
    ],
  },
];

export function ClaimDemo() {
  const [sel, setSel] = useState(0);
  const c = CLAIMS[sel];

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div role="tablist" aria-label="Example claims" className="flex flex-col gap-3">
        {CLAIMS.map((claim, i) => (
          <button
            key={claim.text}
            type="button"
            role="tab"
            id={`claim-tab-${i}`}
            aria-selected={sel === i}
            aria-controls="claim-panel"
            onClick={() => setSel(i)}
            className={`display rounded-xl border-2 px-5 py-4 text-left text-xl leading-snug transition-[transform,background-color,color] duration-300 sm:text-2xl ${
              sel === i
                ? "translate-x-2 border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                : "border-[var(--ink)]/25 hover:-translate-y-0.5 hover:border-[var(--ink)]"
            }`}
          >
            {claim.text}
          </button>
        ))}
        <p className="pt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Three examples. A real check researches the live web and links every source.
        </p>
      </div>

      <div
        id="claim-panel"
        role="tabpanel"
        aria-labelledby={`claim-tab-${sel}`}
        className="rounded-2xl border-2 border-[var(--ink)] p-6 sm:p-8"
      >
        <div key={sel}>
          <p className="display text-2xl leading-snug sm:text-3xl">
            {c.text.split(c.mark)[0]}
            <span className={c.good ? "hl hl-ok" : "hl"}>{c.mark}</span>
            {c.text.split(c.mark)[1]}
          </p>
          <ol className="mt-8 space-y-5">
            {c.steps.map(([title, body], n) => (
              <li key={title} className="step flex gap-4" style={{ "--n": n } as React.CSSProperties}>
                <span className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--ink)] font-mono text-xs text-[var(--paper)]">
                  {n + 1}
                </span>
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em]">{title}</p>
                  <p className="mt-1 text-zinc-700 dark:text-zinc-300">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="step mt-8 flex items-center gap-4" style={{ "--n": 3 } as React.CSSProperties}>
            <span className={`tag ${c.good ? "tag-ok" : "tag-bad"}`}>{c.verdict.toUpperCase()}</span>
            <div
              className={`meter h-2 flex-1 overflow-hidden rounded-full bg-[var(--ink)]/10 ${c.good ? "text-[var(--ok)]" : "text-[var(--flag)]"}`}
              role="img"
              aria-label={`Confidence ${c.confidence} percent (illustrative)`}
            >
              <i style={{ width: `${c.confidence}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
