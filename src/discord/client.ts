import { Client, GatewayIntentBits, Options } from "discord.js";

/**
 * Cache limits applied to the Discord client.
 *
 * Most manager caches are disabled (set to `0`) to keep memory usage low,
 * since the bot only needs message/author data at runtime. Enable a specific
 * cache here when a feature needs to read it from memory — for example, set
 * `UserManager` to a positive number to resolve users via `client.users.cache`.
 *
 * NOTE: some managers are not cache-limited by discord.js and are always fully
 * cached (guilds, channels, roles, etc.) — see the `// Non-exist` markers below.
 */
export const clientCacheOptions = Options.cacheWithLimits({
  ApplicationCommandManager: 0,
  ApplicationEmojiManager: 0,
  AutoModerationRuleManager: 0,
  BaseGuildEmojiManager: 0,
  // Non-exist: ChannelManager: inf,
  DMMessageManager: 0,
  EntitlementManager: 0,
  GuildBanManager: 0,
  // Non-exist: GuildChannelManager: inf,
  GuildEmojiManager: 0,
  GuildForumThreadManager: 0,
  GuildInviteManager: 0,
  // Non-exist: GuildManager: inf,
  GuildMemberManager: 0,
  GuildMessageManager: 0,
  GuildScheduledEventManager: 0,
  GuildStickerManager: 0,
  GuildTextThreadManager: 0,
  MessageManager: 0,
  // Non-exist: PermissionOverwriteManager: inf,
  PresenceManager: 0,
  ReactionManager: 0,
  ReactionUserManager: 0,
  // Non-exist: RoleManager: inf,
  StageInstanceManager: 0,
  ThreadManager: 0,
  ThreadMemberManager: 0,
  UserManager: 0,
  VoiceStateManager: 0,
});

/**
 * Create a new Discord client with the bot's standard intents and cache policy.
 *
 * Use this factory when you need an isolated client instance (e.g. tests or
 * additional shards). The bot's main client is exported as {@link client}.
 */
export function createClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
    makeCache: clientCacheOptions,
  });
}

/**
 * The shared Discord client instance for the bot.
 *
 * Import this anywhere you need to interact with Discord, including its
 * caches — for example:
 *
 * ```ts
 * import { client } from "@/discord/client";
 *
 * const guild = client.guilds.cache.get(guildId);
 * const user = client.users.cache.get(userId);
 * ```
 */
export const client = createClient();
