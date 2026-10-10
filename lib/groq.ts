import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "groq-sdk/resources/chat/completions";
import {
  EXTRACT_JSON_SHAPE,
  OPINION_SYSTEM,
  SUMMARY_SYSTEM,
  VERIFY_SYSTEM,
  extractSystem,
  extractUserPrompt,
  jsonRepairPrompt,
  opinionUserPrompt,
  summaryUserPrompt,
  verifyUserPrompt,
} from "./prompts";
import { withJsonRetry, type RetrievedPage } from "./llm";
import {
  dedupeClaims,
  describeError,
  fallbackSummaryText,
  filterToRetrieved,
} from "./pipeline";
import type { CheckProvider } from "./provider";
import type { ZodType } from "zod";
import {
  ExtractedClaimsSchema,
  OpinionAssessmentOutputSchema,
  VerificationSchema,
  type ClaimResult,
  type OpinionResult,
} from "./schemas";

/**
 * Groq's free tier allows ~8,000 tokens/minute and a single browser-search call
 * can use far more, so claims are researched one at a time and capped at 5.
 */
export const GROQ_MAX_CLAIMS = 5;
export const GROQ_CONCURRENCY = 1;
export const GROQ_MAX_OPINIONS = 2;

/** The slice of the Groq SDK the pipeline uses (lets tests inject a fake). */
export interface GroqChatClient {
  create(
    body: ChatCompletionCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): PromiseLike<ChatCompletion>;
}

/** Remove browser-search citation markers such as 【1†L41-L42】. */
export function stripCitationMarkers(text: string): string {
  return text.replace(/【[^】]*】/g, "").replace(/[ \t]{2,}/g, " ");
}

/** Every page Groq's browser search listed or opened during a response. */
export function collectGroqPages(completion: ChatCompletion): RetrievedPage[] {
  const pages: RetrievedPage[] = [];
  for (const choice of completion.choices) {
    for (const tool of choice.message.executed_tools ?? []) {
      for (const r of tool.search_results?.results ?? []) {
        if (r.url) pages.push({ url: r.url, title: r.title ?? r.url, pageAge: null });
      }
      for (const r of tool.browser_results ?? []) {
        if (r.url) pages.push({ url: r.url, title: r.title ?? r.url, pageAge: null });
      }
      // Opened pages report their address as "URL: ..." in the tool output.
      if (tool.type !== "browser_search" && tool.output) {
        const match = /URL:\s*(https?:\/\/\S+)/.exec(tool.output);
        if (match) pages.push({ url: match[1], title: match[1], pageAge: null });
      }
    }
  }
  return pages;
}

function contentOf(completion: ChatCompletion): string {
  return completion.choices[0]?.message.content ?? "";
}

/** One browser-search turn plus a JSON repair retry; returns the parsed reply and pages seen. */
async function researchJson<T>(
  client: GroqChatClient,
  model: string,
  system: string,
  userPrompt: string,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<{ ok: true; value: T; pages: RetrievedPage[] } | { ok: false; error: string }> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: userPrompt },
  ];
  const pages: RetrievedPage[] = [];
  const result = await withJsonRetry({
    schema,
    attempt: async (previousError) => {
      let completion: ChatCompletion;
      if (previousError) {
        // Repair turn: no new searching, JSON mode on.
        messages.push({ role: "user", content: jsonRepairPrompt(previousError) });
        completion = await client.create(
          {
            model,
            messages,
            reasoning_effort: "low",
            response_format: { type: "json_object" },
            max_completion_tokens: 2048,
          },
          { signal },
        );
      } else {
        // Browser search can't be combined with structured outputs.
        completion = await client.create(
          {
            model,
            messages,
            reasoning_effort: "low",
            tools: [{ type: "browser_search" }],
            tool_choice: "required",
            max_completion_tokens: 8192,
          },
          { signal },
        );
      }
      pages.push(...collectGroqPages(completion));
      const content = contentOf(completion);
      messages.push({ role: "assistant", content });
      return stripCitationMarkers(content);
    },
  });
  return result.ok ? { ok: true, value: result.value, pages } : result;
}

export function groqProvider(client: GroqChatClient, model: string): CheckProvider {
  return {
    name: "groq",
    maxClaims: GROQ_MAX_CLAIMS,
    concurrency: GROQ_CONCURRENCY,
    maxOpinions: GROQ_MAX_OPINIONS,

    async extractClaims(text, signal) {
      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: extractSystem(GROQ_MAX_CLAIMS, GROQ_MAX_OPINIONS) + EXTRACT_JSON_SHAPE },
        { role: "user", content: extractUserPrompt(text) },
      ];
      const result = await withJsonRetry({
        schema: ExtractedClaimsSchema,
        attempt: async (previousError) => {
          if (previousError) messages.push({ role: "user", content: jsonRepairPrompt(previousError) });
          const completion = await client.create(
            {
              model,
              messages,
              reasoning_effort: "low",
              response_format: { type: "json_object" },
              max_completion_tokens: 4096,
            },
            { signal },
          );
          const content = contentOf(completion);
          messages.push({ role: "assistant", content });
          return content;
        },
      });
      if (!result.ok) throw new Error(result.error);
      return {
        claims: dedupeClaims(result.value.claims),
        opinions: dedupeClaims(result.value.opinions),
        notCheckable: result.value.notCheckable,
      };
    },

    async verifyClaim(claim, context, signal): Promise<ClaimResult> {
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
          explanation: stripCitationMarkers(v.explanation).trim(),
          sources: filterToRetrieved(v.sources, result.pages),
        };
      } catch (err) {
        return { id: claim.id, text: claim.text, status: "error", error: describeError(err) };
      }
    },

    async assessOpinion(opinion, context, signal): Promise<OpinionResult> {
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
          explanation: stripCitationMarkers(v.explanation).trim(),
          supporting: v.supporting.slice(0, 3).map((s) => stripCitationMarkers(s).trim()),
          opposing: v.opposing.slice(0, 3).map((s) => stripCitationMarkers(s).trim()),
          sources: filterToRetrieved(v.sources, result.pages),
        };
      } catch (err) {
        return { id: opinion.id, text: opinion.text, status: "error", error: describeError(err) };
      }
    },

    async summarize(inputText, results, signal, opinions = []) {
      const done = results.filter((r) => r.status === "done");
      const assessed = opinions.filter((o) => o.status === "done");
      if (done.length === 0 && assessed.length === 0) return fallbackSummaryText(results, opinions);
      try {
        const completion = await client.create(
          {
            model,
            reasoning_effort: "low",
            max_completion_tokens: 1024,
            messages: [
              { role: "system", content: SUMMARY_SYSTEM },
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
        return stripCitationMarkers(contentOf(completion)).trim() || fallbackSummaryText(results, opinions);
      } catch {
        return fallbackSummaryText(results, opinions);
      }
    },
  };
}
