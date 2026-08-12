/**
 * Tracks a user's in-memory point-earning state.
 * Not persisted — lost on restart (acceptable per requirements).
 */
export interface ActiveUser {
  /** Timestamp (ms) of the last point that was awarded. */
  lastEarn: number;
  /** Points earned since the last flush to the database. */
  pending: number;
}

export interface PendingCount {
  userId: string;
  pending: number;
}

/**
 * Parsed, cached view of the live bot configuration.
 * Loaded from the `config` table by ConfigService.
 */
export interface BotConfig {
  /** Minimum milliseconds between point awards per user. */
  cooldownMs: number;
  /** Channels where messages earn points. Empty set = all channels allowed. */
  allowedChannelIds: Set<string>;
  /** Milliseconds between background DB flush batches. */
  flushIntervalMs: number;
  /** How often stale cache entries are checked for eviction. */
  evictionIntervalMs: number;
  /** Idle time (ms) after which a user with no pending points is evicted. */
  cacheStaleMaxAgeMs: number;
}

/**
 * A single row from the config table (raw form).
 */
export interface ConfigEntry {
  key: string;
  value: string;
}
