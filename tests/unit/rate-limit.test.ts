import { describe, it, expect, vi, beforeEach } from "vitest";

describe("rateLimit", () => {
  let rateLimit: (key: string, limit: number, windowMs: number) => { limited: boolean; retryAfter: number };
  let nowMs: number;

  beforeEach(async () => {
    nowMs = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => nowMs);
    // Re-import each test so module state is fresh
    vi.resetModules();
    const mod = await import("@/lib/rate-limit");
    rateLimit = mod.rateLimit;
  });

  it("first call is not limited", () => {
    const result = rateLimit("key1", 3, 60_000);
    expect(result.limited).toBe(false);
    expect(result.retryAfter).toBe(0);
  });

  it("calls up to the limit are not limited", () => {
    rateLimit("key2", 3, 60_000);
    rateLimit("key2", 3, 60_000);
    const result = rateLimit("key2", 3, 60_000);
    expect(result.limited).toBe(false);
  });

  it("call over the limit is limited", () => {
    rateLimit("key3", 3, 60_000);
    rateLimit("key3", 3, 60_000);
    rateLimit("key3", 3, 60_000);
    const result = rateLimit("key3", 3, 60_000);
    expect(result.limited).toBe(true);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("counter resets after window expires", () => {
    rateLimit("key4", 1, 60_000);
    rateLimit("key4", 1, 60_000); // now limited

    nowMs += 61_000; // advance past window
    const result = rateLimit("key4", 1, 60_000);
    expect(result.limited).toBe(false);
  });

  it("different keys are tracked independently", () => {
    rateLimit("a", 1, 60_000);
    rateLimit("a", 1, 60_000); // 'a' is now limited
    const result = rateLimit("b", 1, 60_000); // 'b' is fresh
    expect(result.limited).toBe(false);
  });

  it("retryAfter is roughly the remaining window in seconds", () => {
    rateLimit("key5", 1, 10_000);
    rateLimit("key5", 1, 10_000); // limited

    nowMs += 3_000; // 3s into the window
    const result = rateLimit("key5", 1, 10_000);
    expect(result.limited).toBe(true);
    // Window is 10s, 3s elapsed → ~7s remaining
    expect(result.retryAfter).toBeGreaterThanOrEqual(6);
    expect(result.retryAfter).toBeLessThanOrEqual(8);
  });
});
