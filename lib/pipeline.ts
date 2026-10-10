import type {
  BetaContentBlock,
  BetaMessage,
  BetaMessageParam,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { CheckProvider } from "./provider";
import type { ZodType } from "zod";
import {
  extractSystem,
  OPINION_SYSTEM,
  SUMMARY_SYSTEM,
  VERIFY_SYSTEM,
  extractUserPrompt,
  opinionUserPrompt,
  jsonRepairPrompt,
  summaryUserPrompt,
  verifyUserPrompt,
} from "./prompts";
import {
  collectRetrievedPages,
  finalText,
  type RetrievedPage,
  normalizeUrl,
  RefusalError,
  withJsonRetry,
  type MessagesClient,
} from "./llm";
import {
  ExtractedClaimsSchema,
  MAX_CLAIMS,
  MAX_OPINIONS,
  OpinionAssessmentOutputSchema,
  VerificationSchema,
  countVerdicts,
  type CheckInput,
  type ClaimResult,
  type ExtractedClaims,
  type NotCheckable,
  type OpinionResult,
  type PendingClaim,
  type Source,
  type StreamEvent,
  type Summary,
  type Verification,
} from "./schemas";

export const VERIFY_CONCURRENCY = 3;
const MAX_PAUSE_CONTINUATIONS = 3;

/** Settings shared by every model call. */
function baseParams(model: string) {
  return {
    model,
    // Server-side refusal fallback: if a safety classifier declines a request,
    // the API re-runs it on Anthropic's recommended fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
  } satisfies Partial<MessageCreateParamsNonStreaming>;
}

function checkStop(message: BetaMessage): void {
  if (message.stop_reason === "refusal") {
    throw new RefusalError(
      message.stop_details?.explanation ?? "The model declined to check this claim.",
    );
  }
}

// ---------------------------------------------------------------------------
// Step 1: extract claims
// ---------------------------------------------------------------------------

export async function extractClaims(
  client: MessagesClient,
  model: string,
  text: string,
  signal?: AbortSignal,
): Promise<ExtractedClaims> {
  const messages: BetaMessageParam[] = [{ role: "user", content: extractUserPrompt(text) }];

  const result = await withJsonRetry({
    schema: ExtractedClaimsSchema,
    attempt: async (previousError) => {
      if (previousError) {
        messages.push({ role: "user", content: jsonRepairPrompt(previousError) });
      }
      const response = await client.create(
        {
          ...baseParams(model),
          max_tokens: 16000,
          system: extractSystem(MAX_CLAIMS, MAX_OPINIONS),
          output_config: {
            effort: "low",
            format: betaZodOutputFormat(ExtractedClaimsSchema),
          },
          messages,
        },
        { signal },
      );
      checkStop(response);
      messages.push({ role: "assistant", content: response.content });
      return finalText(response.content);
    },
  });

  if (!result.ok) throw new Error(result.error);

  return {
    claims: dedupeClaims(result.value.claims),
    opinions: dedupeClaims(result.value.opinions),
    notCheckable: result.value.notCheckable,
  };
}

// ---------------------------------------------------------------------------
// Step 2: verify one claim with web search
// ---------------------------------------------------------------------------

/** Keep only sources that appear among the pages search actually retrieved. */
export function filterToRetrieved(
  modelSources: Verification["sources"],
  pages: RetrievedPage[],
): Source[] {
  const retrieved = new Map(pages.map((p) => [normalizeUrl(p.url), p] as const));
  const out: Source[] = [];
  const used = new Set<string>();
  for (const s of modelSources) {
    const key = normalizeUrl(s.url);
    const page = retrieved.get(key);
    if (!page || used.has(key)) continue;
    used.add(key);
    out.push({
      title: s.title || page.title,
      publisher: s.publisher ?? hostnameOf(page.url),
      url: page.url,
      date: s.date ?? page.pageAge,
    });
  }
  return out.slice(0, 5);
}

/** Anthropic: retrieved-only sources, falling back to inline search citations. */
export function reconcileSources(
  modelSources: Verification["sources"],
  content: BetaContentBlock[],
): Source[] {
  const pages = collectRetrievedPages(content);
  const retrieved = new Map(pages.map((p) => [normalizeUrl(p.url), p] as const));
  const out = filterToRetrieved(modelSources, pages);
  const used = new Set(out.map((s) => normalizeUrl(s.url)));

  // Fallback: if the model's list didn't match, use the pages it cited inline.
  if (out.length === 0) {
    for (const block of content) {
      if (block.type !== "text" || !block.citations) continue;
      for (const c of block.citations) {
        if (c.type !== "web_search_result_location") continue;
        const key = normalizeUrl(c.url);
        if (used.has(key)) continue;
        used.add(key);
        const page = retrieved.get(key);
        out.push({
          title: c.title ?? page?.title ?? c.url,
          publisher: hostnameOf(c.url),
          url: c.url,
          date: page?.pageAge ?? null,
        });
      }
    }
  }
  return out.slice(0, 5);
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Run one web-searching model turn (with pause continuations and a JSON repair
 * retry) and parse the final reply. Also returns every content block so the
 * caller can reconcile sources against the pages actually retrieved.
 */
async function researchJson<T>(
  client: MessagesClient,
  model: string,
  system: string,
  userPrompt: string,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<{ ok: true; value: T; content: BetaContentBlock[] } | { ok: false; error: string }> {
  const messages: BetaMessageParam[] = [{ role: "user", content: userPrompt }];
  const allContent: BetaContentBlock[] = [];

  const request = (): MessageCreateParamsNonStreaming => ({
    ...baseParams(model),
    max_tokens: 16000,
    system,
    output_config: { effort: "medium" },
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages,
  });

  const send = async (): Promise<BetaMessage> => {
    let response = await client.create(request(), { signal });
    // A long server-tool turn can pause; resume by sending it back as-is.
    for (let i = 0; response.stop_reason === "pause_turn" && i < MAX_PAUSE_CONTINUATIONS; i++) {
      messages.push({ role: "assistant", content: response.content });
      allContent.push(...response.content);
      response = await client.create(request(), { signal });
    }
    checkStop(response);
    messages.push({ role: "assistant", content: response.content });
    allContent.push(...response.content);
    return response;
  };

  const result = await withJsonRetry({
    schema,
    attempt: async (previousError) => {
      if (previousError) {
        messages.push({ role: "user", content: jsonRepairPrompt(previousError) });
      }
      const response = await send();
      return finalText(response.content);
    },
  });
  return result.ok ? { ok: true, value: result.value, content: allContent } : result;
}

export async function verifyClaim(
  client: MessagesClient,
  model: string,
  claim: PendingClaim,
  context: string,
  signal?: AbortSignal,
): Promise<ClaimResult> {
  try {
    const result = await researchJson(
      client,
      model,
      VERIFY_SYSTEM,
      verifyUserPrompt(claim.text, context),
      VerificationSchema,
      signal,
    );
    if (!result.ok) {
      return { id: claim.id, text: claim.text, status: "error", error: result.error };
    }

    const v = result.value;
    return {
      id: claim.id,
      text: claim.text,
      status: "done",
      verdict: v.verdict,
      confidence: v.confidence,
      explanation: v.explanation.trim(),
      sources: reconcileSources(v.sources, result.content),
    };
  } catch (err) {
    return { id: claim.id, text: claim.text, status: "error", error: describeError(err) };
  }
}

export async function assessOpinion(
  client: MessagesClient,
  model: string,
  opinion: PendingClaim,
  context: string,
  signal?: AbortSignal,
): Promise<OpinionResult> {
  try {
    const result = await researchJson(
      client,
      model,
      OPINION_SYSTEM,
      opinionUserPrompt(opinion.text, context),
      OpinionAssessmentOutputSchema,
      signal,
    );
    if (!result.ok) {
      return { id: opinion.id, text: opinion.text, status: "error", error: result.error };
    }

    const v = result.value;
    return {
      id: opinion.id,
      text: opinion.text,
      status: "done",
      assessment: v.assessment,
      confidence: v.confidence,
      explanation: v.explanation.trim(),
      supporting: v.supporting.slice(0, 3),
      opposing: v.opposing.slice(0, 3),
      sources: reconcileSources(v.sources, result.content),
    };
  } catch (err) {
    return { id: opinion.id, text: opinion.text, status: "error", error: describeError(err) };
  }
}

export function describeError(err: unknown): string {
  if (err instanceof RefusalError) return err.message;
  if (err instanceof Error && err.name === "AbortError") return "The check was cancelled.";
  if (err instanceof Error && "status" in err && typeof err.status === "number") {
    if (err.status === 429) return "The AI service is busy right now. Please try again shortly.";
    if (err.status === 401) return "The server's Anthropic API key is invalid.";
    if (err.status >= 500) return "The AI service had a temporary problem. Please try again.";
  }
  return "Something went wrong while checking this claim.";
}

// ---------------------------------------------------------------------------
// Step 3: overall summary
// ---------------------------------------------------------------------------

export function fallbackSummaryText(results: ClaimResult[], opinions: OpinionResult[] = []): string {
  const counts = countVerdicts(results);
  const done = results.length - counts.Error;
  const opinionNote = opinions.length
    ? ` ${opinions.length} opinion${opinions.length === 1 ? " was" : "s were"} also assessed.`
    : "";
  if (results.length === 0) return `No checkable factual claims were found in this text.${opinionNote}`;
  const supported = counts.True + counts["Mostly True"];
  const problems = counts.Misleading + counts["Mostly False"] + counts.False;
  return `Of ${results.length} checkable claim${results.length === 1 ? "" : "s"}, ${done} ${done === 1 ? "was" : "were"} checked: ${supported} rated true or mostly true, ${problems} rated misleading or false, and ${counts.Unverifiable} could not be verified.${opinionNote}`;
}

export async function summarize(
  client: MessagesClient,
  model: string,
  inputText: string,
  results: ClaimResult[],
  signal?: AbortSignal,
  opinions: OpinionResult[] = [],
): Promise<string> {
  const done = results.filter((r) => r.status === "done");
  const assessed = opinions.filter((o) => o.status === "done");
  if (done.length === 0 && assessed.length === 0) return fallbackSummaryText(results, opinions);
  try {
    const response = await client.create(
      {
        ...baseParams(model),
        max_tokens: 4000,
        system: SUMMARY_SYSTEM,
        output_config: { effort: "low" },
        messages: [
          {
            role: "user",
            content: summaryUserPrompt(
              inputText,
              done.map((r) => ({ claim: r.text, verdict: r.verdict, explanation: r.explanation })),
              assessed.map((o) => ({ opinion: o.text, assessment: o.assessment, explanation: o.explanation })),
            ),
          },
        ],
      },
      { signal },
    );
    checkStop(response);
    const text = finalText(response.content).trim();
    return text || fallbackSummaryText(results, opinions);
  } catch {
    return fallbackSummaryText(results, opinions);
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

/** Map with at most `limit` promises in flight. Results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface CheckOutcome {
  claims: ClaimResult[];
  opinions: OpinionResult[];
  notCheckable: NotCheckable[];
  summary: Summary;
  notices: string[];
}

/** Claude (Anthropic API) implementation of the pipeline steps. */
export function anthropicProvider(client: MessagesClient, model: string): CheckProvider {
  return {
    name: "anthropic",
    maxClaims: MAX_CLAIMS,
    concurrency: VERIFY_CONCURRENCY,
    maxOpinions: MAX_OPINIONS,
    extractClaims: (text, signal) => extractClaims(client, model, text, signal),
    verifyClaim: (claim, context, signal) => verifyClaim(client, model, claim, context, signal),
    assessOpinion: (opinion, context, signal) => assessOpinion(client, model, opinion, context, signal),
    summarize: (inputText, results, signal, opinions) =>
      summarize(client, model, inputText, results, signal, opinions),
  };
}

/** Case-insensitive de-duplication of extracted claims. */
export function dedupeClaims(claims: ExtractedClaims["claims"]): ExtractedClaims["claims"] {
  const seen = new Set<string>();
  return claims.filter((c) => {
    const key = c.text.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runCheck(opts: {
  provider: CheckProvider;
  input: CheckInput;
  notices: string[];
  emit: (event: StreamEvent) => void;
  signal?: AbortSignal;
}): Promise<CheckOutcome> {
  const { provider, input, emit, signal } = opts;
  const notices = [...opts.notices];

  const extracted = await provider.extractClaims(input.text, signal);
  if (extracted.claims.length > provider.maxClaims) {
    notices.push(
      `The text contained many claims; only the ${provider.maxClaims} most significant were checked.`,
    );
  }
  const pending: PendingClaim[] = extracted.claims
    .slice(0, provider.maxClaims)
    .map((c, i) => ({ id: `c${i + 1}`, text: c.text }));

  const pendingOpinions: PendingClaim[] = (extracted.opinions ?? [])
    .slice(0, provider.maxOpinions)
    .map((o, i) => ({ id: `o${i + 1}`, text: o.text }));

  emit({
    type: "claims",
    claims: pending,
    opinions: pendingOpinions,
    notCheckable: extracted.notCheckable,
    notices,
  });

  // Facts and opinions share one worker pool so the concurrency cap holds.
  const claims: ClaimResult[] = new Array(pending.length);
  const opinions: OpinionResult[] = new Array(pendingOpinions.length);
  const tasks: (() => Promise<void>)[] = [
    ...pending.map((claim, i) => async () => {
      const result = await provider.verifyClaim(claim, input.text, signal);
      claims[i] = result;
      emit({ type: "claim", result });
    }),
    ...pendingOpinions.map((opinion, i) => async () => {
      const result = await provider.assessOpinion(opinion, input.text, signal);
      opinions[i] = result;
      emit({ type: "opinion", result });
    }),
  ];
  await mapWithConcurrency(tasks, provider.concurrency, (task) => task());

  const summary: Summary = {
    text: await provider.summarize(input.text, claims, signal, opinions),
    counts: countVerdicts(claims),
  };
  emit({ type: "summary", summary });

  return { claims, opinions, notCheckable: extracted.notCheckable, summary, notices };
}
