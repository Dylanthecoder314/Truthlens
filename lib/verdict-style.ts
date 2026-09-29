import type { OpinionAssessment, Verdict } from "./schemas";

export type VerdictOrError = Verdict | "Error";

interface VerdictStyle {
  /** Badge colours: meet WCAG AA contrast in both themes. */
  badge: string;
  /** Solid colour for the confidence bar, card accent and summary dots. */
  bar: string;
  /** Tinted card background wash. */
  wash: string;
  /** Short symbol so meaning is not conveyed by colour alone. */
  icon: string;
  description: string;
}

export const VERDICT_STYLES: Record<VerdictOrError, VerdictStyle> = {
  True: {
    badge: "bg-emerald-100 text-emerald-900 ring-emerald-600/30 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-400/30",
    bar: "bg-emerald-600 dark:bg-emerald-400",
    wash: "from-emerald-50/70 dark:from-emerald-950/25",
    icon: "✓",
    description: "Accurate, nothing significant missing.",
  },
  "Mostly True": {
    badge: "bg-lime-100 text-lime-900 ring-lime-600/30 dark:bg-lime-950 dark:text-lime-200 dark:ring-lime-400/30",
    bar: "bg-lime-600 dark:bg-lime-400",
    wash: "from-lime-50/70 dark:from-lime-950/25",
    icon: "≈",
    description: "Accurate but needs clarification.",
  },
  Misleading: {
    badge: "bg-amber-100 text-amber-900 ring-amber-600/30 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-400/30",
    bar: "bg-amber-500 dark:bg-amber-400",
    wash: "from-amber-50/70 dark:from-amber-950/25",
    icon: "!",
    description: "Contains truth but gives a false impression.",
  },
  "Mostly False": {
    badge: "bg-orange-100 text-orange-900 ring-orange-600/30 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-400/30",
    bar: "bg-orange-600 dark:bg-orange-400",
    wash: "from-orange-50/70 dark:from-orange-950/25",
    icon: "✕",
    description: "An element of truth, but the core claim is wrong.",
  },
  False: {
    badge: "bg-red-100 text-red-900 ring-red-600/30 dark:bg-red-950 dark:text-red-200 dark:ring-red-400/30",
    bar: "bg-red-600 dark:bg-red-400",
    wash: "from-red-50/70 dark:from-red-950/25",
    icon: "✕",
    description: "The core claim is wrong.",
  },
  Unverifiable: {
    badge: "bg-slate-200 text-slate-800 ring-slate-500/30 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-400/30",
    bar: "bg-slate-500 dark:bg-slate-400",
    wash: "from-slate-100/70 dark:from-slate-800/25",
    icon: "?",
    description: "Not enough reliable evidence either way.",
  },
  Error: {
    badge: "bg-zinc-100 text-zinc-800 ring-zinc-500/40 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-400/30",
    bar: "bg-zinc-400",
    wash: "from-zinc-100/70 dark:from-zinc-800/25",
    icon: "⚠",
    description: "This claim couldn't be checked.",
  },
};

export const VERDICT_ORDER: VerdictOrError[] = [
  "True",
  "Mostly True",
  "Misleading",
  "Mostly False",
  "False",
  "Unverifiable",
  "Error",
];

interface OpinionStyle {
  badge: string;
  bar: string;
  wash: string;
  icon: string;
  description: string;
}

export const OPINION_STYLES: Record<OpinionAssessment, OpinionStyle> = {
  "Well Supported": {
    badge: "bg-teal-100 text-teal-900 ring-teal-600/30 dark:bg-teal-950 dark:text-teal-200 dark:ring-teal-400/30",
    bar: "bg-teal-600 dark:bg-teal-400",
    wash: "from-teal-50/70 dark:from-teal-950/25",
    icon: "▲",
    description: "Evidence and informed opinion mostly back this view.",
  },
  Contested: {
    badge: "bg-violet-100 text-violet-900 ring-violet-600/30 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-400/30",
    bar: "bg-violet-600 dark:bg-violet-400",
    wash: "from-violet-50/70 dark:from-violet-950/25",
    icon: "⇄",
    description: "Credible evidence and informed views exist on both sides.",
  },
  "Poorly Supported": {
    badge: "bg-rose-100 text-rose-900 ring-rose-600/30 dark:bg-rose-950 dark:text-rose-200 dark:ring-rose-400/30",
    bar: "bg-rose-600 dark:bg-rose-400",
    wash: "from-rose-50/70 dark:from-rose-950/25",
    icon: "▼",
    description: "Evidence and informed opinion mostly run against this view.",
  },
  "Purely Subjective": {
    badge: "bg-sky-100 text-sky-900 ring-sky-600/30 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-400/30",
    bar: "bg-sky-600 dark:bg-sky-400",
    wash: "from-sky-50/70 dark:from-sky-950/25",
    icon: "◐",
    description: "A matter of taste or values; evidence can't settle it.",
  },
};
