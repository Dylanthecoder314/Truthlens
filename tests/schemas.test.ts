import { describe, expect, it } from "vitest";
import {
  CheckRecordSchema,
  ExtractedClaimsSchema,
  MAX_INPUT_CHARS,
  VerificationSchema,
  countVerdicts,
  parseCheckRequest,
  type ClaimResult,
} from "@/lib/schemas";

describe("ExtractedClaimsSchema", () => {
  it("accepts a well-formed extraction", () => {
    const result = ExtractedClaimsSchema.safeParse({
      claims: [{ text: "Water boils at 100°C at sea level." }],
      notCheckable: [{ text: "Everyone should drink more water.", reason: "Opinion" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty arrays (no checkable claims)", () => {
    expect(ExtractedClaimsSchema.safeParse({ claims: [], notCheckable: [] }).success).toBe(true);
  });

  it("rejects missing fields and empty claim text", () => {
    expect(ExtractedClaimsSchema.safeParse({ claims: [] }).success).toBe(false);
    expect(
      ExtractedClaimsSchema.safeParse({ claims: [{ text: "" }], notCheckable: [] }).success,
    ).toBe(false);
    expect(
      ExtractedClaimsSchema.safeParse({ claims: [], notCheckable: [{ text: "x" }] }).success,
    ).toBe(false);
  });
});

describe("VerificationSchema", () => {
  const valid = {
    verdict: "Mostly False",
    confidence: 82,
    explanation: "The claim overstates the figure. Official data shows a lower number.",
    sources: [
      { title: "Report", publisher: "Agency", url: "https://example.gov/report", date: "2024-01-02" },
      { title: "Article", publisher: null, url: "https://news.example.com/a", date: null },
    ],
  };

  it("accepts a valid verdict", () => {
    expect(VerificationSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unknown verdicts", () => {
    expect(VerificationSchema.safeParse({ ...valid, verdict: "Pants on Fire" }).success).toBe(false);
  });

  it("rejects out-of-range or fractional confidence", () => {
    expect(VerificationSchema.safeParse({ ...valid, confidence: 101 }).success).toBe(false);
    expect(VerificationSchema.safeParse({ ...valid, confidence: -1 }).success).toBe(false);
    expect(VerificationSchema.safeParse({ ...valid, confidence: 50.5 }).success).toBe(false);
  });

  it("rejects sources with invalid URLs", () => {
    const bad = { ...valid, sources: [{ title: "x", publisher: null, url: "not a url", date: null }] };
    expect(VerificationSchema.safeParse(bad).success).toBe(false);
  });
});

describe("parseCheckRequest", () => {
  it("accepts text", () => {
    const r = parseCheckRequest({ text: "  The sky is blue.  " });
    expect(r).toEqual({ ok: true, data: { text: "The sky is blue." } });
  });

  it("accepts an http(s) url", () => {
    expect(parseCheckRequest({ url: "https://example.com/a" }).ok).toBe(true);
  });

  it("rejects empty text", () => {
    const r = parseCheckRequest({ text: "   " });
    expect(r).toMatchObject({ ok: false, code: "invalid_input" });
  });

  it("rejects text over the limit with input_too_long", () => {
    const r = parseCheckRequest({ text: "a".repeat(MAX_INPUT_CHARS + 1) });
    expect(r).toMatchObject({ ok: false, code: "input_too_long" });
  });

  it("accepts text exactly at the limit", () => {
    expect(parseCheckRequest({ text: "a".repeat(MAX_INPUT_CHARS) }).ok).toBe(true);
  });

  it("rejects bad or non-http urls with bad_url", () => {
    expect(parseCheckRequest({ url: "not a url" })).toMatchObject({ ok: false, code: "bad_url" });
    expect(parseCheckRequest({ url: "ftp://example.com" })).toMatchObject({ ok: false, code: "bad_url" });
    expect(parseCheckRequest({ url: "javascript:alert(1)" })).toMatchObject({ ok: false, code: "bad_url" });
  });

  it("rejects both, neither, or unexpected bodies", () => {
    expect(parseCheckRequest({ text: "a", url: "https://x.com" }).ok).toBe(false);
    expect(parseCheckRequest({}).ok).toBe(false);
    expect(parseCheckRequest(null).ok).toBe(false);
    expect(parseCheckRequest("text").ok).toBe(false);
  });
});

describe("countVerdicts and CheckRecordSchema", () => {
  const claims: ClaimResult[] = [
    { id: "c1", text: "a", status: "done", verdict: "True", confidence: 90, explanation: "x", sources: [] },
    { id: "c2", text: "b", status: "done", verdict: "False", confidence: 80, explanation: "y", sources: [] },
    { id: "c3", text: "c", status: "error", error: "failed" },
  ];

  it("counts each verdict and errors", () => {
    const counts = countVerdicts(claims);
    expect(counts.True).toBe(1);
    expect(counts.False).toBe(1);
    expect(counts.Error).toBe(1);
    expect(counts.Unverifiable).toBe(0);
  });

  it("accepts records saved before opinions existed", () => {
    const old = {
      id: "abc123XYZ9",
      createdAt: new Date().toISOString(),
      input: { type: "text", text: "a", url: null, title: null },
      claims: [],
      notCheckable: [],
      summary: { text: "None.", counts: countVerdicts([]) },
      notices: [],
    };
    expect(CheckRecordSchema.parse(old).opinions).toEqual([]);
  });

  it("round-trips a stored record", () => {
    const record = {
      id: "abc123XYZ9",
      createdAt: new Date().toISOString(),
      input: { type: "text", text: "a b c", url: null, title: null },
      claims,
      opinions: [
        {
          id: "o1",
          text: "Remote work is better.",
          status: "done",
          assessment: "Contested",
          confidence: 70,
          explanation: "Studies disagree.",
          supporting: ["Higher self-reported productivity."],
          opposing: [],
          sources: [],
        },
      ],
      notCheckable: [],
      summary: { text: "Mixed.", counts: countVerdicts(claims) },
      notices: [],
    };
    expect(CheckRecordSchema.parse(JSON.parse(JSON.stringify(record)))).toEqual(record);
  });
});
