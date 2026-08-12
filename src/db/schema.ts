import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Stores per-user point totals.
 * userId is the Discord snowflake ID string.
 */
export const users = sqliteTable("users", {
  userId: text("user_id").primaryKey(),
  points: integer("points").notNull().default(0),
});

/**
 * Key-value configuration table.
 * Keys like 'cooldown_ms' and 'allowed_channels' control bot behavior at runtime.
 */
export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Stores user's role.
 * userId and roleId are the Discord snowflake ID strings.
 * expiresAt is time point when the role expires.
 * isAutorenew is the config from user to renew the role automatically.
 */
export const roles = sqliteTable("roles", {
  userId: text("user_id").primaryKey(),
  roleId: text("role_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  isAutorenew: integer("is_autorenew").notNull().default(0),
});
