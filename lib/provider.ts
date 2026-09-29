import type { ClaimResult, ExtractedClaims, OpinionResult, PendingClaim } from "./schemas";

/** One LLM backend (Anthropic or Groq) able to run the three pipeline steps. */
export interface CheckProvider {
  name: "anthropic" | "groq";
  /** Most checkable claims researched per check. */
  maxClaims: number;
  /** Claims researched in parallel. */
  concurrency: number;
  /** Most opinions assessed per check. */
  maxOpinions: number;
  extractClaims(text: string, signal?: AbortSignal): Promise<ExtractedClaims>;
  verifyClaim(claim: PendingClaim, context: string, signal?: AbortSignal): Promise<ClaimResult>;
  assessOpinion(opinion: PendingClaim, context: string, signal?: AbortSignal): Promise<OpinionResult>;
  summarize(
    inputText: string,
    results: ClaimResult[],
    signal?: AbortSignal,
    opinions?: OpinionResult[],
  ): Promise<string>;
}
