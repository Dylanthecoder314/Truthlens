import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { groqProvider } from "./groq";
import { anthropicProvider } from "./pipeline";
import type { CheckProvider } from "./provider";

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
export const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

export class MissingApiKeyError extends Error {
  constructor(message = "No API key set. Add ANTHROPIC_API_KEY or GROQ_API_KEY and restart the server.") {
    super(message);
    this.name = "MissingApiKeyError";
  }
}

let cached: CheckProvider | null = null;

/**
 * Server-only provider selection. Keys never leave the server.
 * LLM_PROVIDER=anthropic|groq picks explicitly; otherwise Anthropic is used when
 * its key is set, then Groq.
 */
export function getProvider(): CheckProvider {
  if (cached) return cached;
  const choice =
    process.env.LLM_PROVIDER ??
    (process.env.ANTHROPIC_API_KEY ? "anthropic" : process.env.GROQ_API_KEY ? "groq" : null);

  if (choice === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
    cached = anthropicProvider(client.beta.messages, ANTHROPIC_MODEL);
  } else if (choice === "groq") {
    if (!process.env.GROQ_API_KEY) throw new MissingApiKeyError("LLM_PROVIDER=groq but GROQ_API_KEY is not set.");
    // Free-tier rate limits are tight; the SDK waits out 429s using retry-after.
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 5, timeout: 120_000 });
    cached = groqProvider(client.chat.completions, GROQ_MODEL);
  } else if (choice) {
    throw new MissingApiKeyError(`Unknown LLM_PROVIDER "${choice}". Use "anthropic" or "groq".`);
  } else {
    throw new MissingApiKeyError();
  }
  return cached;
}
