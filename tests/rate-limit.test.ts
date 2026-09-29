import { describe, expect, it } from "vitest";
import { clientIp, RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks", () => {
    const now = 0;
    const rl = new RateLimiter(3, 1000, () => now);
    expect(rl.check("ip").remaining).toBe(2);
    expect(rl.check("ip").remaining).toBe(1);
    expect(rl.check("ip")).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = rl.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(1000);
  });

  it("tracks keys independently", () => {
    const rl = new RateLimiter(1, 1000, () => 0);
    expect(rl.check("a").allowed).toBe(true);
    expect(rl.check("b").allowed).toBe(true);
    expect(rl.check("a").allowed).toBe(false);
  });

  it("frees slots as the window slides", () => {
    let now = 0;
    const rl = new RateLimiter(2, 1000, () => now);
    rl.check("ip"); // t=0
    now = 400;
    rl.check("ip"); // t=400
    now = 999;
    expect(rl.check("ip").allowed).toBe(false);
    expect(rl.check("ip").retryAfterMs).toBe(1);
    now = 1001; // first hit expired
    expect(rl.check("ip").allowed).toBe(true);
    expect(rl.check("ip").allowed).toBe(false);
    now = 1401; // second hit expired
    expect(rl.check("ip").allowed).toBe(true);
  });

  it("does not count blocked attempts against the window", () => {
    let now = 0;
    const rl = new RateLimiter(1, 1000, () => now);
    rl.check("ip");
    now = 500;
    rl.check("ip"); // blocked
    now = 1001;
    expect(rl.check("ip").allowed).toBe(true);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });
  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
