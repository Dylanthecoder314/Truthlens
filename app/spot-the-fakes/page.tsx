import type { Metadata } from "next";
import Link from "next/link";
import { FlagHunt } from "@/components/flag-hunt";

export const metadata: Metadata = {
  title: "How to spot fake and misleading content",
  description: "The main kinds of misinformation, the red flags that give them away, and quick checks you can run in a minute.",
};

const KINDS = [
  ["Fabricated", "Made up from nothing: a fake quote, a fake study, an invented event. Look for no original source and no other outlet reporting it."],
  ["Out of context", "Real photo, video or quote, wrong story. An old flood photo captioned as yesterday's. The material is genuine; the framing is the lie."],
  ["Misleading headline", "The headline promises more than the article delivers. Many people share after reading only the headline, so read the piece."],
  ["Doctored or AI-made media", "Edited photos, cloned voices and generated images. Look for warped hands and text, odd lighting, and no trace of an original source."],
  ["Cherry-picked numbers", "True figures that leave out the baseline, the time frame or the denominator. A chart with a cut-off axis makes small changes look huge."],
  ["Impersonation", "Lookalike accounts, fake press releases and spoofed websites that borrow a trusted name. Check the handle and the web address, not the logo."],
  ["Satire taken as news", "Jokes that lose their label when shared. If a story seems too perfect, check whether the site says it is a parody."],
  ["Old news, new panic", "A real story from years ago recirculated as if it just happened. Check the date."],
] as const;

const TESTS = [
  ["Reverse-image search", "Right-click an image and search for it, or upload it to a reverse image search. Earlier appearances often reveal the true date and place."],
  ["Read sideways", "Leave the page. Open a new tab and search for who is behind it and what others say about them, instead of reading their own about page."],
  ["Find the original", "Follow quotes, statistics and screenshots back to the study, transcript or full video. Summaries lose context."],
  ["Check the address", "Look closely at the web address. Small swaps such as an extra word or a different ending are a common trick."],
  ["Check the date", "Find when it was first published. Recycled stories often still carry a fresh-looking timestamp."],
  ["Ask what is missing", "Who benefits if you believe it? What would you expect to see if it were true, and is it there?"],
] as const;

const FLAGS = [
  "It makes you angry or afraid within a few seconds.",
  "It asks you to share urgently, or says someone is hiding it.",
  "There is no named author, date or source.",
  "The claim is very surprising and only one place reports it.",
  "It agrees perfectly with what you already believe. Check those hardest.",
  "The evidence is a screenshot, not a link.",
] as const;

export default function SpotTheFakes() {
  return (
    <div className="lp bg-[var(--paper)] text-[var(--ink)]">
      <div aria-hidden="true" className="progress" />
      <main id="main">
        <section className="relative overflow-hidden px-5 py-24 sm:px-10 sm:py-32">
          <div aria-hidden="true" className="plx-a ghost -right-4 top-2 text-[34vw]">!</div>
          <div className="relative mx-auto max-w-5xl">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--flag)]">Field guide</p>
            <h1 className="display mt-4 text-[clamp(2.6rem,7vw,6rem)] font-semibold leading-[0.98]">
              <span className="word-in" style={{ "--w": 0 } as React.CSSProperties}>How to spot</span>
              <br />
              <span className="word-in" style={{ "--w": 2 } as React.CSSProperties}>fake and</span>
              <span className="hero-word italic">
                <span className="word-in" style={{ "--w": 4 } as React.CSSProperties}>misleading</span>
                <svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M4 14 C 40 4, 70 22, 110 12 S 190 6, 220 14 S 280 8, 296 12" />
                </svg>
              </span>
              <span className="word-in" style={{ "--w": 5 } as React.CSSProperties}>things.</span>
            </h1>
            <p className="word-in mt-10 max-w-xl text-lg text-zinc-700 dark:text-zinc-300 sm:text-xl" style={{ "--w": 7 } as React.CSSProperties}>
              Most misinformation is not one big lie. It is a true fragment in the wrong place, or a small
              stretch nobody checked. Here are the shapes it takes, and the checks that catch it.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-10">
          <h2 className="reveal display max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">Try it: hunt the red flags.</h2>
          <div className="reveal mt-10">
            <FlagHunt />
          </div>
        </section>

        <section className="border-y-2 border-[var(--ink)] px-5 py-24 sm:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="reveal display max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">Eight shapes misinformation takes.</h2>
            <ol className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
              {KINDS.map(([t, b], i) => (
                <li key={t} className="habit reveal pt-5">
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-400">Type {i + 1}</p>
                  <h3 className="display mt-2 text-2xl font-semibold sm:text-3xl">{t}</h3>
                  <p className="mt-3 max-w-md text-zinc-700 dark:text-zinc-300">{b}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="chain" style={{ height: "auto", background: "#14130f" }}>
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-10">
            <h2 className="reveal display max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Six red flags. Two is enough to pause.
            </h2>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2">
              {FLAGS.map((f, i) => (
                <li key={f} className="reveal flex gap-4 rounded-xl border border-[#f1ece0]/25 p-5">
                  <span className="font-mono text-sm text-[#ff6a4d]">{String(i + 1).padStart(2, "0")}</span>
                  <span className="display text-xl leading-snug">{f}</span>
                </li>
              ))}
            </ul>
            <p className="reveal mt-10 max-w-xl text-[#f1ece0]/75">
              A flag does not prove something is false. It tells you to check before you believe or share.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-24 sm:px-10">
          <h2 className="reveal display max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">Six checks you can do in a minute.</h2>
          <ol className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {TESTS.map(([t, b], i) => (
              <li key={t} className="habit reveal pt-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-400">Check {i + 1}</p>
                <h3 className="display mt-2 text-2xl font-semibold">{t}</h3>
                <p className="mt-3 text-zinc-700 dark:text-zinc-300">{b}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t-2 border-[var(--ink)] px-5 py-24 sm:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="reveal display text-4xl font-semibold leading-[1.05] sm:text-6xl">Still not sure? Let us do the digging.</h2>
            <p className="reveal mx-auto mt-5 max-w-xl text-lg text-zinc-700 dark:text-zinc-300">
              TruthLens researches each claim and shows the sources. AI can be wrong, so read them yourself.
            </p>
            <div className="reveal mt-8 flex flex-wrap justify-center gap-4">
              <Link href="/#check" className="rounded-full bg-[var(--ink)] px-7 py-3.5 font-medium text-[var(--paper)] transition-transform hover:-translate-y-0.5">
                Check a claim
              </Link>
              <Link href="/how-it-works" className="whitespace-nowrap px-3 py-3.5 font-medium underline underline-offset-4 hover:text-[var(--flag)]">
                How TruthLens works
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
