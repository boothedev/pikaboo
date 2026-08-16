import { Client, GatewayIntentBits, Events, Options } from "discord.js";
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

// ─── Discord client ────────────────────────────────────────────────────

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  makeCache: Options.cacheWithLimits({
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
  }),
});

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
