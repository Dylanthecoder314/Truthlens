import type {
  BetaContentBlock,
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { describe, expect, it, vi } from "vitest";
import { extractJsonObject, withJsonRetry, type MessagesClient } from "@/lib/llm";
import { extractClaims, mapWithConcurrency, verifyClaim } from "@/lib/pipeline";
import { VerificationSchema } from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Helpers to build fake API responses
// ---------------------------------------------------------------------------

function message(content: BetaContentBlock[], stop_reason: BetaMessage["stop_reason"] = "end_turn"): BetaMessage {
  // Only the fields the pipeline reads are populated.
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content,
    stop_reason,
    stop_details: null,
  } as unknown as BetaMessage;
}

function text(t: string): BetaContentBlock {
  return { type: "text", text: t, citations: null } as unknown as BetaContentBlock;
}

function searchResults(pages: { url: string; title: string; page_age?: string }[]): BetaContentBlock[] {
  return [
    { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "q" } },
    {
      type: "web_search_tool_result",
      tool_use_id: "srv_1",
      content: pages.map((p) => ({
        type: "web_search_result",
        url: p.url,
        title: p.title,
        page_age: p.page_age ?? null,
        encrypted_content: "x",
      })),
    },
  ] as unknown as BetaContentBlock[];
}

function fakeClient(responses: BetaMessage[]) {
  const calls: MessageCreateParamsNonStreaming[] = [];
  const create = vi.fn(async (body: MessageCreateParamsNonStreaming) => {
    // Snapshot messages: the pipeline appends to the same array between calls.
    calls.push({ ...body, messages: [...body.messages] });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra API call");
    return next;
  });
  const client: MessagesClient = { create };
  return { client, create, calls };
}

const GOOD_VERDICT = {
  verdict: "False",
  confidence: 90,
  explanation: "Official records show the opposite. The claim confuses two different figures.",
  sources: [
    { title: "Official stats", publisher: "Stats Office", url: "https://stats.example.gov/table", date: null },
    { title: "Made-up page", publisher: "Nowhere", url: "https://invented.example.com/fake", date: null },
  ],
};

const CLAIM = { id: "c1", text: "The population doubled in 2020." };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("extractJsonObject", () => {
  it("parses bare JSON, fenced JSON, and JSON surrounded by prose", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('Here you go: {"a":{"b":2}} Hope that helps')).toEqual({ a: { b: 2 } });
  });

  it("throws when there is no object", () => {
    expect(() => extractJsonObject("no json here")).toThrow();
    expect(() => extractJsonObject("{broken")).toThrow();
  });
});

describe("withJsonRetry", () => {
  it("returns on first success without retrying", async () => {
    const attempt = vi.fn(async () => JSON.stringify(GOOD_VERDICT));
    const r = await withJsonRetry({ schema: VerificationSchema, attempt });
    expect(r).toMatchObject({ ok: true, attempts: 1 });
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledWith(null);
  });

  it("retries once with the error description, then succeeds", async () => {
    const attempt = vi
      .fn<(prev: string | null) => Promise<string>>()
      .mockResolvedValueOnce("Sorry, I think it's false")
      .mockResolvedValueOnce(JSON.stringify(GOOD_VERDICT));
    const r = await withJsonRetry({ schema: VerificationSchema, attempt });
    expect(r).toMatchObject({ ok: true, attempts: 2 });
    expect(attempt.mock.calls[1][0]).toMatch(/not valid JSON/);
  });

  it("treats schema mismatches as malformed", async () => {
    const attempt = vi
      .fn<(prev: string | null) => Promise<string>>()
      .mockResolvedValueOnce(JSON.stringify({ ...GOOD_VERDICT, verdict: "Kinda" }))
      .mockResolvedValueOnce(JSON.stringify(GOOD_VERDICT));
    const r = await withJsonRetry({ schema: VerificationSchema, attempt });
    expect(r.ok).toBe(true);
    expect(attempt.mock.calls[1][0]).toMatch(/did not match the required shape/);
  });

  it("gives up after two malformed attempts without throwing", async () => {
    const attempt = vi.fn(async () => "still not json");
    const r = await withJsonRetry({ schema: VerificationSchema, attempt });
    expect(r).toMatchObject({ ok: false, attempts: 2 });
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("propagates API errors instead of retrying them as JSON errors", async () => {
    const attempt = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(withJsonRetry({ schema: VerificationSchema, attempt })).rejects.toThrow("network down");
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Pipeline with a mocked Anthropic client
// ---------------------------------------------------------------------------

describe("verifyClaim (mocked API)", () => {
  const pages = searchResults([
    { url: "https://stats.example.gov/table", title: "Population table", page_age: "March 3, 2024" },
  ]);

  it("returns a verdict and keeps only sources that search actually retrieved", async () => {
    const { client } = fakeClient([message([...pages, text(JSON.stringify(GOOD_VERDICT))])]);
    const r = await verifyClaim(client, "m", CLAIM, "ctx");
    expect(r.status).toBe("done");
    if (r.status !== "done") return;
    expect(r.verdict).toBe("False");
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0]).toMatchObject({ url: "https://stats.example.gov/table", date: "March 3, 2024" });
  });

  it("retries once on malformed JSON, sending a repair message in the same conversation", async () => {
    const { client, calls } = fakeClient([
      message([...pages, text("The claim is false because...")]),
      message([text(JSON.stringify(GOOD_VERDICT))]),
    ]);
    const r = await verifyClaim(client, "m", CLAIM, "ctx");
    expect(r.status).toBe("done");
    expect(calls).toHaveLength(2);
    const retryMessages = calls[1].messages;
    // user prompt, assistant (with search results), user repair prompt
    expect(retryMessages).toHaveLength(3);
    expect(retryMessages[1].role).toBe("assistant");
    expect(JSON.stringify(retryMessages[2].content)).toMatch(/could not be used/);
    // Sources from the first (searching) response are still honoured.
    if (r.status === "done") expect(r.sources).toHaveLength(1);
  });

  it("marks the claim as errored after two malformed responses without throwing", async () => {
    const { client, create } = fakeClient([
      message([text("nope")]),
      message([text('{"verdict": "Maybe"}')]),
    ]);
    const r = await verifyClaim(client, "m", CLAIM, "ctx");
    expect(r).toMatchObject({ id: "c1", status: "error" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("marks the claim as errored when the API call throws", async () => {
    const client: MessagesClient = {
      create: vi.fn(async () => {
        throw Object.assign(new Error("overloaded"), { status: 529 });
      }),
    };
    const r = await verifyClaim(client, "m", CLAIM, "ctx");
    expect(r).toMatchObject({ status: "error", error: expect.stringContaining("temporary problem") });
  });

  it("handles a refusal as an errored claim", async () => {
    const { client } = fakeClient([message([], "refusal")]);
    const r = await verifyClaim(client, "m", CLAIM, "ctx");
    expect(r.status).toBe("error");
  });

  it("resumes a paused server-tool turn before parsing", async () => {
    const { client, create } = fakeClient([
      message(pages, "pause_turn"),
      message([text(JSON.stringify(GOOD_VERDICT))]),
    ]);
    const r = await verifyClaim(client, "m", CLAIM, "ctx");
    expect(r.status).toBe("done");
    expect(create).toHaveBeenCalledTimes(2);
    if (r.status === "done") expect(r.sources).toHaveLength(1);
  });

  it("sends web search, the fallback beta and the claim to the API", async () => {
    const { client, calls } = fakeClient([message([...pages, text(JSON.stringify(GOOD_VERDICT))])]);
    await verifyClaim(client, "claude-opus-5-5", CLAIM, "ctx");
    expect(calls[0].tools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]);
    expect(calls[0].betas).toContain("server-side-fallback-2026-07-01");
    expect(JSON.stringify(calls[0].messages)).toContain(CLAIM.text);
  });
});

describe("extractClaims (mocked API)", () => {
  it("retries once on malformed JSON and dedupes claims", async () => {
    const good = {
      claims: [{ text: "A is B." }, { text: "a is b." }, { text: "C is D." }],
      notCheckable: [{ text: "I love it", reason: "Opinion" }],
    };
    const { client, create } = fakeClient([message([text("{oops")]), message([text(JSON.stringify(good))])]);
    const r = await extractClaims(client, "m", "input");
    expect(create).toHaveBeenCalledTimes(2);
    expect(r.claims.map((c) => c.text)).toEqual(["A is B.", "C is D."]);
    expect(r.notCheckable).toHaveLength(1);
  });

  it("throws after two malformed extraction responses", async () => {
    const { client } = fakeClient([message([text("x")]), message([text("y")])]);
    await expect(extractClaims(client, "m", "input")).rejects.toThrow(/malformed/);
  });
});

describe("mapWithConcurrency", () => {
  it("never exceeds the limit and preserves order", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5 + (n % 3) * 3));
      inFlight--;
      return n * 10;
    });
    expect(peak).toBe(3);
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });
});
