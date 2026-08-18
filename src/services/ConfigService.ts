import { getAllConfig, seedDefaultConfig, setConfigValue } from "@/db/queries";
import type { BotConfig } from "@/types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ConfigService");

export const DEFAULT_COOLDOWN_MS = 20_000;
export const DEFAULT_FLUSH_INTERVAL_MS = 180_000;
export const DEFAULT_EVICTION_INTERVAL_MS = 300_000;
export const DEFAULT_STALE_MAX_AGE_MS = 600_000;
export const DEFAULT_ALLOW_CHANNEL_CHILDREN = true;

/**
 * Manages runtime configuration sourced from the Turso `config` table.
 *
 * Config is seeded with defaults and loaded into memory on startup. Use the
 * `set*` methods to update values at runtime — each persists to the database
 * and applies immediately (no restart or reload needed).
 */
export class ConfigService {
  private config: BotConfig = {
    cooldownMs: DEFAULT_COOLDOWN_MS,
    allowedChannelIds: new Set(),
    allowChannelChildren: DEFAULT_ALLOW_CHANNEL_CHILDREN,
    flushIntervalMs: DEFAULT_FLUSH_INTERVAL_MS,
    evictionIntervalMs: DEFAULT_EVICTION_INTERVAL_MS,
    cacheStaleMaxAgeMs: DEFAULT_STALE_MAX_AGE_MS,
  };

  /**
   * Seed defaults, then load config from the database into memory.
   * Call once during bootstrap.
   */
  async init(): Promise<void> {
    await seedDefaultConfig();
    await this.reload();
    logger.info("ConfigService initialized", {
      cooldownMs: this.config.cooldownMs,
      allowedChannels: this.config.allowedChannelIds.size,
      allowChannelChildren: this.config.allowChannelChildren,
      flushIntervalMs: this.config.flushIntervalMs,
      evictionIntervalMs: this.config.evictionIntervalMs,
      cacheStaleMaxAgeMs: this.config.cacheStaleMaxAgeMs,
    });
  }

  /**
   * Re-read all config rows from the database and update the in-memory config.
   */
  async reload(): Promise<void> {
    try {
      const rows = await getAllConfig();

      this.config.cooldownMs = this.parsePositiveInt(
        rows.get("cooldown_ms"),
        this.config.cooldownMs,
      );
      this.config.flushIntervalMs = this.parsePositiveInt(
        rows.get("flush_interval_ms"),
        this.config.flushIntervalMs,
      );
      this.config.evictionIntervalMs = this.parsePositiveInt(
        rows.get("eviction_interval_ms"),
        this.config.evictionIntervalMs,
      );
      this.config.cacheStaleMaxAgeMs = this.parsePositiveInt(
        rows.get("stale_max_age_ms"),
        this.config.cacheStaleMaxAgeMs,
      );
      this.config.allowChannelChildren = this.parseBoolean(
        rows.get("allow_channel_children"),
        this.config.allowChannelChildren,
      );

      // Parse allowed channels (JSON array of channel ID strings)
      const channelsRaw = rows.get("allowed_channels");
      if (channelsRaw) {
        try {
          const channelIds: unknown = JSON.parse(channelsRaw);
          if (
            Array.isArray(channelIds) &&
            channelIds.every((id): id is string => typeof id === "string")
          ) {
            this.config.allowedChannelIds = new Set(channelIds);
          } else {
            logger.warn(
              "allowed_channels config is not a string array, ignoring",
            );
          }
        } catch {
          logger.warn("Failed to parse allowed_channels config JSON");
        }
      }
    } catch (err) {
      logger.error("ConfigService.reload failed", err);
      // Keep the previous in-memory config — never downgrade to defaults on transient failure
    }
  }

  // ─── Accessors ──────────────────────────────────────────────────────

  getCooldownMs(): number {
    return this.config.cooldownMs;
  }

  getFlushIntervalMs(): number {
    return this.config.flushIntervalMs;
  }

  getEvictionIntervalMs(): number {
    return this.config.evictionIntervalMs;
  }

  getCacheStaleMaxAgeMs(): number {
    return this.config.cacheStaleMaxAgeMs;
  }

  getAllowChannelChildren(): boolean {
    return this.config.allowChannelChildren;
  }

  /**
   * Check whether a channel is eligible for point awards.
   * If no channels are explicitly configured, ALL channels are allowed.
   */
  isChannelAllowed(channelId: string): boolean {
    if (this.config.allowedChannelIds.size === 0) return true;
    return this.config.allowedChannelIds.has(channelId);
  }

  /**
   * Snapshot of the current config for debugging/health checks.
   */
  getSnapshot(): Readonly<BotConfig> {
    return {
      cooldownMs: this.config.cooldownMs,
      allowedChannelIds: new Set(this.config.allowedChannelIds),
      allowChannelChildren: this.config.allowChannelChildren,
      flushIntervalMs: this.config.flushIntervalMs,
      evictionIntervalMs: this.config.evictionIntervalMs,
      cacheStaleMaxAgeMs: this.config.cacheStaleMaxAgeMs,
    };
  }

  // ─── Mutators ───────────────────────────────────────────────────────

  /**
   * Update the per-user point cooldown. Persists to DB and applies immediately.
   */
  async setCooldownMs(value: number): Promise<void> {
    this.config.cooldownMs = await this.persistPositiveInt(
      "cooldown_ms",
      value,
    );
  }

  /**
   * Update the background flush interval. Persists to DB and applies immediately.
   */
  async setFlushIntervalMs(value: number): Promise<void> {
    this.config.flushIntervalMs = await this.persistPositiveInt(
      "flush_interval_ms",
      value,
    );
  }

  /**
   * Update the cache-eviction sweep interval. Persists to DB and applies immediately.
   */
  async setEvictionIntervalMs(value: number): Promise<void> {
    this.config.evictionIntervalMs = await this.persistPositiveInt(
      "eviction_interval_ms",
      value,
    );
  }

  /**
   * Update the cache stale max-age. Persists to DB and applies immediately.
   */
  async setCacheStaleMaxAgeMs(value: number): Promise<void> {
    this.config.cacheStaleMaxAgeMs = await this.persistPositiveInt(
      "stale_max_age_ms",
      value,
    );
  }

  /**
   * Update the channel allowlist (empty array = all channels allowed).
   * Persists to DB and applies immediately.
   */
  async setAllowedChannels(channelIds: string[]): Promise<void> {
    await setConfigValue("allowed_channels", JSON.stringify(channelIds));
    this.config.allowedChannelIds = new Set(channelIds);
  }

  /**
   * Toggle whether children of an allowed channel also count.
   * Persists to DB and applies immediately.
   */
  async setAllowChannelChildren(value: boolean): Promise<void> {
    await setConfigValue("allow_channel_children", String(value));
    this.config.allowChannelChildren = value;
  }

  // ─── Private ────────────────────────────────────────────────────────

  /**
   * Parse a positive-integer config value, falling back to `fallback` when
   * the raw value is missing or invalid.
   */
  private parsePositiveInt(raw: string | undefined, fallback: number): number {
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : fallback;
  }

  /**
   * Parse a boolean config value ("true"/"false"), falling back to `fallback`
   * when the raw value is missing or invalid.
   */
  private parseBoolean(raw: string | undefined, fallback: boolean): boolean {
    if (raw === undefined) return fallback;
    if (raw === "true") return true;
    if (raw === "false") return false;
    return fallback;
  }

  /**
   * Validate a positive integer, persist it under `key`, and return it.
   */
  private async persistPositiveInt(
    key: string,
    value: number,
  ): Promise<number> {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }
    await setConfigValue(key, String(value));
    return value;
  }
}
