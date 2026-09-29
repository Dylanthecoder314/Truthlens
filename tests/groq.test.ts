import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "groq-sdk/resources/chat/completions";
import { describe, expect, it, vi } from "vitest";
import {
  collectGroqPages,
  GROQ_MAX_CLAIMS,
  groqProvider,
  stripCitationMarkers,
  type GroqChatClient,
} from "@/lib/groq";
import { runCheck } from "@/lib/pipeline";
import type { StreamEvent } from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Fake Groq responses (shape observed from the live browser_search API)
// ---------------------------------------------------------------------------

type ExecutedTool = NonNullable<ChatCompletion["choices"][number]["message"]["executed_tools"]>[number];

function completion(content: string, executed_tools: ExecutedTool[] = []): ChatCompletion {
  return {
    id: "chatcmpl_test",
    object: "chat.completion",
    created: 0,
    model: "openai/gpt-oss-120b",
    choices: [
      { index: 0, finish_reason: "stop", logprobs: null, message: { role: "assistant", content, executed_tools } },
    ],
  } as unknown as ChatCompletion;
}

const SEARCH: ExecutedTool[] = [
  {
    index: 0,
    type: "browser_search",
    arguments: '{"query":"eiffel tower height"}',
    output: "L1: URL: https://exa.ai/search?q=eiffel",
    search_results: {
      results: [
        { title: "Key figures", url: "https://www.toureiffel.paris/en/the-monument/key-figures", content: "", score: 0 },
      ],
    },
  },
  {
    index: 1,
    type: "browser.open",
    arguments: '{"id":2}',
    output: "L0: \nL1: URL: https://en.wikipedia.org/wiki/Eiffel_Tower\nL2: Eiffel Tower",
  },
] as unknown as ExecutedTool[];

const VERDICT = {
  verdict: "True",
  confidence: 92,
  explanation: "The tower is about 330 metres tall 【1†L41-L42】. It was extended by antennas.",
  sources: [
    { title: "Key figures", publisher: "Tour Eiffel", url: "https://toureiffel.paris/en/the-monument/key-figures/", date: null },
    { title: "Eiffel Tower", publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/Eiffel_Tower", date: null },
    { title: "Invented", publisher: "Nope", url: "https://made-up.example.com/x", date: null },
  ],
};

function fakeClient(responses: ChatCompletion[]) {
  const calls: ChatCompletionCreateParamsNonStreaming[] = [];
  const create = vi.fn(async (body: ChatCompletionCreateParamsNonStreaming) => {
    calls.push({ ...body, messages: [...body.messages] });
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra API call");
    return next;
  });
  const client: GroqChatClient = { create };
  return { client, create, calls };
}

const CLAIM = { id: "c1", text: "The Eiffel Tower is 330 metres tall." };

describe("Groq helpers", () => {
  it("strips browser-search citation markers", () => {
    expect(stripCitationMarkers("About 330 m 【1†L41-L42】【2†L6】 tall.")).toBe("About 330 m tall.");
  });

  it("collects searched and opened pages, ignoring the search engine URL", () => {
    const urls = collectGroqPages(completion("", SEARCH)).map((p) => p.url);
    expect(urls).toEqual([
      "https://www.toureiffel.paris/en/the-monument/key-figures",
      "https://en.wikipedia.org/wiki/Eiffel_Tower",
    ]);
  });
});

describe("groqProvider.verifyClaim (mocked API)", () => {
  it("uses browser_search, returns a verdict, and keeps only retrieved sources", async () => {
    const { client, calls } = fakeClient([completion(JSON.stringify(VERDICT), SEARCH)]);
    const r = await groqProvider(client, "m").verifyClaim(CLAIM, "ctx");
    expect(calls[0].tools).toEqual([{ type: "browser_search" }]);
    expect(calls[0].response_format).toBeUndefined(); // not combinable with browser search
    expect(r.status).toBe("done");
    if (r.status !== "done") return;
    expect(r.sources.map((s) => s.url)).toEqual([
      "https://www.toureiffel.paris/en/the-monument/key-figures",
      "https://en.wikipedia.org/wiki/Eiffel_Tower",
    ]);
    expect(r.explanation).not.toContain("【");
  });

  it("retries once in JSON mode without searching again, keeping earlier pages", async () => {
    const { client, calls } = fakeClient([
      completion("The claim is true because the official site says so.", SEARCH),
      completion(JSON.stringify(VERDICT)),
    ]);
    const r = await groqProvider(client, "m").verifyClaim(CLAIM, "ctx");
    expect(calls).toHaveLength(2);
    expect(calls[1].tools).toBeUndefined();
    expect(calls[1].response_format).toEqual({ type: "json_object" });
    expect(JSON.stringify(calls[1].messages.at(-1))).toMatch(/could not be used/);
    expect(r.status === "done" && r.sources.length).toBe(2);
  });

  it("marks the claim errored after two malformed replies", async () => {
    const { client } = fakeClient([completion("nope", SEARCH), completion('{"verdict":"Sure"}')]);
    const r = await groqProvider(client, "m").verifyClaim(CLAIM, "ctx");
    expect(r).toMatchObject({ status: "error", error: expect.stringContaining("malformed") });
  });

  it("marks the claim errored when the API keeps rate-limiting", async () => {
    const client: GroqChatClient = {
      create: vi.fn(async () => {
        throw Object.assign(new Error("Rate limit reached"), { status: 429 });
      }),
    };
    const r = await groqProvider(client, "m").verifyClaim(CLAIM, "ctx");
    expect(r).toMatchObject({ status: "error", error: expect.stringContaining("busy") });
  });
});

describe("runCheck with opinions (Groq provider, mocked API)", () => {
  it("assesses opinions, streams them, and passes them to the summary", async () => {
    const opinion = {
      assessment: "Contested",
      confidence: 65,
      explanation: "Evidence points both ways.",
      supporting: ["a", "b", "c", "d"],
      opposing: ["e"],
      sources: [],
    };
    const responses = [
      completion(
        JSON.stringify({
          claims: [{ text: "Water boils at 100C." }],
          opinions: [{ text: "Nature is the best medicine." }],
          notCheckable: [],
        }),
      ),
      completion(JSON.stringify(VERDICT), SEARCH),
      completion(JSON.stringify(opinion), SEARCH),
      completion("Summary."),
    ];
    const { client, calls } = fakeClient(responses);
    const events: StreamEvent[] = [];

    const outcome = await runCheck({
      provider: groqProvider(client, "m"),
      input: { type: "text", text: "input", url: null, title: null },
      notices: [],
      emit: (e) => events.push(e),
    });

    expect(events.map((e) => e.type)).toEqual(["claims", "claim", "opinion", "summary"]);
    expect(outcome.opinions).toHaveLength(1);
    expect(outcome.opinions[0]).toMatchObject({ id: "o1", status: "done", assessment: "Contested" });
    // Bullet lists are capped at three points.
    expect(outcome.opinions[0].status === "done" && outcome.opinions[0].supporting).toHaveLength(3);
    // The summary call was told about the opinion.
    expect(JSON.stringify(calls[3].messages)).toContain("Nature is the best medicine.");
  });

  it("marks an opinion errored without failing the whole check", async () => {
    const { client } = fakeClient([
      completion(JSON.stringify({ claims: [], opinions: [{ text: "Cats beat dogs." }], notCheckable: [] })),
      completion("nope", SEARCH),
      completion('{"assessment":"Maybe"}'),
    ]);
    const outcome = await runCheck({
      provider: groqProvider(client, "m"),
      input: { type: "text", text: "input", url: null, title: null },
      notices: [],
      emit: () => {},
    });
    expect(outcome.opinions[0]).toMatchObject({ status: "error" });
    expect(outcome.summary.text).toMatch(/No checkable factual claims/);
  });
});

describe("runCheck with the Groq provider (mocked API)", () => {
  it("caps claims, streams events in order, and checks one claim at a time", async () => {
    const claims = Array.from({ length: 7 }, (_, i) => ({ text: `Claim number ${i + 1}.` }));
    const responses = [
      completion(JSON.stringify({ claims, notCheckable: [] })),
      ...Array.from({ length: GROQ_MAX_CLAIMS }, () => completion(JSON.stringify(VERDICT), SEARCH)),
      completion("Overall the text is accurate."),
    ];
    const { client, calls } = fakeClient(responses);
    const events: StreamEvent[] = [];

    const outcome = await runCheck({
      provider: groqProvider(client, "m"),
      input: { type: "text", text: "input", url: null, title: null },
      notices: [],
      emit: (e) => events.push(e),
    });

    expect(outcome.claims).toHaveLength(GROQ_MAX_CLAIMS);
    expect(outcome.notices[0]).toMatch(/only the 5 most significant/);
    expect(calls[0].response_format).toEqual({ type: "json_object" });
    expect(events.map((e) => e.type)).toEqual(["claims", ...Array(GROQ_MAX_CLAIMS).fill("claim"), "summary"]);
    // Sequential: claim events arrive in input order.
    expect(events.filter((e) => e.type === "claim").map((e) => (e.type === "claim" ? e.result.id : ""))).toEqual([
      "c1", "c2", "c3", "c4", "c5",
    ]);
    expect(outcome.summary.text).toBe("Overall the text is accurate.");
  });
});
