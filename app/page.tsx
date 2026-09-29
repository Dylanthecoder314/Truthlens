import { CheckRunner } from "@/components/check-runner";

const FEATURES = [
  { icon: "M4 6h16M4 12h10M4 18h7", label: "Finds every claim and opinion" },
  { icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4", label: "Researches the live web" },
  { icon: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1", label: "Links every source" },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <header className="space-y-5 text-center sm:pt-4">
        <p style={{ "--i": 0 } as React.CSSProperties} className="fade-up inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-medium text-indigo-800 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-200">
          <span aria-hidden="true" className="relative flex size-2"><span className="ping-soft absolute inset-0 rounded-full bg-emerald-500" /><span className="relative size-2 rounded-full bg-emerald-500" /></span>
          AI fact-checker with live web research
        </p>
        <h1 style={{ "--i": 1 } as React.CSSProperties} className="fade-up text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Check the facts,{" "}
          <span className="gradient-text">
            see the sources
          </span>
        </h1>
        <p style={{ "--i": 2 } as React.CSSProperties} className="fade-up mx-auto max-w-xl text-pretty text-lg text-zinc-600 dark:text-zinc-400">
          Paste a post, paragraph or article link. TruthLens pulls out each claim and opinion, researches it,
          and gives you a verdict (or a balanced view) you can verify yourself.
        </p>
        <ul className="flex flex-wrap justify-center gap-2 pt-1 text-sm text-zinc-700 dark:text-zinc-300">
          {FEATURES.map((f, i) => (
            <li key={f.label} style={{ "--i": 3 + i } as React.CSSProperties} className="fade-up lift flex items-center gap-2 rounded-full border border-zinc-200 bg-white/70 px-3.5 py-1.5 shadow-sm backdrop-blur hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-indigo-500/50">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={f.icon} />
              </svg>
              {f.label}
            </li>
          ))}
        </ul>
      </header>
      <div style={{ "--i": 6 } as React.CSSProperties} className="fade-up">
        <CheckRunner />
      </div>
    </div>
  );
}
