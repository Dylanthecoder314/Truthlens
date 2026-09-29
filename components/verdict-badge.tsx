import { VERDICT_STYLES, type VerdictOrError } from "@/lib/verdict-style";

export function VerdictBadge({ verdict, size = "md" }: { verdict: VerdictOrError; size?: "sm" | "md" }) {
  const style = VERDICT_STYLES[verdict];
  return (
    <span
      title={style.description}
      className={`pop inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset ${style.badge} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      }`}
    >
      <span aria-hidden="true" className="font-bold">{style.icon}</span>
      {verdict === "Error" ? "Couldn't check" : verdict}
    </span>
  );
}
