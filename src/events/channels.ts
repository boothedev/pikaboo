import { Client, Events, type Guild } from "discord.js";
import type { ChannelHierarchy } from "@/cache/ChannelHierarchy";
import { createLogger } from "@/utils/logger";

const logger = createLogger("ChannelEvents");

function loadGuild(hierarchy: ChannelHierarchy, guild: Guild): void {
  for (const channel of guild.channels.cache.values()) {
    hierarchy.setParent(channel.id, channel.parentId);
  }
  logger.debug(
    `Loaded ${guild.channels.cache.size} channel(s)/thread(s) for guild ${guild.id}`,
  );
}

/**
 * Keeps a ChannelHierarchy in sync with Discord's channel/thread lifecycle:
 * - Initial population from all cached guilds (channels + active threads).
 * - CHANNEL_CREATE / CHANNEL_UPDATE / CHANNEL_DELETE
 * - THREAD_CREATE / THREAD_UPDATE / THREAD_DELETE / THREAD_LIST_SYNC
 */
export function registerChannelEvents(
  client: Client,
  hierarchy: ChannelHierarchy,
): void {
  // Guilds cached before `ready` are not re-emitted as GuildCreate, so do the
  // initial population here.
  client.once(Events.ClientReady, () => {
    for (const guild of client.guilds.cache.values()) {
      loadGuild(hierarchy, guild);
    }
  });

  // Guilds joined while the bot is running.
  client.on(Events.GuildCreate, (guild) => loadGuild(hierarchy, guild));

  client.on(Events.GuildDelete, (guild) => {
    for (const channel of guild.channels.cache.values()) {
      hierarchy.remove(channel.id);
    }
  });

  client.on(Events.ChannelCreate, (channel) => {
    if (!channel.isDMBased()) {
      hierarchy.setParent(channel.id, channel.parentId);
    }
  });
  client.on(Events.ChannelUpdate, (_oldChannel, newChannel) => {
    if (!newChannel.isDMBased()) {
      hierarchy.setParent(newChannel.id, newChannel.parentId);
    }
  });
  client.on(Events.ChannelDelete, (channel) => hierarchy.remove(channel.id));

  client.on(Events.ThreadCreate, (thread) =>
    hierarchy.setParent(thread.id, thread.parentId),
  );
  client.on(Events.ThreadUpdate, (_oldThread, newThread) =>
    hierarchy.setParent(newThread.id, newThread.parentId),
  );
  client.on(Events.ThreadDelete, (thread) => hierarchy.remove(thread.id));
  client.on(Events.ThreadListSync, (threads) => {
    for (const thread of threads.values()) {
      hierarchy.setParent(thread.id, thread.parentId);
    }
  });
}
