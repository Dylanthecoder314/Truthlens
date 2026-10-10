import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const checks = sqliteTable(
  "checks",
  {
    id: text("id").primaryKey(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    inputType: text("input_type", { enum: ["text", "url"] }).notNull(),
    /** Short preview used by the history page. */
    preview: text("preview").notNull(),
    claimCount: integer("claim_count").notNull(),
    /** Full CheckRecord as JSON; validated with Zod when read back. */
    data: text("data", { mode: "json" }).notNull(),
  },
  (t) => [index("checks_created_at_idx").on(t.createdAt)],
);

export type CheckRow = typeof checks.$inferSelect;
