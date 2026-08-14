import type { Message } from "discord.js";
import type { PointService } from "@/services/PointService";
import type { ConfigService } from "@/services/ConfigService";

/**
 * Creates a messageCreate event handler.
 *
 * The handler does the minimum Discord-specific work (bot check, guild check,
 * channel allowlist check) and delegates all business logic to PointService.
 *
 * This keeps Discord concerns separate from point-awarding rules.
 */
export function createMessageHandler(
  pointService: PointService,
  configService: ConfigService,
): (message: Message) => Promise<void> {
  return async (message: Message): Promise<void> => {
    // Ignore bots (including our own messages)
    if (message.author.bot) return;

    // Ignore DMs — points only apply in guild channels
    if (!message.guild) return;

    // Check channel allowlist
    if (!configService.isChannelAllowed(message.channel.id)) return;

    // Delegate to the service — it handles cooldown, caching, etc.
    pointService.onEligibleMessage(message.author.id);
  };
}
