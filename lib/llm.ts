import type {
  BetaContentBlock,
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";

/**
 * The slice of the Anthropic SDK the pipeline depends on. Keeping it this
 * narrow lets tests inject a fake without touching the network.
 */
export interface MessagesClient {
  create(
    body: MessageCreateParamsNonStreaming,
    options?: { signal?: AbortSignal },
  ): PromiseLike<BetaMessage>;
}

export type JsonResult<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: string; attempts: number };

/**
 * Pull a JSON object out of model text. Tolerates code fences and stray prose
 * around the object, which models occasionally add despite instructions.
 */
export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new SyntaxError("No JSON object found in the response.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

export function parseJsonWith<S extends z.ZodType>(
  text: string,
  schema: S,
): { ok: true; value: z.infer<S> } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = extractJsonObject(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `the response was not valid JSON (${message}).` };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: `the JSON did not match the required shape:\n${z.prettifyError(parsed.error)}`,
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Run `attempt` and validate its text output against `schema`. If the output is
 * malformed, call `attempt` again with a description of the problem. After
 * `maxAttempts` (default 2: the first try plus one retry) give up and return
 * an error result instead of throwing. API errors thrown by `attempt`
 * propagate unchanged.
 */
export async function withJsonRetry<S extends z.ZodType>(opts: {
  schema: S;
  attempt: (previousError: string | null) => Promise<string>;
  maxAttempts?: number;
}): Promise<JsonResult<z.infer<S>>> {
  const maxAttempts = opts.maxAttempts ?? 2;
  let previousError: string | null = null;
  for (let i = 1; i <= maxAttempts; i++) {
    const text = await opts.attempt(previousError);
    const parsed = parseJsonWith(text, opts.schema);
    if (parsed.ok) return { ok: true, value: parsed.value, attempts: i };
    previousError = parsed.error;
  }
  return {
    ok: false,
    error: `Model returned malformed output after ${maxAttempts} attempts: ${previousError ?? "unknown error"}`,
    attempts: maxAttempts,
  };
}

/** Concatenate the model's final answer text (after the last tool result). */
export function finalText(content: BetaContentBlock[]): string {
  let lastToolIdx = -1;
  content.forEach((block, i) => {
    if (block.type === "web_search_tool_result" || block.type === "server_tool_use") {
      lastToolIdx = i;
    }
  });
  return content
    .slice(lastToolIdx + 1)
    .filter((b): b is Extract<BetaContentBlock, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export interface RetrievedPage {
  url: string;
  title: string;
  pageAge: string | null;
}

/** Every page the web search tool actually returned during a response. */
export function collectRetrievedPages(content: BetaContentBlock[]): RetrievedPage[] {
  const pages: RetrievedPage[] = [];
  for (const block of content) {
    if (block.type !== "web_search_tool_result") continue;
    // Success content is an array; an error is a single object.
    if (!Array.isArray(block.content)) continue;
    for (const result of block.content) {
      pages.push({ url: result.url, title: result.title, pageAge: result.page_age ?? null });
    }
  }
  return pages;
}

/** Normalise a URL for comparison: drop hash, trailing slash, www., tracking params. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_")) u.searchParams.delete(key);
    }
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}${u.search}`;
  } catch {
    return url.trim();
  }
}

export class RefusalError extends Error {
  constructor(message = "The model declined to check this claim.") {
    super(message);
    this.name = "RefusalError";
  }
}
