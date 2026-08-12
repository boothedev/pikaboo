import type { ActiveUser, PendingCount } from "@/types";

/**
 * In-memory cache of users who have recently earned points.
 *
 * Purpose: avoid hitting the database on every message. Points accumulate
 * in `pending` and are flushed to TursoDb in batches by PointService.
 *
 * Thread safety: discord.js event handlers run sequentially per shard,
 * and the flusher runs on a single interval — no concurrent mutations.
 */
export class ActiveUserCache {
  private cache = new Map<string, ActiveUser>();

  /**
   * Retrieve a cached user entry, or undefined if never seen this session.
   */
  get(userId: string): ActiveUser | undefined {
    return this.cache.get(userId);
  }

  /**
   * Retrieve an existing entry or create a fresh one with lastEarn=0, pending=0.
   */
  getOrCreate(userId: string): ActiveUser {
    let entry = this.cache.get(userId);
    if (!entry) {
      entry = { lastEarn: 0, pending: 0 };
      this.cache.set(userId, entry);
    }
    return entry;
  }

  /**
   * Overwrite the entry for a user.
   */
  set(userId: string, data: ActiveUser): void {
    this.cache.set(userId, data);
  }

  /**
   * Return every user who has unflushed points, along with their pending count.
   * The caller is responsible for flushing and calling updatePendingAfterFlush() on success.
   */
  getPendingUsers(): Array<PendingCount> {
    const result: Array<PendingCount> = [];
    for (const [userId, data] of this.cache) {
      if (data.pending > 0) {
        result.push({ userId, pending: data.pending });
      }
    }
    return result;
  }

  /**
   * Update pending points after a successful batch flush.
   */
  updatePendingAfterFlush(prevPending: Array<PendingCount>): void {
    for (const { userId, pending } of prevPending) {
      const entry = this.cache.get(userId);
      if (entry) {
        entry.pending -= pending;
      }
    }
  }

  /**
   * Remove stale entries (no pending points and haven't earned recently).
   * Called periodically to prevent unbounded memory growth.
   */
  evictStale(maxAgeMs: number): number {
    const now = Date.now();
    let evicted = 0;

    for (const [userId, data] of this.cache) {
      if (data.pending === 0 && now - data.lastEarn > maxAgeMs) {
        this.cache.delete(userId);
        evicted++;
      }
    }

    return evicted;
  }

  /** Number of cached users. */
  get size(): number {
    return this.cache.size;
  }
}
