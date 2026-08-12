import { ActiveUserCache } from "@/cache/ActiveUserCache";
import { ConfigService } from "./ConfigService";
import * as queries from "@/db/queries";
import { createLogger } from "@/utils/logger";

const logger = createLogger("PointService");

/** Maximum number of flush attempts during shutdown before giving up. */
export const MAX_FLUSH_ATTEMPTS = 3;

/**
 * Core business logic for awarding, tracking, and persisting points.
 *
 * Responsibilities:
 * - Cooldown enforcement (via ConfigService)
 * - In-memory pending-cache management
 * - Periodic background flush to TursoDb
 * - Point queries (combining DB totals + pending cache)
 * - Future extension points for redemptions, multiple sources, etc.
 *
 * Discord handlers call `onEligibleMessage()` — everything else is internal.
 */
export class PointService extends EventTarget {
  private flushTimer: NodeJS.Timeout | null = null;
  private evictionTimer: NodeJS.Timeout | null = null;
  private flushing: boolean = false;
  private running: boolean = false;

  constructor(
    private cache: ActiveUserCache,
    private configService: ConfigService,
  ) {
    super();
  }

  // ─── Public API for Discord handlers ────────────────────────────────

  /**
   * Called when a user sends a message in an eligible channel.
   * Runs the cooldown check and awards a pending point if eligible.
   * O(1) — no DB writes, no async I/O beyond the cache map.
   */
  onEligibleMessage(userId: string): void {
    const now = Date.now();
    const active = this.cache.getOrCreate(userId);

    if (now - active.lastEarn >= this.configService.getCooldownMs()) {
      active.lastEarn = now;
      active.pending += 1;
    }
  }

  /**
   * Get a user's total points (database total + pending).
   */
  async getPoints(userId: string): Promise<number> {
    const dbPoints = await queries.getPoints(userId);
    const pending = this.cache.get(userId)?.pending ?? 0;
    return dbPoints + pending;
  }

  /**
   * Add points directly from an external source (reactions, voice, giveaways, admin commands).
   * Bypasses cooldown — use for events that have their own rate-limiting.
   * Points go directly to DB (no pending cache) for durability.
   */
  async awardPoints(
    userId: string,
    amount: number,
    source: string,
  ): Promise<number> {
    logger.info(`Awarding ${amount} points to ${userId} from ${source}`);
    return queries.addPoints(userId, amount);
  }

  // ─── Background flush ───────────────────────────────────────────────

  /**
   * Start the periodic flush and cache-eviction loops.
   * Call once during bootstrap.
   */
  startBackgroundTasks(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleFlush();
    this.scheduleEviction();
    logger.info("Background tasks started (flush + cache eviction)");
  }

  /**
   * Stop all background timers. Call during graceful shutdown.
   */
  stopBackgroundTasks(): void {
    this.running = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.evictionTimer) {
      clearTimeout(this.evictionTimer);
      this.evictionTimer = null;
    }
  }

  /**
   * Flush all pending points to the database.
   * Each user is updated individually — a single failure does not block the rest.
   * Returns the number of users successfully flushed.
   */
  async flushPending(): Promise<number> {
    const pendingUsers = this.cache.getPendingUsers();
    if (pendingUsers.length === 0 || this.flushing) return 0;

    this.flushing = true;
    let flushedCount = 0;

    try {
      await queries.addPointsBatch(pendingUsers);
      this.cache.updatePendingAfterFlush(pendingUsers);
      flushedCount = pendingUsers.length;
      logger.debug(`Flushed ${flushedCount} user(s) to DB`);
    } catch (err) {
      logger.error(`Flush failed for users`, err);
    }

    this.flushing = false;
    this.dispatchEvent(new Event("flushed"));

    return flushedCount;
  }

  /**
   * Perform a final flush and stop timers.
   * Retries are bounded so a down database cannot hang shutdown.
   */
  async shutdown(): Promise<void> {
    this.stopBackgroundTasks();

    for (let attempt = 0; attempt < MAX_FLUSH_ATTEMPTS; attempt++) {
      if (this.flushing) {
        await new Promise<void>((r) =>
          this.addEventListener("flushed", () => r(), { once: true }),
        );
      }
      if (this.cache.getPendingUsers().length === 0) break;
      await this.flushPending();
    }

    if (this.cache.getPendingUsers().length > 0) {
      logger.warn(
        `Shutting down with ${this.cache.getPendingUsers().length} user(s) still pending`,
      );
    }

    logger.info("PointService shut down");
  }

  // ─── Private ────────────────────────────────────────────────────────

  /**
   * Schedule the next flush using the current (possibly reloaded) interval.
   * Re-arms after each cycle so config changes take effect per turn.
   */
  private scheduleFlush(): void {
    if (!this.running) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPending()
        .catch((err) => {
          logger.error("Flush cycle failed", err);
        })
        .finally(() => this.scheduleFlush());
    }, this.configService.getFlushIntervalMs());
  }

  /**
   * Schedule the next eviction sweep using the current (possibly reloaded)
   * interval. Re-arms after each sweep so config changes take effect per turn.
   * Periodically removes cache entries for users who have no pending points
   * and haven't earned any recently. Prevents unbounded memory growth.
   */
  private scheduleEviction(): void {
    if (!this.running) return;

    this.evictionTimer = setTimeout(() => {
      this.evictionTimer = null;

      const evicted = this.cache.evictStale(
        this.configService.getCacheStaleMaxAgeMs(),
      );
      if (evicted > 0) {
        logger.debug(
          `Evicted ${evicted} stale cache entries (size now: ${this.cache.size})`,
        );
      }

      this.scheduleEviction();
    }, this.configService.getEvictionIntervalMs());
  }
}
