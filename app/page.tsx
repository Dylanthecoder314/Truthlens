import Link from "next/link";
import { CheckRunner } from "@/components/check-runner";
import { ClaimDemo } from "@/components/claim-demo";
import { HeroLens } from "@/components/hero-lens";

const TICKER = [
  ["Humans only use 10% of their brains", "MYTH", false],
  ["Water boils at 100°C at sea level", "TRUE", true],
  ["Lightning never strikes the same place twice", "FALSE", false],
  ["The Great Wall is visible from space", "MOSTLY FALSE", false],
  ["Mount Everest grows a few millimetres a year", "TRUE", true],
  ["We swallow eight spiders a year in our sleep", "MYTH", false],
] as const;

const HOPS = [
  { who: "The source", text: "City council approves a pilot letting some staff trial four-day weeks.", fid: 1, blur: 0 },
  { who: "A screenshot", text: "City council approves four-day weeks for staff.", fid: 0.68, blur: 1, s: "30%", e: "38%" },
  { who: "A forward", text: "Council is cutting the work week to four days.", fid: 0.4, blur: 2, s: "44%", e: "52%" },
  { who: "“Saw it somewhere”", text: "They are cancelling Fridays.", fid: 0.14, blur: 3, s: "58%", e: "66%" },
] as const;

const HABITS = [
  ["Stop", "Notice the pull to react. The claims built to travel fastest are the ones designed to make you feel something first."],
  ["Investigate the source", "Who is saying it, and how would they know? Take thirty seconds to look them up before you weigh their claim."],
  ["Find better coverage", "Does anyone with a reputation to lose report the same thing? If not, that silence is information."],
  ["Trace it to the original", "Follow the quote, the photo or the number back to where it began. Context is what gets lost first."],
] as const;

const words = (s: string, from = 0) =>
  s.split(" ").map((w, i) => (
    <span key={w + i} className="word-in" style={{ "--w": from + i } as React.CSSProperties}>
      {w}
    </span>
  ));

export default function Home() {
  return (
    <div className="lp bg-[var(--paper)] text-[var(--ink)]">
      <div aria-hidden="true" className="progress" />

      <main id="main">
        {/* Hero: ghost glyphs, headline and lens sit on separate planes that move at different speeds. */}
        <HeroLens className="relative flex min-h-[calc(100svh-3.5rem)] flex-col justify-center overflow-hidden px-5 py-20 sm:px-10">
          <div aria-hidden="true" className="plx-a ghost -right-6 top-6 text-[38vw]">?</div>
          <div aria-hidden="true" className="plx-c ghost bottom-10 left-[-2vw] text-[16vw]">TRUE?</div>

          <div className="plx-b relative mx-auto w-full max-w-5xl">
            <div className="lens" aria-hidden="true">
              <span className="lens-chip">Source?</span>
              <span className="lens-chip">Date?</span>
              <span className="lens-chip">Context?</span>
            </div>
            <h1 className="display relative text-[clamp(2.8rem,7.6vw,6.75rem)] font-semibold leading-[0.95]">
              {words("The internet says a lot.")}
              <br />
              <span className="word-in" style={{ "--w": 5 } as React.CSSProperties}>Some of it is</span>
              <span className="hero-word italic">
                <span className="word-in" style={{ "--w": 7 } as React.CSSProperties}>made up.</span>
                <svg viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M4 14 C 40 4, 70 22, 110 12 S 190 6, 220 14 S 280 8, 296 12" />
                </svg>
              </span>
              <span className="stamp ml-4 align-middle" aria-hidden="true">UNVERIFIED</span>
            </h1>
            <p className="word-in mt-10 max-w-xl text-lg text-zinc-700 dark:text-zinc-300 sm:text-xl" style={{ "--w": 11 } as React.CSSProperties}>
              Paste a post, a paragraph or a link. TruthLens pulls out each claim, researches it on the live web,
              and shows you a verdict with the sources behind it.
            </p>
            <div className="word-in mt-8 flex flex-wrap items-center gap-4" style={{ "--w": 13 } as React.CSSProperties}>
              <a
                href="#check"
                className="rounded-full bg-[var(--ink)] px-7 py-3.5 font-medium text-[var(--paper)] transition-transform hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Check a claim
              </a>
              <a href="#chain" className="whitespace-nowrap rounded-full px-3 py-3.5 font-medium underline underline-offset-4 hover:text-[var(--flag)]">
                How claims drift
              </a>
            </div>
          </div>
        </HeroLens>

        {/* Ticker */}
        <section aria-label="Examples of claims we have all heard" className="border-y-2 border-[var(--ink)] py-4 overflow-hidden">
          <div className="ticker" aria-hidden="true">
            {[0, 1].map((k) => (
              <div key={k} className="flex shrink-0 items-center gap-10 pr-10">
                {TICKER.map(([t, v, ok]) => (
                  <span key={t + k} className="flex items-center gap-3 whitespace-nowrap font-display text-xl sm:text-2xl display">
                    {t}
                    <span className={`tag ${ok ? "tag-ok" : "tag-bad"}`}>{v}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
          <ul className="sr-only">
            {TICKER.map(([t, v]) => (
              <li key={t}>{t}: {v}</li>
            ))}
          </ul>
        </section>

        {/* Dissect */}
        <section className="mx-auto max-w-6xl px-5 py-28 sm:px-10">
          <h2 className="reveal display max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            Every claim, taken apart.
          </h2>
          <p className="reveal mt-5 max-w-xl text-lg text-zinc-700 dark:text-zinc-300">
            Pick a sentence. This is the path each one takes: found, tested against evidence, then judged.
          </p>
          <div className="reveal mt-14">
            <ClaimDemo />
          </div>
        </section>

        {/* Chain (the peak): scroll drives one message through four retellings. */}
        <section id="chain" className="chain" aria-labelledby="chain-h">
          <div className="chain-stage">
            <div className="mx-auto w-full max-w-6xl px-5 sm:px-10">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#ff6a4d]">An illustration</p>
              <h2 id="chain-h" className="display mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
                Nobody lies once. It gets a little worse with every share.
              </h2>
              <div className="wire mt-12 hidden lg:block" aria-hidden="true" />
              <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {HOPS.map((h, i) => (
                  <li
                    key={h.who}
                    className={`hop ${i > 0 ? "hop-later" : ""} rounded-xl border border-[#f1ece0]/25 p-5`}
                    style={{ "--fade": h.blur, "--s": "s" in h ? h.s : "0%", "--e": "e" in h ? h.e : "1%" } as React.CSSProperties}
                  >
                    <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#f1ece0]/70">{h.who}</p>
                    <p className="display mt-3 min-h-[6.5rem] text-xl leading-snug">{h.text}</p>
                    <div className="hop-fid mt-4" role="img" aria-label={`Fidelity to the source, illustrative: ${Math.round(h.fid * 100)} percent`}>
                      <i style={{ "--to": h.fid } as React.CSSProperties} />
                    </div>
                    <p className="mt-2 font-mono text-[0.65rem] uppercase tracking-[0.14em] text-[#f1ece0]/60">Fidelity to source</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Habits */}
        <section className="mx-auto max-w-6xl px-5 py-28 sm:px-10">
          <h2 className="reveal display max-w-3xl text-4xl font-semibold leading-tight sm:text-6xl">
            Four habits that beat most fakes.
          </h2>
          <ol className="mt-16 grid gap-x-10 gap-y-14 sm:grid-cols-2">
            {HABITS.map(([t, b], i) => (
              <li key={t} className="habit reveal pt-5">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-400">Habit {i + 1}</p>
                <h3 className="display mt-2 text-3xl font-semibold">{t}</h3>
                <p className="mt-3 max-w-md text-zinc-700 dark:text-zinc-300">{b}</p>
              </li>
            ))}
          </ol>
          <p className="reveal mt-14 max-w-xl text-zinc-700 dark:text-zinc-300">
            The last two are the slow part. That is where TruthLens does the legwork, and{" "}
            <Link href="/how-it-works" className="font-medium underline underline-offset-4 hover:text-[var(--flag)]">
              shows you exactly how
            </Link>
            .
          </p>
        </section>

        {/* Close: the product itself */}
        <section id="check" className="scroll-mt-16 border-t-2 border-[var(--ink)] px-5 py-28 sm:px-10">
          <div className="mx-auto max-w-3xl">
            <h2 className="reveal display text-5xl font-semibold leading-[1.02] sm:text-7xl">
              Got something you are not sure about?
            </h2>
            <p className="reveal mt-5 text-lg text-zinc-700 dark:text-zinc-300">
              Paste it below. Read the sources before you share it.
            </p>
            <div className="mt-10">
              <CheckRunner />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
