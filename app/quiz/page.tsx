import type { Metadata } from "next";
import { Quiz } from "@/components/quiz";

export const metadata: Metadata = {
  title: "Fact or Fiction",
  description: "Eight quick cards. Can you tell the facts from the myths?",
};

export default function QuizPage() {
  return (
    <div className="lp bg-[var(--paper)] text-[var(--ink)]">
      <main id="main" className="relative overflow-hidden px-5 py-20 sm:px-10 sm:py-28">
        <div aria-hidden="true" className="plx-a ghost -left-6 top-0 text-[36vw]">?</div>
        <div className="relative mx-auto max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--flag)]">Quick game</p>
          <h1 className="display mt-3 text-[clamp(2.6rem,7vw,5.5rem)] font-semibold leading-[0.98]">Fact or Fiction?</h1>
          <p className="mt-5 max-w-xl text-lg text-zinc-700 dark:text-zinc-300">
            Eight things you have probably heard. Some are true. Some are the kind of myth that spreads because it sounds right.
          </p>
          <div className="mt-12">
            <Quiz />
          </div>
        </div>
      </main>
    </div>
  );
}
