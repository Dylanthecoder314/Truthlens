import { z } from "zod";

export const MAX_INPUT_CHARS = 8000;
export const MAX_CLAIMS = 12;
export const MAX_OPINIONS = 4;

export const VERDICTS = [
  "True",
  "Mostly True",
  "Misleading",
  "Mostly False",
  "False",
  "Unverifiable",
] as const;

export const OPINION_ASSESSMENTS = [
  "Well Supported",
  "Contested",
  "Poorly Supported",
  "Purely Subjective",
] as const;

export const OpinionAssessmentSchema = z.enum(OPINION_ASSESSMENTS);
export type OpinionAssessment = z.infer<typeof OpinionAssessmentSchema>;

export const VerdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof VerdictSchema>;

// ---------------------------------------------------------------------------
// API input
// ---------------------------------------------------------------------------

export const TextRequestSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(1, "Please paste some text to check.")
      .max(
        MAX_INPUT_CHARS,
        `Input is too long. The limit is ${MAX_INPUT_CHARS.toLocaleString("en-US")} characters.`,
      ),
  })
  .strict();

export const UrlRequestSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1, "Please enter a URL.")
      .max(2048, "That URL is too long.")
      .refine((value) => {
        try {
          const parsed = new URL(value);
          return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
          return false;
        }
      }, "That doesn't look like a valid web address. It should start with http:// or https://."),
  })
  .strict();

export const CheckRequestSchema = z.union([TextRequestSchema, UrlRequestSchema]);
export type CheckRequest = z.infer<typeof CheckRequestSchema>;

export type ParsedCheckRequest =
  | { ok: true; data: CheckRequest }
  | { ok: false; code: "invalid_input" | "input_too_long" | "bad_url"; message: string };

/** Validate a request body and map failures to a friendly message + error code. */
export function parseCheckRequest(body: unknown): ParsedCheckRequest {
  const isObject = typeof body === "object" && body !== null;
  const hasUrl = isObject && "url" in body;
  const hasText = isObject && "text" in body;
  if (hasUrl === hasText) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Please provide either text or a URL to check.",
    };
  }
  const result = (hasUrl ? UrlRequestSchema : TextRequestSchema).safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const code = hasUrl ? "bad_url" : issue?.code === "too_big" ? "input_too_long" : "invalid_input";
  return { ok: false, code, message: issue?.message ?? "Invalid input." };
}

// ---------------------------------------------------------------------------
// Model output: step 1 (claim extraction)
// Kept free of numeric/length constraints so it converts cleanly to the
// JSON schema used for structured outputs.
// ---------------------------------------------------------------------------

export const ExtractedClaimsSchema = z.object({
  claims: z.array(
    z.object({
      text: z.string().min(1),
    }),
  ),
  opinions: z.array(z.object({ text: z.string().min(1) })).default([]),
  notCheckable: z.array(
    z.object({
      text: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});
export type ExtractedClaims = z.infer<typeof ExtractedClaimsSchema>;

// ---------------------------------------------------------------------------
// Model output: step 2 (verification of one claim)
// ---------------------------------------------------------------------------

export const ModelSourceSchema = z.object({
  title: z.string().min(1),
  publisher: z.string().nullable().optional(),
  url: z.url(),
  date: z.string().nullable().optional(),
});

export const VerificationSchema = z.object({
  verdict: VerdictSchema,
  confidence: z.number().int().min(0).max(100),
  explanation: z.string().min(1).max(1500),
  sources: z.array(ModelSourceSchema),
});
export type Verification = z.infer<typeof VerificationSchema>;

// ---------------------------------------------------------------------------
// Model output: step 2b (assessment of one opinion)
// ---------------------------------------------------------------------------

export const OpinionAssessmentOutputSchema = z.object({
  assessment: OpinionAssessmentSchema,
  confidence: z.number().int().min(0).max(100),
  explanation: z.string().min(1).max(1500),
  supporting: z.array(z.string()),
  opposing: z.array(z.string()),
  sources: z.array(ModelSourceSchema),
});
export type OpinionAssessmentOutput = z.infer<typeof OpinionAssessmentOutputSchema>;

// ---------------------------------------------------------------------------
// Domain objects (streamed to the client and stored in the database)
// ---------------------------------------------------------------------------

export const SourceSchema = z.object({
  title: z.string(),
  publisher: z.string().nullable(),
  url: z.string(),
  date: z.string().nullable(),
});
export type Source = z.infer<typeof SourceSchema>;

export const ClaimResultSchema = z.discriminatedUnion("status", [
  z.object({
    id: z.string(),
    text: z.string(),
    status: z.literal("done"),
    verdict: VerdictSchema,
    confidence: z.number().int().min(0).max(100),
    explanation: z.string(),
    sources: z.array(SourceSchema),
  }),
  z.object({
    id: z.string(),
    text: z.string(),
    status: z.literal("error"),
    error: z.string(),
  }),
]);
export type ClaimResult = z.infer<typeof ClaimResultSchema>;

export const OpinionResultSchema = z.discriminatedUnion("status", [
  z.object({
    id: z.string(),
    text: z.string(),
    status: z.literal("done"),
    assessment: OpinionAssessmentSchema,
    confidence: z.number().int().min(0).max(100),
    explanation: z.string(),
    supporting: z.array(z.string()),
    opposing: z.array(z.string()),
    sources: z.array(SourceSchema),
  }),
  z.object({
    id: z.string(),
    text: z.string(),
    status: z.literal("error"),
    error: z.string(),
  }),
]);
export type OpinionResult = z.infer<typeof OpinionResultSchema>;

export const PendingClaimSchema = z.object({ id: z.string(), text: z.string() });
export type PendingClaim = z.infer<typeof PendingClaimSchema>;

export const NotCheckableSchema = z.object({ text: z.string(), reason: z.string() });
export type NotCheckable = z.infer<typeof NotCheckableSchema>;

export const VerdictCountsSchema = z.object({
  True: z.number().int(),
  "Mostly True": z.number().int(),
  Misleading: z.number().int(),
  "Mostly False": z.number().int(),
  False: z.number().int(),
  Unverifiable: z.number().int(),
  Error: z.number().int(),
});
export type VerdictCounts = z.infer<typeof VerdictCountsSchema>;

export const SummarySchema = z.object({
  text: z.string(),
  counts: VerdictCountsSchema,
});
export type Summary = z.infer<typeof SummarySchema>;

export const CheckInputSchema = z.object({
  type: z.enum(["text", "url"]),
  text: z.string(),
  url: z.string().nullable(),
  title: z.string().nullable(),
});
export type CheckInput = z.infer<typeof CheckInputSchema>;

export const CheckRecordSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  input: CheckInputSchema,
  claims: z.array(ClaimResultSchema),
  opinions: z.array(OpinionResultSchema).default([]),
  notCheckable: z.array(NotCheckableSchema),
  summary: SummarySchema,
  notices: z.array(z.string()),
});
export type CheckRecord = z.infer<typeof CheckRecordSchema>;

export const HistoryItemSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  inputType: z.enum(["text", "url"]),
  preview: z.string(),
  claimCount: z.number().int(),
  counts: VerdictCountsSchema,
});
export type HistoryItem = z.infer<typeof HistoryItemSchema>;

// ---------------------------------------------------------------------------
// Server-Sent Events emitted by POST /api/check
// ---------------------------------------------------------------------------

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meta"),
    input: CheckInputSchema,
    notices: z.array(z.string()),
  }),
  z.object({
    type: z.literal("claims"),
    claims: z.array(PendingClaimSchema),
    opinions: z.array(PendingClaimSchema).default([]),
    notCheckable: z.array(NotCheckableSchema),
    notices: z.array(z.string()),
  }),
  z.object({ type: z.literal("claim"), result: ClaimResultSchema }),
  z.object({ type: z.literal("opinion"), result: OpinionResultSchema }),
  z.object({ type: z.literal("summary"), summary: SummarySchema }),
  z.object({ type: z.literal("done"), id: z.string().nullable() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "invalid_input",
      "input_too_long",
      "bad_url",
      "fetch_failed",
      "rate_limited",
      "not_found",
      "api_error",
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorCode = ApiError["error"]["code"];

export function emptyCounts(): VerdictCounts {
  return {
    True: 0,
    "Mostly True": 0,
    Misleading: 0,
    "Mostly False": 0,
    False: 0,
    Unverifiable: 0,
    Error: 0,
  };
}

export function countVerdicts(results: ClaimResult[]): VerdictCounts {
  const counts = emptyCounts();
  for (const r of results) {
    if (r.status === "done") counts[r.verdict] += 1;
    else counts.Error += 1;
  }
  return counts;
}
