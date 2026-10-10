"use client";

import { useState } from "react";

const FLAGS = [
  { id: "source", label: "Unknown page name", tip: "A name that sounds official but has no history, about page or named people. Search it in a new tab before trusting it." },
  { id: "urgent", label: "Urgent and emotional", tip: "ALL CAPS, alarm and outrage are built to make you share before you think. Strong feeling is a cue to slow down." },
  { id: "claim", label: "Vague authority", tip: "“Scientists”, “experts” and “they” with no names, no study and no link. Who exactly said it, and where?" },
  { id: "image", label: "Photo with no caption", tip: "No place, date or photographer. Run a reverse image search: old photos are often reposted as new events." },
  { id: "share", label: "“Share before it is deleted”", tip: "Pressure to spread it. Real reporting does not need you to hurry, and 'they are hiding it' is a tell." },
] as const;

export function FlagHunt() {
  const [found, setFound] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const flag = (id: string) => FLAGS.find((f) => f.id === id)!;

  function hit(id: string) {
    setOpen(id);
    setFound((f) => (f.includes(id) ? f : [...f, id]));
  }
  const btn = (id: string) =>
    `rounded px-1 text-left underline decoration-dotted underline-offset-4 transition-colors ${
      found.includes(id) ? "bg-[var(--flag)]/20 decoration-[var(--flag)]" : "hover:bg-[var(--flag)]/10"
    }`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <article className="rounded-2xl border-2 border-[var(--ink)] p-6 sm:p-8" aria-label="A made-up social media post">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400">A made-up post. Tap the red flags.</p>
        <div className="mt-5 flex items-center gap-3">
          <span className="size-10 rounded-full bg-[var(--ink)]/15" aria-hidden="true" />
          <button type="button" onClick={() => hit("source")} className={`${btn("source")} font-semibold`}>
            Daily Truth Patriots
          </button>
        </div>
        <p className="display mt-5 text-2xl leading-snug sm:text-3xl">
          <button type="button" onClick={() => hit("urgent")} className={btn("urgent")}>
            BREAKING!!! THEY DON&apos;T WANT YOU TO KNOW THIS
          </button>{" "}
          <button type="button" onClick={() => hit("claim")} className={btn("claim")}>
            Scientists have confirmed the everyday product in your kitchen is dangerous.
          </button>
        </p>
        <button
          type="button"
          onClick={() => hit("image")}
          className={`mt-5 grid h-40 w-full place-items-center rounded-lg border border-dashed border-[var(--ink)]/40 font-mono text-xs uppercase tracking-[0.14em] ${btn("image")}`}
        >
          [ photo, no caption, no date ]
        </button>
        <p className="mt-5">
          <button type="button" onClick={() => hit("share")} className={btn("share")}>
            SHARE before it gets deleted!
          </button>
        </p>
      </article>

      <div aria-live="polite">
        <p className="font-mono text-xs uppercase tracking-[0.14em]">
          {found.length} of {FLAGS.length} flags found
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--ink)]/10" aria-hidden="true">
          <div className="h-full origin-left bg-[var(--flag)] transition-transform duration-500" style={{ transform: `scaleX(${found.length / FLAGS.length})` }} />
        </div>
        {open ? (
          <div key={open} className="step mt-6 rounded-xl border-2 border-[var(--flag)] p-5" style={{ "--n": 0 } as React.CSSProperties}>
            <p className="display text-2xl font-semibold">{flag(open).label}</p>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">{flag(open).tip}</p>
          </div>
        ) : (
          <p className="mt-6 text-zinc-700 dark:text-zinc-300">Tap anything in the post that looks off.</p>
        )}
        {found.length === FLAGS.length && (
          <p className="step mt-5 font-medium" style={{ "--n": 0 } as React.CSSProperties}>
            All five. Now paste the real thing into TruthLens.
          </p>
        )}
      </div>
    </div>
  );
}
