import type { Client } from "discord.js";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Ready");

/**
 * Fires once when the bot successfully connects to the Discord gateway.
 */
export function onReady(client: Client<true>): void {
  logger.info(
    `Ready! Logged in as ${client.user.displayName} (${client.user.id})`,
  );
}
