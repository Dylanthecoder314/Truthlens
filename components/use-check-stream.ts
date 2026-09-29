"use client";

import { useCallback, useRef, useState } from "react";
import { parseSseBuffer } from "@/lib/sse";
import {
  ApiErrorSchema,
  type CheckInput,
  type ClaimResult,
  type NotCheckable,
  type OpinionResult,
  type PendingClaim,
  type StreamEvent,
  type Summary,
} from "@/lib/schemas";

export type CheckStatus = "idle" | "streaming" | "done" | "error";

export interface CheckState {
  status: CheckStatus;
  input: CheckInput | null;
  claims: PendingClaim[];
  claimsKnown: boolean;
  results: Record<string, ClaimResult>;
  opinions: PendingClaim[];
  opinionResults: Record<string, OpinionResult>;
  notCheckable: NotCheckable[];
  summary: Summary | null;
  notices: string[];
  id: string | null;
  error: string | null;
}

const initial: CheckState = {
  status: "idle",
  input: null,
  claims: [],
  claimsKnown: false,
  results: {},
  opinions: [],
  opinionResults: {},
  notCheckable: [],
  summary: null,
  notices: [],
  id: null,
  error: null,
};

function reduce(state: CheckState, event: StreamEvent): CheckState {
  switch (event.type) {
    case "meta":
      return { ...state, input: event.input, notices: event.notices };
    case "claims":
      return {
        ...state,
        claims: event.claims,
        claimsKnown: true,
        opinions: event.opinions,
        notCheckable: event.notCheckable,
        notices: event.notices,
      };
    case "claim":
      return { ...state, results: { ...state.results, [event.result.id]: event.result } };
    case "opinion":
      return { ...state, opinionResults: { ...state.opinionResults, [event.result.id]: event.result } };
    case "summary":
      return { ...state, summary: event.summary };
    case "done":
      return { ...state, status: "done", id: event.id };
    case "error":
      return { ...state, status: "error", error: event.message };
  }
}

const FRIENDLY_STATUS: Record<number, string> = {
  429: "You've hit the hourly limit for checks. Please try again later.",
  500: "The fact-checking service had a problem. Please try again.",
  502: "The fact-checking service is temporarily unavailable. Please try again.",
  504: "The request timed out. Please try again with shorter text.",
};

export function useCheckStream() {
  const [state, setState] = useState<CheckState>(initial);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (body: { text: string } | { url: string }) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ ...initial, status: "streaming" });

    let res: Response;
    try {
      res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) return;
      setState({ ...initial, status: "error", error: "Couldn't reach the server. Check your connection and try again." });
      return;
    }

    if (!res.ok || !res.body) {
      let message = FRIENDLY_STATUS[res.status] ?? "Something went wrong. Please try again.";
      try {
        const parsed = ApiErrorSchema.safeParse(await res.json());
        if (parsed.success) message = parsed.data.error.message;
      } catch {
        // non-JSON error body
      }
      setState({ ...initial, status: "error", error: message });
      return;
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    let finished = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const { events, rest } = parseSseBuffer(buffer);
        buffer = rest;
        for (const event of events) {
          if (event.type === "done" || event.type === "error") finished = true;
          setState((s) => reduce(s, event));
        }
      }
    } catch {
      if (controller.signal.aborted) return;
    }
    if (!finished && !controller.signal.aborted) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "The connection closed before the check finished. Please try again.",
      }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(initial);
  }, []);

  return { state, start, reset };
}
