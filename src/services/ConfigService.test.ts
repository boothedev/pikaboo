import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ConfigService,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_FLUSH_INTERVAL_MS,
  DEFAULT_EVICTION_INTERVAL_MS,
  DEFAULT_STALE_MAX_AGE_MS,
  DEFAULT_ALLOW_CHANNEL_CHILDREN,
} from "./ConfigService";

const mocks = vi.hoisted(() => ({
  getAllConfig: vi.fn(),
  seedDefaultConfig: vi.fn(),
  setConfigValue: vi.fn(),
}));

vi.mock("@/db/queries", () => mocks);

describe("ConfigService", () => {
  beforeEach(() => {
    mocks.getAllConfig.mockReset();
    mocks.seedDefaultConfig.mockReset();
    mocks.setConfigValue.mockReset();
    mocks.seedDefaultConfig.mockResolvedValue(undefined);
    mocks.setConfigValue.mockResolvedValue(undefined);
  });

  it("has sensible defaults before init", () => {
    const service = new ConfigService();

    expect(service.getCooldownMs()).toBe(DEFAULT_COOLDOWN_MS);
    expect(service.getFlushIntervalMs()).toBe(DEFAULT_FLUSH_INTERVAL_MS);
    expect(service.getEvictionIntervalMs()).toBe(DEFAULT_EVICTION_INTERVAL_MS);
    expect(service.getCacheStaleMaxAgeMs()).toBe(DEFAULT_STALE_MAX_AGE_MS);
    expect(service.getAllowChannelChildren()).toBe(
      DEFAULT_ALLOW_CHANNEL_CHILDREN,
    );
    // Empty allowlist means all channels are allowed.
    expect(service.isChannelAllowed("any")).toBe(true);
  });

  it("loads config from the database on init", async () => {
    mocks.getAllConfig.mockResolvedValue(
      new Map([
        ["cooldown_ms", "10000"],
        ["flush_interval_ms", "60000"],
        ["allow_channel_children", "false"],
        ["allowed_channels", '["111", "222"]'],
      ]),
    );

    const service = new ConfigService();
    await service.init();

    expect(service.getCooldownMs()).toBe(10_000);
    expect(service.getFlushIntervalMs()).toBe(60_000);
    expect(service.getAllowChannelChildren()).toBe(false);
    expect(service.isChannelAllowed("111")).toBe(true);
    expect(service.isChannelAllowed("333")).toBe(false);
  });

  it("ignores invalid values and keeps the previous config", async () => {
    mocks.getAllConfig.mockResolvedValue(
      new Map([
        ["cooldown_ms", "not-a-number"],
        ["flush_interval_ms", "-5"],
        ["allow_channel_children", "not-a-bool"],
        ["allowed_channels", "not json"],
      ]),
    );

    const service = new ConfigService();
    await service.reload();

    expect(service.getCooldownMs()).toBe(DEFAULT_COOLDOWN_MS);
    expect(service.getFlushIntervalMs()).toBe(DEFAULT_FLUSH_INTERVAL_MS);
    expect(service.getAllowChannelChildren()).toBe(
      DEFAULT_ALLOW_CHANNEL_CHILDREN,
    );
    expect(service.isChannelAllowed("any")).toBe(true);
  });

  it("setCooldownMs persists and applies immediately", async () => {
    const service = new ConfigService();
    await service.setCooldownMs(5_000);

    expect(service.getCooldownMs()).toBe(5_000);
    expect(mocks.setConfigValue).toHaveBeenCalledWith("cooldown_ms", "5000");
  });

  it("rejects non-positive integer values", async () => {
    const service = new ConfigService();

    await expect(service.setFlushIntervalMs(0)).rejects.toThrow(
      "flush_interval_ms must be a positive integer",
    );
    await expect(service.setCooldownMs(3.5)).rejects.toThrow(
      "cooldown_ms must be a positive integer",
    );

    expect(mocks.setConfigValue).not.toHaveBeenCalled();
  });

  it("setAllowedChannels persists and applies immediately", async () => {
    const service = new ConfigService();
    await service.setAllowedChannels(["111", "222"]);

    expect(service.isChannelAllowed("111")).toBe(true);
    expect(service.isChannelAllowed("999")).toBe(false);
    expect(mocks.setConfigValue).toHaveBeenCalledWith(
      "allowed_channels",
      '["111","222"]',
    );
  });

  it("setAllowChannelChildren persists and applies immediately", async () => {
    const service = new ConfigService();
    await service.setAllowChannelChildren(false);

    expect(service.getAllowChannelChildren()).toBe(false);
    expect(mocks.setConfigValue).toHaveBeenCalledWith(
      "allow_channel_children",
      "false",
    );
  });
});
