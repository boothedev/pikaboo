import type { Message } from "discord.js";
import type { PointService } from "@/services/PointService";
import type { ConfigService } from "@/services/ConfigService";
import type { ChannelHierarchy } from "@/cache/ChannelHierarchy";

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
  hierarchy: ChannelHierarchy,
): (message: Message) => Promise<void> {
  return async (message: Message): Promise<void> => {
    // Ignore bots (including our own messages)
    if (message.author.bot) return;

    // Ignore DMs — points only apply in guild channels
    if (!message.guild) return;

    const channel = message.channel;
    if (channel.isDMBased()) return; // narrows to guild channels (have parentId)

    const candidateIds = hierarchy.getSelfAndAncestors(
      channel.id,
      channel.parentId,
    );
    if (!candidateIds.some((id) => configService.isChannelAllowed(id))) return;

    // Delegate to the service — it handles cooldown, caching, etc.
    await pointService.onEligibleMessage(message.author.id);
  };
}
