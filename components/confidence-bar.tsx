import { VERDICT_STYLES, type VerdictOrError } from "@/lib/verdict-style";

export function ConfidenceBar({
  value,
  verdict,
  barClass,
}: {
  value: number;
  verdict?: VerdictOrError;
  /** Colour override (opinion cards). */
  barClass?: string;
}) {
  const label = value >= 80 ? "High" : value >= 55 ? "Moderate" : "Low";
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="shrink-0 font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Confidence
      </span>
      <div
        role="meter"
        aria-label="Confidence"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} out of 100 (${label.toLowerCase()})`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800"
      >
        <div
          className={`grow-x h-full rounded-full ${barClass ?? (verdict ? VERDICT_STYLES[verdict].bar : "bg-zinc-400")}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="shrink-0 tabular-nums text-zinc-700 dark:text-zinc-300">
        <span className="font-semibold">{value}%</span> · {label}
      </span>
    </div>
  );
}
