"use client";

import Link from "next/link";
import { useState } from "react";

const CARDS = [
  { s: "Humans only use 10% of their brains.", fact: false, why: "Imaging shows activity across the whole brain over a day, including during sleep." },
  { s: "Honey can last practically forever if it is stored properly.", fact: true, why: "Its low water content and acidity make it very hard for microbes to grow." },
  { s: "Lightning never strikes the same place twice.", fact: false, why: "Tall structures such as skyscrapers are struck many times a year." },
  { s: "Octopuses have three hearts.", fact: true, why: "Two pump blood through the gills and one pumps it to the rest of the body." },
  { s: "Goldfish only remember things for three seconds.", fact: false, why: "Experiments show goldfish can learn tasks and remember them for months." },
  { s: "Botanically, a banana is a berry.", fact: true, why: "By the botanical definition, bananas qualify as berries, and strawberries do not." },
  { s: "Cracking your knuckles gives you arthritis.", fact: false, why: "Studies have not found a link between knuckle cracking and arthritis." },
  { s: "Bats are blind.", fact: false, why: "All bat species can see. Many also use echolocation to hunt in the dark." },
] as const;

const COLORS = ["var(--flag)", "var(--ok)", "var(--ink)", "#c98a1b"];

function rank(score: number) {
  const r = score / CARDS.length;
  if (r === 1) return "Lens-eyed. Nothing got past you.";
  if (r >= 0.75) return "Sharp. You question the right things.";
  if (r >= 0.5) return "Decent instincts. A few myths slipped through.";
  return "Myths are sticky. That is why we check.";
}

export function Quiz() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const done = i >= CARDS.length;
  const card = CARDS[Math.min(i, CARDS.length - 1)];
  const right = picked !== null && picked === card.fact;

  function answer(v: boolean) {
    if (picked !== null) return;
    setPicked(v);
    if (v === card.fact) {
      setScore((s) => s + 1);
      setStreak((s) => {
        setBest((b) => Math.max(b, s + 1));
        return s + 1;
      });
    } else setStreak(0);
  }
  function next() {
    setPicked(null);
    setI((n) => n + 1);
  }
  function restart() {
    setI(0);
    setPicked(null);
    setScore(0);
    setStreak(0);
    setBest(0);
  }

  if (done) {
    return (
      <div className="card-in mx-auto max-w-xl rounded-2xl border-2 border-[var(--ink)] p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em]">Final score</p>
        <p className="display mt-2 text-7xl font-semibold">{score}<span className="text-3xl opacity-60"> / {CARDS.length}</span></p>
        <p className="display mt-4 text-2xl">{rank(score)}</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Best streak: {best}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={restart} className="rounded-full border-2 border-[var(--ink)] px-6 py-3 font-medium hover:bg-[var(--ink)] hover:text-[var(--paper)]">Play again</button>
          <Link href="/#check" className="rounded-full bg-[var(--ink)] px-6 py-3 font-medium text-[var(--paper)]">Check a real claim</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.14em]">
        <span>Card {i + 1} of {CARDS.length}</span>
        <span aria-live="polite">Streak {streak}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ink)]/10" aria-hidden="true">
        <div className="h-full origin-left bg-[var(--ink)] transition-transform duration-500" style={{ transform: `scaleX(${(i + (picked !== null ? 1 : 0)) / CARDS.length})` }} />
      </div>

      <div key={i} className={`card-in relative mt-6 rounded-2xl border-2 border-[var(--ink)] p-7 sm:p-9 ${picked !== null && !right ? "shake" : ""}`}>
        {right &&
          Array.from({ length: 16 }, (_, k) => {
            const a = (k / 16) * Math.PI * 2;
            return (
              <span
                key={k}
                aria-hidden="true"
                className="confetti"
                style={{ background: COLORS[k % 4], "--dx": `${Math.cos(a) * (90 + (k % 3) * 30)}px`, "--dy": `${Math.sin(a) * (90 + (k % 3) * 30)}px`, "--r": `${k * 47}deg` } as React.CSSProperties}
              />
            );
          })}
        <p className="display text-3xl leading-snug sm:text-4xl">{card.s}</p>
        {picked === null ? (
          <div className="mt-8 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => answer(true)} className="rounded-xl border-2 border-[var(--ok)] px-4 py-3.5 font-semibold text-[var(--ok)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--ok)] hover:text-[var(--paper)]">Fact</button>
            <button type="button" onClick={() => answer(false)} className="rounded-xl border-2 border-[var(--flag)] px-4 py-3.5 font-semibold text-[var(--flag)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--flag)] hover:text-[var(--paper)]">Fiction</button>
          </div>
        ) : (
          <div className="step mt-8" style={{ "--n": 0 } as React.CSSProperties} role="status">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: right ? "var(--ok)" : "var(--flag)" }}>
              {right ? "Correct" : "Not quite"}: it is {card.fact ? "a fact" : "a myth"}
            </p>
            <p className="mt-2 text-zinc-700 dark:text-zinc-300">{card.why}</p>
            <button type="button" onClick={next} autoFocus className="mt-6 rounded-full bg-[var(--ink)] px-6 py-3 font-medium text-[var(--paper)]">
              {i + 1 === CARDS.length ? "See my score" : "Next card"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
