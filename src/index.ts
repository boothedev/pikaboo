import { Events } from "discord.js";
import type { Client } from "discord.js";
import { client } from "@/discord/client";
import { ActiveUserCache } from "@/cache/ActiveUserCache";
import { ConfigService } from "@/services/ConfigService";
import { PointService } from "@/services/PointService";
import { onReady } from "@/events/ready";
import { createMessageHandler } from "@/events/messageCreate";
import { createLogger } from "@/utils/logger";
import { env } from "@/utils/env";

const logger = createLogger("Bootstrap");

// ─── Bootstrap services ────────────────────────────────────────────────

const cache = new ActiveUserCache();
const configService = new ConfigService();
const pointService = new PointService(cache, configService);

// ─── Register events ───────────────────────────────────────────────────

client.once(Events.ClientReady, (readyClient: Client<true>) => {
  onReady(readyClient);
});

const handleMessage = createMessageHandler(pointService, configService);
client.on(Events.MessageCreate, handleMessage);

// ─── Graceful shutdown ─────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  await pointService.shutdown();
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ─── Start ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  try {
    // Initialize config (seeds default values, loads from DB into memory)
    await configService.init();

    // Start periodic point flushing and cache eviction
    pointService.startBackgroundTasks();

    // Verify database connection
    logger.info("Database connected");

    // Connect to Discord
    await client.login(env("DISCORD_TOKEN"));
  } catch (err) {
    logger.error("Failed to start bot", err);
    process.exit(1);
  }
}

main();
