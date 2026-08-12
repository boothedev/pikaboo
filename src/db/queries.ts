import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { users, config } from "./schema";
import { PendingCount } from "@/types";

// ─── Points ────────────────────────────────────────────────────────────

/**
 * Atomically add points to a user.
 * Inserts the user row if it doesn't exist (upsert).
 * Returns the new total.
 */
export async function addPoints(
  userId: string,
  amount: number,
): Promise<number> {
  const db = getDb();
  const result = await db
    .insert(users)
    .values({ userId, points: amount })
    .onConflictDoUpdate({
      target: users.userId,
      set: { points: sql`${users.points} + ${amount}` },
    })
    .returning({ points: users.points })
    .get();

  return result.points;
}

export async function addPointsBatch(data: Array<PendingCount>) {
  function isNonEmpty<T>(arr: T[]): arr is [T, ...T[]] {
    return arr.length > 0;
  }

  const db = getDb();

  const addPointsQueries = data.map(({ userId, pending: amount }) =>
    db
      .insert(users)
      .values({ userId, points: amount })
      .onConflictDoUpdate({
        target: users.userId,
        set: { points: sql`${users.points} + ${amount}` },
      }),
  );

  if (isNonEmpty(addPointsQueries)) {
    await db.batch(addPointsQueries);
  }
}

/**
 * Get the current point total for a single user (DB only, excludes pending cache).
 */
export async function getPoints(userId: string): Promise<number> {
  const db = getDb();
  const row = await db
    .select({ points: users.points })
    .from(users)
    .where(eq(users.userId, userId))
    .get();

  return row?.points ?? 0;
}

// ─── Configuration ─────────────────────────────────────────────────────

/**
 * Read a single config value by key.
 * Returns undefined if the key does not exist.
 */
export async function getConfigValue(key: string): Promise<string | undefined> {
  const db = getDb();
  const row = await db
    .select({ value: config.value })
    .from(config)
    .where(eq(config.key, key))
    .get();

  return row?.value;
}

/**
 * Read all config rows as a Map.
 */
export async function getAllConfig(): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db.select().from(config).all();
  const result = new Map<string, string>();
  for (const row of rows) {
    result.set(row.key, row.value);
  }
  return result;
}

/**
 * Upsert a single config key-value pair.
 */
export async function setConfigValue(
  key: string,
  value: string,
): Promise<void> {
  const db = getDb();
  await db.insert(config).values({ key, value }).onConflictDoUpdate({
    target: config.key,
    set: { value },
  });
}

/**
 * Initialize default config values if they don't already exist.
 * Safe to call on every startup.
 */
export async function seedDefaultConfig(): Promise<void> {
  const defaults: Record<string, string> = {
    cooldown_ms: "20000",
    allowed_channels: "[]",
    flush_interval_ms: "180000",
    eviction_interval_ms: "300000",
    stale_max_age_ms: "600000",
  };

  for (const [key, value] of Object.entries(defaults)) {
    const existing = await getConfigValue(key);
    if (existing === undefined) {
      await setConfigValue(key, value);
    }
  }
}
