import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ActiveUserCache } from "@/cache/ActiveUserCache";
import { ConfigService } from "./ConfigService";
import { PointService, MAX_FLUSH_ATTEMPTS } from "./PointService";

const mocks = vi.hoisted(() => ({
  addPoints: vi.fn(),
  addPointsBatch: vi.fn(),
  getPoints: vi.fn(),
  setPoints: vi.fn(),
  adjustPoints: vi.fn(),
  getAllConfig: vi.fn(),
  seedDefaultConfig: vi.fn(),
  setConfigValue: vi.fn(),
}));

vi.mock("@/db/queries", () => mocks);

function setup() {
  const cache = new ActiveUserCache();
  const configService = new ConfigService();
  const pointService = new PointService(cache, configService);
  return { cache, configService, pointService };
}

describe("PointService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    mocks.addPoints.mockReset();
    mocks.addPointsBatch.mockReset();
    mocks.getPoints.mockReset();
    mocks.setPoints.mockReset();
    mocks.adjustPoints.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("awards one point per eligible message, subject to cooldown", () => {
    const { cache, pointService } = setup();

    pointService.onEligibleMessage("u1");
    expect(cache.get("u1")!.pending).toBe(1);

    // 10s later, within the 20s cooldown — no new point.
    vi.setSystemTime(new Date("2026-01-01T00:00:10Z"));
    pointService.onEligibleMessage("u1");
    expect(cache.get("u1")!.pending).toBe(1);

    // Cooldown elapsed — a new point is awarded.
    vi.setSystemTime(new Date("2026-01-01T00:00:20Z"));
    pointService.onEligibleMessage("u1");
    expect(cache.get("u1")!.pending).toBe(2);
  });

  it("getPoints combines DB total with pending cache", async () => {
    const { cache, pointService } = setup();
    mocks.getPoints.mockResolvedValue(10);
    cache.set("u1", { lastEarn: Date.now(), pending: 4 });

    await expect(pointService.getPoints("u1")).resolves.toBe(14);
    expect(mocks.getPoints).toHaveBeenCalledWith("u1");
  });

  it("flushPending batches pending points and clears them", async () => {
    const { cache, pointService } = setup();
    mocks.addPointsBatch.mockResolvedValue(undefined);

    pointService.onEligibleMessage("u1");
    pointService.onEligibleMessage("u2");

    const flushed = await pointService.flushPending();

    expect(flushed).toBe(2);
    expect(mocks.addPointsBatch).toHaveBeenCalledWith([
      { userId: "u1", pending: 1 },
      { userId: "u2", pending: 1 },
    ]);
    expect(cache.get("u1")!.pending).toBe(0);
    expect(cache.get("u2")!.pending).toBe(0);
  });

  it("keeps pending points when the flush fails", async () => {
    const { cache, pointService } = setup();
    mocks.addPointsBatch.mockRejectedValue(new Error("db down"));

    pointService.onEligibleMessage("u1");

    const flushed = await pointService.flushPending();

    expect(flushed).toBe(0);
    expect(cache.get("u1")!.pending).toBe(1); // not cleared on failure
  });

  it("awardPoints writes directly to the database", async () => {
    const { pointService } = setup();
    mocks.addPoints.mockResolvedValue(42);

    await expect(
      pointService.awardPoints("u1", 5, "giveaway"),
    ).resolves.toBe(42);
    expect(mocks.addPoints).toHaveBeenCalledWith("u1", 5);
  });

  it("setPoints flushes pending and sets an exact total", async () => {
    const { cache, pointService } = setup();
    mocks.addPoints.mockResolvedValue(10);
    mocks.setPoints.mockResolvedValue(100);
    cache.set("u1", { lastEarn: Date.now(), pending: 3 });

    await expect(pointService.setPoints("u1", 100)).resolves.toBe(100);

    expect(mocks.addPoints).toHaveBeenCalledWith("u1", 3);
    expect(mocks.setPoints).toHaveBeenCalledWith("u1", 100);
    expect(cache.get("u1")!.pending).toBe(0);
  });

  it("setPoints rejects negative or non-integer values", async () => {
    const { pointService } = setup();

    await expect(pointService.setPoints("u1", -1)).rejects.toThrow(
      "non-negative integer",
    );
    await expect(pointService.setPoints("u1", 1.5)).rejects.toThrow(
      "non-negative integer",
    );

    expect(mocks.setPoints).not.toHaveBeenCalled();
  });

  it("adjustPoints flushes pending and applies a signed delta", async () => {
    const { cache, pointService } = setup();
    mocks.addPoints.mockResolvedValue(10);
    mocks.adjustPoints.mockResolvedValue(90);
    cache.set("u1", { lastEarn: Date.now(), pending: 3 });

    await expect(pointService.adjustPoints("u1", -10)).resolves.toBe(90);

    expect(mocks.addPoints).toHaveBeenCalledWith("u1", 3);
    expect(mocks.adjustPoints).toHaveBeenCalledWith("u1", -10);
    expect(cache.get("u1")!.pending).toBe(0);
  });

  it("adjustPoints rejects non-integer deltas", async () => {
    const { pointService } = setup();

    await expect(pointService.adjustPoints("u1", 0.5)).rejects.toThrow(
      "integer",
    );

    expect(mocks.adjustPoints).not.toHaveBeenCalled();
  });

  it("shutdown flushes remaining pending points", async () => {
    const { cache, pointService } = setup();
    mocks.addPointsBatch.mockResolvedValue(undefined);

    pointService.onEligibleMessage("u1");

    await pointService.shutdown();

    expect(mocks.addPointsBatch).toHaveBeenCalled();
    expect(cache.get("u1")!.pending).toBe(0);
  });

  it("shutdown gives up after a bounded number of failed flushes", async () => {
    const { cache, pointService } = setup();
    mocks.addPointsBatch.mockRejectedValue(new Error("db down"));

    pointService.onEligibleMessage("u1");

    await pointService.shutdown();

    expect(mocks.addPointsBatch).toHaveBeenCalledTimes(MAX_FLUSH_ATTEMPTS);
    expect(cache.get("u1")!.pending).toBe(1); // kept in memory, not silently lost
  });
});
