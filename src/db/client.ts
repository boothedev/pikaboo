import { drizzle } from "drizzle-orm/libsql";
import { env } from "@/utils/env";

export type DbClient = ReturnType<typeof drizzle>;

let db: DbClient | undefined;

export function getDb(): DbClient {
  if (!db) {
    db = drizzle({
      connection: {
        url: env("TURSO_CONNECTION_URL"),
        authToken: env("TURSO_AUTH_TOKEN"),
      },
    });
  }
  return db;
}
