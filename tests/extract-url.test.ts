import { describe, expect, it, vi } from "vitest";
import {
  assertPublicUrl,
  extractArticle,
  fetchArticle,
  isPrivateAddress,
  UrlFetchError,
  type LookupFn,
} from "@/lib/extract-url";

const ARTICLE_HTML = `<!doctype html>
<html><head><title>Bees in Decline | Example News</title>
<style>body{color:red}</style></head>
<body>
  <nav><a href="/">Home</a> <a href="/world">World</a> <a href="/sport">Sport</a></nav>
  <div class="ad">BUY NOW! Limited offer!</div>
  <article>
    <h1>Bees in Decline</h1>
    <p>Honeybee colonies in the region fell by 30 percent between 2015 and 2020, according to a survey published by the national agriculture department on Tuesday.</p>
    <p>Researchers at the state university said pesticide use and habitat loss were the main factors, although weather also played a role in some years.</p>
    <p>The department plans to publish updated figures next spring, and beekeepers have called for new protections for wildflower meadows across the country.</p>
  </article>
  <footer>© Example News. All rights reserved. Privacy policy. Cookie settings.</footer>
  <script>console.log("tracking")</script>
</body></html>`;

const publicLookup: LookupFn = async () => [{ address: "93.184.216.34" }];

function htmlResponse(body: string, init: ResponseInit = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

describe("extractArticle", () => {
  it("extracts the main article text and title", () => {
    const a = extractArticle(ARTICLE_HTML, "https://news.example.com/bees");
    expect(a.title).toMatch(/Bees in Decline/);
    expect(a.text).toContain("fell by 30 percent between 2015 and 2020");
    expect(a.text).toContain("wildflower meadows");
  });

  it("drops navigation, scripts, styles and boilerplate", () => {
    const a = extractArticle(ARTICLE_HTML, "https://news.example.com/bees");
    expect(a.text).not.toContain("tracking");
    expect(a.text).not.toContain("color:red");
    expect(a.text).not.toContain("Cookie settings");
  });

  it("falls back to body text for short pages", () => {
    const a = extractArticle("<html><body><p>Short page with one fact.</p></body></html>", "https://x.com");
    expect(a.text).toBe("Short page with one fact.");
  });
});

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "192.168.0.1", "172.16.5.4", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "flags %s as private",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("assertPublicUrl", () => {
  it("rejects non-http schemes and malformed urls", async () => {
    await expect(assertPublicUrl("file:///etc/passwd", publicLookup)).rejects.toMatchObject({ code: "bad_url" });
    await expect(assertPublicUrl("nope", publicLookup)).rejects.toBeInstanceOf(UrlFetchError);
  });

  it("rejects localhost and hosts resolving to private IPs", async () => {
    await expect(assertPublicUrl("http://localhost:3000", publicLookup)).rejects.toMatchObject({ code: "bad_url" });
    await expect(assertPublicUrl("http://127.0.0.1/", publicLookup)).rejects.toMatchObject({ code: "bad_url" });
    const privateLookup: LookupFn = async () => [{ address: "10.0.0.5" }];
    await expect(assertPublicUrl("https://intranet.example.com", privateLookup)).rejects.toMatchObject({ code: "bad_url" });
  });

  it("reports unknown hosts as bad_url", async () => {
    const failing: LookupFn = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(assertPublicUrl("https://no-such-host.example", failing)).rejects.toMatchObject({ code: "bad_url" });
  });

  it("accepts public hosts", async () => {
    await expect(assertPublicUrl("https://news.example.com/a", publicLookup)).resolves.toBeInstanceOf(URL);
  });
});

describe("fetchArticle", () => {
  it("fetches and extracts an article", async () => {
    const fetchMock = vi.fn(async () => htmlResponse(ARTICLE_HTML));
    const a = await fetchArticle("https://news.example.com/bees", { fetch: fetchMock, lookup: publicLookup });
    expect(a.text).toContain("30 percent");
    expect(a.url).toBe("https://news.example.com/bees");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("follows redirects and re-checks each hop", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "https://news.example.com/final" } }))
      .mockResolvedValueOnce(htmlResponse(ARTICLE_HTML));
    const a = await fetchArticle("https://news.example.com/old", { fetch: fetchMock, lookup: publicLookup });
    expect(a.url).toBe("https://news.example.com/final");
  });

  it("refuses redirects into private networks", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }),
    );
    await expect(
      fetchArticle("https://news.example.com/x", { fetch: fetchMock, lookup: publicLookup }),
    ).rejects.toMatchObject({ code: "bad_url" });
  });

  it("maps HTTP errors, network failures and non-HTML to fetch_failed", async () => {
    const notFound = vi.fn(async () => htmlResponse("gone", { status: 404 }));
    await expect(fetchArticle("https://a.example.com", { fetch: notFound, lookup: publicLookup })).rejects.toMatchObject({
      code: "fetch_failed",
      message: expect.stringContaining("404"),
    });

    const network = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchArticle("https://a.example.com", { fetch: network, lookup: publicLookup })).rejects.toMatchObject({
      code: "fetch_failed",
    });

    const pdf = vi.fn(async () => new Response("%PDF", { headers: { "content-type": "application/pdf" } }));
    await expect(fetchArticle("https://a.example.com/x.pdf", { fetch: pdf, lookup: publicLookup })).rejects.toMatchObject({
      code: "fetch_failed",
    });
  });

  it("fails clearly when the page has no readable text", async () => {
    const empty = vi.fn(async () => htmlResponse("<html><body><div id=app></div></body></html>"));
    await expect(fetchArticle("https://spa.example.com", { fetch: empty, lookup: publicLookup })).rejects.toMatchObject({
      code: "fetch_failed",
      message: expect.stringContaining("readable article text"),
    });
  });
});
