import type { Message } from "discord.js";
import type { PointService } from "@/services/PointService";
import type { ConfigService } from "@/services/ConfigService";

/**
 * Creates a messageCreate event handler.
 *
 * The handler does the minimum Discord-specific work (bot check, guild check,
 * channel allowlist check) and delegates all business logic to PointService.
 *
 * A message is eligible when its channel is in the allowlist. When
 * `allowChannelChildren` is enabled (the default), a message is also eligible
 * if any ancestor (thread → text channel → category) is in the allowlist.
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

    // An exact channel match always counts.
    if (configService.isChannelAllowed(channel.id)) {
      pointService.onEligibleMessage(message.author.id);
      return;
    }

    // When disabled, only exact allowlist matches count — no ancestor walk.
    if (!configService.getAllowChannelChildren()) return;

    // Check whether any ancestor (thread → text → category) is allowlisted.
    let current = channel.parent;

    while (current && !configService.isChannelAllowed(current.id)) {
      current = current.parent;
    }

    if (!current) return;

    // Delegate to the service — it handles cooldown, caching, etc.
    pointService.onEligibleMessage(message.author.id);
  };
}
