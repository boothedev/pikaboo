import { describe, it, expect } from "vitest";
import { ActiveUserCache } from "./ActiveUserCache";

describe("ActiveUserCache", () => {
  it("creates a fresh entry on getOrCreate", () => {
    const cache = new ActiveUserCache();

    expect(cache.get("u1")).toBeUndefined();

    const entry = cache.getOrCreate("u1");
    expect(entry).toEqual({ lastEarn: 0, pending: 0 });
    expect(cache.getOrCreate("u1")).toBe(entry); // same reference
    expect(cache.size).toBe(1);
  });

  it("overwrites an entry with set", () => {
    const cache = new ActiveUserCache();
    cache.set("u1", { lastEarn: 123, pending: 4 });

    expect(cache.get("u1")).toEqual({ lastEarn: 123, pending: 4 });
  });

  it("returns only users with pending points", () => {
    const cache = new ActiveUserCache();
    cache.set("a", { lastEarn: 1, pending: 0 });
    cache.set("b", { lastEarn: 1, pending: 3 });
    cache.set("c", { lastEarn: 1, pending: 0 });

    expect(cache.getPendingUsers()).toEqual([{ userId: "b", pending: 3 }]);
  });

  it("subtracts flushed amounts without losing newly-earned points", () => {
    const cache = new ActiveUserCache();
    cache.set("u1", { lastEarn: 1, pending: 5 });

    // Simulate points earned while the flush was in flight.
    cache.get("u1")!.pending += 2; // 5 -> 7

    cache.updatePendingAfterFlush([{ userId: "u1", pending: 5 }]);

    expect(cache.get("u1")!.pending).toBe(2);
  });

  it("evicts stale entries but keeps pending or recent ones", () => {
    const cache = new ActiveUserCache();
    cache.set("stale", { lastEarn: 0, pending: 0 });
    cache.set("pending", { lastEarn: 0, pending: 1 });
    cache.set("recent", { lastEarn: Date.now(), pending: 0 });

    const evicted = cache.evictStale(600_000);

    expect(evicted).toBe(1);
    expect(cache.get("stale")).toBeUndefined();
    expect(cache.get("pending")).toBeDefined();
    expect(cache.get("recent")).toBeDefined();
  });
});
