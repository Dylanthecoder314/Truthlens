import { NextResponse } from "next/server";
import { getProvider, MissingApiKeyError } from "@/lib/providers";
import { newCheckId, saveCheck } from "@/lib/db";
import { fetchArticle, UrlFetchError } from "@/lib/extract-url";
import { describeError, runCheck } from "@/lib/pipeline";
import { checkRateLimiter, clientIp, RATE_LIMIT } from "@/lib/rate-limit";
import {
  MAX_INPUT_CHARS,
  parseCheckRequest,
  type ApiError,
  type ApiErrorCode,
  type CheckInput,
  type CheckRecord,
  type StreamEvent,
} from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Each claim is researched with live web search; allow long-running checks.
export const maxDuration = 300;

function errorResponse(code: ApiErrorCode, message: string, status: number, headers?: HeadersInit) {
  const body: ApiError = { error: { code, message } };
  return NextResponse.json(body, { status, headers });
}

export async function POST(request: Request) {
  // ---- Validate input -----------------------------------------------------
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse("invalid_input", "The request body must be JSON.", 400);
  }
  const parsed = parseCheckRequest(json);
  if (!parsed.ok) {
    return errorResponse(parsed.code, parsed.message, parsed.code === "input_too_long" ? 413 : 400);
  }

  // ---- Rate limit -----------------------------------------------------------
  const limit = checkRateLimiter.check(clientIp(request.headers));
  if (!limit.allowed) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60_000));
    return errorResponse(
      "rate_limited",
      `You've reached the limit of ${RATE_LIMIT} checks per hour. Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      429,
      { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
    );
  }

  let provider;
  try {
    provider = getProvider();
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      console.error(err.message);
      return errorResponse("api_error", "The fact-checking service isn't configured yet (missing API key).", 500);
    }
    throw err;
  }

  // ---- Resolve input text ---------------------------------------------------
  const notices: string[] = [];
  let input: CheckInput;
  if ("url" in parsed.data) {
    try {
      const article = await fetchArticle(parsed.data.url);
      let text = article.text;
      if (text.length > MAX_INPUT_CHARS) {
        text = text.slice(0, MAX_INPUT_CHARS);
        notices.push(
          `This article is long, so only the first ${MAX_INPUT_CHARS.toLocaleString("en-US")} characters were checked.`,
        );
      }
      input = { type: "url", text, url: article.url, title: article.title };
    } catch (err) {
      if (err instanceof UrlFetchError) {
        return errorResponse(err.code, err.message, err.code === "bad_url" ? 400 : 422);
      }
      return errorResponse("fetch_failed", "We couldn't load that page. Try pasting the text instead.", 422);
    }
  } else {
    input = { type: "text", text: parsed.data.text, url: null, title: null };
  }

  // ---- Stream the pipeline --------------------------------------------------
  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          closed = true;
        }
      };

      emit({ type: "meta", input, notices });

      try {
        const outcome = await runCheck({ provider, input, notices, emit, signal });
        const record: CheckRecord = {
          id: newCheckId(),
          createdAt: new Date().toISOString(),
          input,
          ...outcome,
        };
        let savedId: string | null = null;
        try {
          await saveCheck(record);
          savedId = record.id;
        } catch (err) {
          console.error("Failed to save check", err);
        }
        emit({ type: "done", id: savedId });
      } catch (err) {
        console.error("Check failed", err);
        emit({
          type: "error",
          message: `We couldn't complete this check. ${describeError(err)}`,
        });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by client disconnect
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
