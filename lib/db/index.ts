import "server-only";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { desc, eq } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { customAlphabet } from "nanoid";
import {
  CheckRecordSchema,
  countVerdicts,
  type CheckRecord,
  type HistoryItem,
} from "../schemas";
import { checks } from "./schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/truthlens.db";

// Short, URL-safe, unambiguous IDs (no 0/O/1/l/I).
export const newCheckId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", 10);

let db: LibSQLDatabase | null = null;
let ready: Promise<void> | null = null;

function getDb(): { db: LibSQLDatabase; ready: Promise<void> } {
  if (!db) {
    if (DATABASE_URL.startsWith("file:")) {
      mkdirSync(dirname(DATABASE_URL.slice("file:".length)), { recursive: true });
    }
    const client: Client = createClient({
      url: DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    db = drizzle(client);
    // Create the table on first use so `npm run dev` works with zero setup.
    ready = client
      .batch(
        [
          `CREATE TABLE IF NOT EXISTS checks (
            id TEXT PRIMARY KEY NOT NULL,
            created_at INTEGER NOT NULL,
            input_type TEXT NOT NULL,
            preview TEXT NOT NULL,
            claim_count INTEGER NOT NULL,
            data TEXT NOT NULL
          )`,
          `CREATE INDEX IF NOT EXISTS checks_created_at_idx ON checks (created_at)`,
        ],
        "write",
      )
      .then(() => undefined);
  }
  return { db, ready: ready! };
}

function previewOf(record: CheckRecord): string {
  const base = record.input.title ?? record.input.url ?? record.input.text;
  const oneLine = base.replace(/\s+/g, " ").trim();
  return oneLine.length > 160 ? `${oneLine.slice(0, 157)}…` : oneLine;
}

export async function saveCheck(record: CheckRecord): Promise<void> {
  const { db, ready } = getDb();
  await ready;
  await db.insert(checks).values({
    id: record.id,
    createdAt: new Date(record.createdAt),
    inputType: record.input.type,
    preview: previewOf(record),
    claimCount: record.claims.length,
    data: record,
  });
}

export async function getCheck(id: string): Promise<CheckRecord | null> {
  const { db, ready } = getDb();
  await ready;
  const rows = await db.select().from(checks).where(eq(checks.id, id)).limit(1);
  if (rows.length === 0) return null;
  const parsed = CheckRecordSchema.safeParse(rows[0].data);
  return parsed.success ? parsed.data : null;
}

export async function listRecentChecks(limit = 20): Promise<HistoryItem[]> {
  const { db, ready } = getDb();
  await ready;
  const rows = await db.select().from(checks).orderBy(desc(checks.createdAt)).limit(limit);
  const items: HistoryItem[] = [];
  for (const row of rows) {
    const parsed = CheckRecordSchema.safeParse(row.data);
    if (!parsed.success) continue;
    items.push({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      inputType: row.inputType,
      preview: row.preview,
      claimCount: row.claimCount,
      counts: countVerdicts(parsed.data.claims),
    });
  }
  return items;
}
