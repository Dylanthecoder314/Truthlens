/**
 * A magnifying lens over a red question mark. Hovering or focusing the parent
 * `.group` (the header link) swaps the question mark for a drawn-in check:
 * the claim, examined, becomes a verdict.
 */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={`overflow-visible ${className}`}>
      <g className="text-zinc-900 dark:text-zinc-50">
        <path d="M20.4 20.4 27.2 27.2" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
        <circle
          cx="13.5"
          cy="13.5"
          r="9.4"
          stroke="currentColor"
          strokeWidth="2.8"
          className="fill-zinc-50/80 dark:fill-zinc-900/80"
        />
        <path d="M8.2 11.4a5.8 5.8 0 0 1 3.3-3.4" stroke="#fff" strokeOpacity=".9" strokeWidth="1.4" strokeLinecap="round" fill="none" className="dark:[stroke-opacity:.35]" />
      </g>
      <g className="origin-center text-[#c2331a] transition duration-300 [transform-box:fill-box] group-hover:scale-50 group-hover:rotate-45 group-hover:opacity-0 group-focus-visible:scale-50 group-focus-visible:opacity-0 dark:text-[#ff6a4d]">
        <path
          d="M10.8 11.1a2.75 2.75 0 1 1 4 2.45c-.8.42-1.3 1-1.3 1.9v.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="13.5" cy="18.5" r="1.3" fill="currentColor" />
      </g>
      <path
        d="M9.3 13.9l2.8 2.8 5.7-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="14"
        strokeDashoffset="14"
        className="text-[#0e6a5f] transition-[stroke-dashoffset] delay-100 duration-300 ease-out group-hover:[stroke-dashoffset:0] group-focus-visible:[stroke-dashoffset:0] dark:text-[#4fc3b0]"
      />
    </svg>
  );
}
