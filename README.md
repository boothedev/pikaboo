# Pikaboo — Discord Points Bot

A Discord bot that awards points to users for chatting. Built with TypeScript, discord.js, Drizzle ORM, and Turso (libSQL, SQLite-compatible).

## Features

- **1 point per message** in configured channels
- **Configurable cooldown** (default 20s) — prevents spam farming
- **In-memory caching** — no DB writes on every message
- **Background flush** — batches pending points to the database (default every 3 minutes)
- **Runtime config** — update settings on the fly via the bot (persisted and applied immediately)
- **Channel allowlist** — restrict point earning to specific channels
- **Admin slash commands** — `/pikaboo-admin` for config editing and point management (Administrator only)
- **Extensible** — designed for future redemptions, leaderboards, and more

## Architecture

```
Discord Events → PointService → ActiveUserCache (in-memory)
                        ↓
                   Drizzle ORM
                        ↓
                 Turso (libSQL)
```

- **Discord handlers** contain minimal logic — just filtering and delegation
- **PointService** owns all business rules (cooldown, caching, flushing)
- **ConfigService** loads config at startup and exposes setters for runtime updates
- **Database layer** (`src/db/queries.ts`) contains all Drizzle queries in one place

## Prerequisites

- **Node.js** ≥ 22
- **pnpm** ≥ 9
- A Discord bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- A [Turso](https://turso.tech) database (connection URL + auth token)

### Discord Bot Setup

1. Create a new application at the Discord Developer Portal
2. Go to the **Bot** tab and click "Add Bot"
3. Copy the bot token
4. Use the OAuth2 URL Generator to invite the bot to your server with these scopes:
   - `bot`
   - `applications.commands` (for future slash commands)

   Required bot permission: `View Channels` (needed to receive message events).
   The bot never sends messages or reads history, so `Send Messages` and
   `Read Message History` are not required.

   The bot uses the `GuildMessages` gateway intent only. No privileged intents are required
   (the bot never reads message content). If you add content-based features later, enable the
   **Message Content Intent**.

### Turso Setup

1. Create a database at [turso.tech](https://turso.tech)
2. Copy the **connection URL** (e.g. `libsql://<name>-<org>.turso.io`)
3. Create an **auth token** (e.g. `turso db tokens create <db-name>`)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/boothedev/pikaboo.git && cd pikaboo
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env and add DISCORD_TOKEN, TURSO_CONNECTION_URL, and TURSO_AUTH_TOKEN

# 3. Create the database schema
pnpm db:migrate

# 4. Start in development mode
pnpm dev
```

## Project Structure

```
├── drizzle.config.ts        # Drizzle Kit configuration (Turso dialect)
├── migrations/              # Generated SQL migrations
└── src/
    ├── index.ts             # Entry point — wires everything together
    ├── cache/
    │   └── ActiveUserCache.ts  # In-memory pending-points cache
    ├── commands/
    │   ├── index.ts            # Registry factory + public exports
    │   ├── registry.ts         # Generic command/component/modal routing
    │   ├── types.ts            # Command / component / modal handler types
    │   ├── guards.ts           # Reusable permission guards
    │   ├── admin.ts            # /pikaboo-admin command definition
    │   ├── config.ts           # config subcommand + config modal handlers
    │   ├── points.ts           # point subcommand (check/set/adjust)
    │   ├── ids.ts              # Shared command/modal identifiers
    │   └── parsing.ts          # Pure input-parsing helpers
    ├── db/
    │   ├── client.ts        # Drizzle + libSQL (Turso) client
    │   ├── schema.ts        # Drizzle table definitions
    │   └── queries.ts       # All database query functions
    ├── events/
    │   ├── ready.ts         # Discord ready event
    │   ├── messageCreate.ts # Discord message handler
    │   └── interactionCreate.ts # Generic interaction router (delegates to registry)
    ├── services/
    │   ├── ConfigService.ts # Runtime config management
    │   └── PointService.ts  # Core point-awarding logic
    ├── types/
    │   └── index.ts         # Shared TypeScript types
    └── utils/
        ├── env.ts           # Environment variable access
        └── logger.ts        # Structured logger
```

## Configuration

Configuration lives in the `config` table in Turso. On startup, defaults are seeded automatically and loaded into memory.

| Key | Value | Description |
|---|---|---|
| `cooldown_ms` | `20000` | Minimum milliseconds between point awards per user |
| `allowed_channels` | `[]` | JSON array of channel IDs (empty = all channels allowed) |
| `blacklisted_users` | `[]` | JSON array of user IDs who cannot earn points from messages |
| `allow_channel_children` | `true` | When true, threads and sub-channels of an allowed channel also earn points |
| `flush_interval_ms` | `180000` | Milliseconds between background DB flush batches (longer = larger durability window on crash) |
| `eviction_interval_ms` | `300000` | How often stale cache entries are checked for eviction |
| `stale_max_age_ms` | `600000` | Idle time (ms) after which a user with no pending points is evicted from the cache |

### Changing config

Configuration is updated at runtime through `ConfigService` setters (which the
bot will expose as commands). Each setter validates the value, persists it to
the database, and applies it immediately:

```ts
await configService.setCooldownMs(10_000);
await configService.setAllowedChannels(["123456789", "987654321"]);
await configService.setBlacklistedUsers(["111222333"]);
await configService.setAllowChannelChildren(false);
await configService.setFlushIntervalMs(60_000);
```

Timing values (`flush_interval_ms`, `eviction_interval_ms`, `stale_max_age_ms`)
are re-read at the start of each cycle, so an interval change takes effect after
the current cycle completes. `cooldown_ms`, `allowed_channels`,
`blacklisted_users`, and `allow_channel_children` apply to the next message.

Editing the `config` table directly with SQL still works, but requires a restart
to take effect.

## Slash Commands

Interactions are handled by a single `InteractionRegistry`, built by
`createInteractionRegistry()`. It indexes three independent handler collections
into `Map`s, each keyed by the interaction's natural routing key:

- slash commands → `commandName`
- button/select components → `customId`
- modal submits → `customId`

Modal submits are identified by nothing but their custom id (Discord does not
link them back to whatever opened them), so modal handlers are first-class:
they carry their own permission check rather than being nested under a command.
Commands, components, and modals each declare their own permission check, so
admin-only and regular-user interactions coexist without touching the router.
See `src/commands/`.

The bot currently registers a single global slash command, `/pikaboo-admin`,
restricted to members with the **Administrator** permission
(`setDefaultMemberPermissions`, plus a runtime check as defense-in-depth). All
responses are ephemeral.

| Command | Description |
|---|---|
| `/pikaboo-admin config main` | Opens a pre-filled modal to edit **public** config: point cooldown, allowed channels, child channels, and user blacklist |
| `/pikaboo-admin config internal` | Opens a pre-filled modal to edit **internal** timing config: flush, eviction, and stale-max-age intervals |
| `/pikaboo-admin point check <user>` | Shows a user's current point total |
| `/pikaboo-admin point set <user> <points>` | Sets a user's points to an exact non-negative value |
| `/pikaboo-admin point adjust <user> <delta>` | Adds (or, with a negative value, removes) points from a user |

### Config modals

Config values are split across two subcommands because Discord modals are
limited to 5 components. Each modal is pre-filled with the current config
values; submitting overwrites them (validated first, then persisted and applied
immediately through `ConfigService`). Each value uses the native component that
fits it best: text inputs for millisecond numbers, a channel select for allowed
channels, a checkbox for the child-channel toggle, and a user select for the
blacklist.

Point `set`/`adjust` flush any un-flushed pending points for that user first, so
the operation applies to the true current total. `adjust` clamps the result at
zero — points never go negative.

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start the bot with hot reload (tsx watch) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run the compiled bot |
| `pnpm db:push` | Push schema changes directly to the database |
| `pnpm db:generate` | Generate migration files from schema changes |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:studio` | Open Drizzle Studio (GUI database browser) |
| `pnpm typecheck` | Run TypeScript type-checking |
| `pnpm test` | Run tests (vitest) |
| `pnpm test:watch` | Run tests in watch mode |

## Database

This project uses **Turso** (libSQL), a SQLite-compatible managed database, via
`drizzle-orm/libsql` and the `turso` dialect in Drizzle Kit. The schema and migrations
live in `src/db/schema.ts` and `migrations/`.

```bash
pnpm db:generate  # Create migrations from schema changes
pnpm db:migrate   # Apply pending migrations to Turso
pnpm db:push      # Push schema directly (dev convenience)
pnpm db:studio    # Browse the database in a web UI
```

## Deployment

As a standalone Node.js process:

```bash
pnpm build
# Deploy dist/ to your server
# Set DISCORD_TOKEN, TURSO_CONNECTION_URL, and TURSO_AUTH_TOKEN environment variables
pnpm start
```

## License

ISC
