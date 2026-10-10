import { StreamEventSchema, type StreamEvent } from "./schemas";

/**
 * Split an SSE buffer into complete events. Returns parsed events and the
 * trailing partial chunk to prepend to the next read.
 */
export function parseSseBuffer(buffer: string): { events: StreamEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: StreamEvent[] = [];
  for (const part of parts) {
    const data = part
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      const parsed = StreamEventSchema.safeParse(JSON.parse(data));
      if (parsed.success) events.push(parsed.data);
    } catch {
      // ignore malformed event
    }
  }
  return { events, rest };
}
