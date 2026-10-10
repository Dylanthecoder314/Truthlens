"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { CheckForm } from "./check-form";
import { CopyLinkButton } from "./copy-link-button";
import { Disclaimer } from "./disclaimer";
import { ResultsView } from "./results-view";
import { useCheckStream } from "./use-check-stream";

export function CheckRunner() {
  const { state, start } = useCheckStream();
  const resultsRef = useRef<HTMLDivElement>(null);
  const streaming = state.status === "streaming";
  const showResults = state.status !== "idle" && (state.input !== null || streaming);

  useEffect(() => {
    if (streaming) resultsRef.current?.focus({ preventScroll: false });
  }, [streaming]);

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <CheckForm busy={streaming} onSubmit={start} />
        {state.status === "idle" && <Disclaimer compact />}
      </div>

      {state.status === "error" && (
        <div
          role="alert"
          className="rise-in flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100"
        >
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-red-100 font-bold text-red-700 dark:bg-red-900/60 dark:text-red-200">!</span>
          <div>
            <p className="font-semibold">We couldn&apos;t finish that check</p>
            <p className="mt-0.5 text-sm">{state.error}</p>
          </div>
        </div>
      )}

      {showResults && (
        <div
          ref={resultsRef}
          tabIndex={-1}
          aria-label="Fact-check results"
          className="space-y-6 outline-none"
        >
          {state.status === "done" && state.id && (
            <div className="rise-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/30">
              <p className="flex items-center gap-2 text-sm text-emerald-950 dark:text-emerald-100">
                <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-emerald-600 text-xs text-white">✓</span>
                Check complete and saved.{" "}
                <Link href={`/check/${state.id}`} className="font-medium underline underline-offset-2">
                  Open permalink
                </Link>
              </p>
              <CopyLinkButton path={`/check/${state.id}`} />
            </div>
          )}
          <ResultsView
            input={state.input}
            claims={state.claims}
            claimsKnown={state.claimsKnown}
            results={state.results}
            opinions={state.opinions}
            opinionResults={state.opinionResults}
            notCheckable={state.notCheckable}
            summary={state.summary}
            notices={state.notices}
            streaming={streaming}
          />
          {!streaming && <Disclaimer />}
        </div>
      )}
    </div>
  );
}
