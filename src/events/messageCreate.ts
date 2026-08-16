import type { Message } from "discord.js";
import type { PointService } from "@/services/PointService";
import type { ConfigService } from "@/services/ConfigService";

/**
 * Creates a messageCreate event handler.
 *
 * The handler does the minimum Discord-specific work (bot check, guild check,
 * channel allowlist check) and delegates all business logic to PointService.
 *
 * A message is eligible if its channel — or any ancestor (thread → text
 * channel → category) — is in the allowlist.
 */
export function createMessageHandler(
  pointService: PointService,
  configService: ConfigService,
): (message: Message) => void {
  return (message: Message): void => {
    // Ignore bots (including our own messages)
    if (message.author.bot) return;

    // Ignore DMs — points only apply in guild channels
    if (!message.guild) return;

    const channel = message.channel;
    if (channel.isDMBased()) return; // narrows to guild channels

    // Check if the channel or any of its ancestors is in the allowlist (thread → text → category).
    let current: typeof channel | typeof channel.parent | null = channel;

    while (current && !configService.isChannelAllowed(current.id)) {
      current = current.parent;
    }

    if (!current) return;

    // Delegate to the service — it handles cooldown, caching, etc.
    pointService.onEligibleMessage(message.author.id);
  };
}
