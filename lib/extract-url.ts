import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";

export class UrlFetchError extends Error {
  constructor(
    message: string,
    public readonly code: "bad_url" | "fetch_failed",
  ) {
    super(message);
    this.name = "UrlFetchError";
  }
}

export interface Article {
  title: string | null;
  text: string;
  url: string;
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;
const MIN_ARTICLE_CHARS = 200;

// ---------------------------------------------------------------------------
// SSRF protection: only fetch public http(s) hosts.
// ---------------------------------------------------------------------------

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return isPrivateAddress(mapped[1]);
  return (
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb") ||
    v6.startsWith("ff")
  );
}

export type LookupFn = (hostname: string) => Promise<{ address: string }[]>;

const defaultLookup: LookupFn = (hostname) => dnsLookup(hostname, { all: true });

export async function assertPublicUrl(raw: string, lookup: LookupFn = defaultLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlFetchError("That doesn't look like a valid web address.", "bad_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlFetchError("Only http:// and https:// links are supported.", "bad_url");
  }
  if (url.username || url.password) {
    throw new UrlFetchError("Links with embedded usernames or passwords aren't supported.", "bad_url");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new UrlFetchError("That address points to a private network and can't be fetched.", "bad_url");
  }
  let addresses: { address: string }[];
  if (isIP(host)) {
    addresses = [{ address: host }];
  } else {
    try {
      addresses = await lookup(host);
    } catch {
      throw new UrlFetchError(`We couldn't find the website "${host}". Check the address.`, "bad_url");
    }
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UrlFetchError("That address points to a private network and can't be fetched.", "bad_url");
  }
  return url;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/** Pure: turn an HTML document into readable article text. */
export function extractArticle(html: string, url: string): Article {
  const virtualConsole = new VirtualConsole(); // swallow CSS/JS parse noise
  const dom = new JSDOM(html, { url, virtualConsole });
  const doc = dom.window.document;
  const reader = new Readability(doc);
  const parsed = reader.parse();

  let text = parsed?.textContent ?? "";
  if (text.trim().length < MIN_ARTICLE_CHARS) {
    // Readability can miss short pages; fall back to the body text.
    text = doc.body?.textContent ?? "";
  }
  text = text
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
  const title = parsed?.title?.trim() || doc.title?.trim() || null;
  dom.window.close();
  return { title, text, url };
}

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new UrlFetchError("That page is too large to fetch.", "fetch_failed");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8").decode(buf);
}

export async function fetchArticle(
  rawUrl: string,
  deps: { fetch?: typeof fetch; lookup?: LookupFn } = {},
): Promise<Article> {
  const doFetch = deps.fetch ?? fetch;
  let url = await assertPublicUrl(rawUrl, deps.lookup);

  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    try {
      res = await doFetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": "TruthLensBot/1.0 (+fact-check article extraction)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      throw new UrlFetchError(
        timedOut
          ? "The website took too long to respond. Try again or paste the text instead."
          : "We couldn't reach that website. Check the address or paste the text instead.",
        "fetch_failed",
      );
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString(), deps.lookup);
      res = null;
      continue;
    }
    break;
  }

  if (!res) throw new UrlFetchError("That link redirected too many times.", "fetch_failed");
  if (!res.ok) {
    throw new UrlFetchError(
      res.status === 403 || res.status === 401
        ? "That website blocked our request. Copy the article text and paste it instead."
        : `The website returned an error (HTTP ${res.status}). Try pasting the text instead.`,
      "fetch_failed",
    );
  }
  const type = res.headers.get("content-type") ?? "";
  if (type && !/html|xml|text\/plain/i.test(type)) {
    throw new UrlFetchError(
      "That link isn't a web page we can read (it may be a PDF, image, or download).",
      "fetch_failed",
    );
  }

  const body = await readLimited(res);
  const article = /text\/plain/i.test(type)
    ? { title: null, text: body.trim(), url: url.toString() }
    : extractArticle(body, url.toString());

  if (article.text.length < 50) {
    throw new UrlFetchError(
      "We couldn't find readable article text on that page. It may need JavaScript or a login. Paste the text instead.",
      "fetch_failed",
    );
  }
  return article;
}
