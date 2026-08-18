import {
  ChannelSelectMenuBuilder,
  CheckboxBuilder,
  LabelBuilder,
  ModalBuilder,
  SlashCommandSubcommandGroupBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  channelMention,
  userMention,
  type ModalSubmitInteraction,
} from "discord.js";
import type { ConfigService } from "@/services/ConfigService";
import { createLogger } from "@/utils/logger";
import { requireAdministrator } from "./guards";
import type { ModalHandler } from "./types";
import {
  CONFIG_GROUP,
  CONFIG_MAIN,
  CONFIG_INTERNAL,
  CONFIG_MAIN_MODAL_ID,
  CONFIG_INTERNAL_MODAL_ID,
  INPUT_COOLDOWN,
  INPUT_CHANNELS,
  INPUT_INHERIT,
  INPUT_BLACKLIST,
  INPUT_FLUSH,
  INPUT_EVICTION,
  INPUT_STALE,
} from "./ids";
import { parsePositiveInt } from "./parsing";

const logger = createLogger("ConfigCommands");

/**
 * Build the `config` subcommand group:
 *   /pikaboo-admin config main     → public config (cooldown, channels, inherit, blacklist)
 *   /pikaboo-admin config internal → internal timing config (flush, eviction, stale)
 */
export function buildConfigGroup(): SlashCommandSubcommandGroupBuilder {
  return new SlashCommandSubcommandGroupBuilder()
    .setName(CONFIG_GROUP)
    .setDescription("View and edit bot configuration")
    .addSubcommand((sub) =>
      sub
        .setName(CONFIG_MAIN)
        .setDescription(
          "Edit public config: point cooldown, allowed channels, child channels, user blacklist",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName(CONFIG_INTERNAL)
        .setDescription(
          "Edit internal timing config: flush, eviction, and stale intervals",
        ),
    );
}

// ─── Modals ────────────────────────────────────────────────────────────
//
// Discord modals support at most 5 components. Each config value uses the
// native component type that fits it best: text inputs for millisecond
// numbers, a channel select for allowed channels, a checkbox for the
// child-channel toggle, and a user select for the blacklist. Every component
// is pre-filled with the current config value.

/** Pre-filled modal for the "main" (public) config values. */
export function buildConfigMainModal(
  configService: ConfigService,
): ModalBuilder {
  const snapshot = configService.getSnapshot();

  return new ModalBuilder()
    .setCustomId(CONFIG_MAIN_MODAL_ID)
    .setTitle("Edit main config")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Point cooldown (ms)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(INPUT_COOLDOWN)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Positive whole number, e.g. 20000")
            .setMinLength(1)
            .setMaxLength(10)
            .setValue(String(configService.getCooldownMs()))
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel("Allowed channels")
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId(INPUT_CHANNELS)
            .setPlaceholder("Leave empty = all channels")
            .setDefaultChannels([...snapshot.allowedChannelIds])
            .setMaxValues(25)
            .setRequired(false),
        ),
      new LabelBuilder()
        .setLabel("Count child channels?")
        .setCheckboxComponent(
          new CheckboxBuilder()
            .setCustomId(INPUT_INHERIT)
            .setDefault(configService.getAllowChannelChildren()),
        ),
      new LabelBuilder()
        .setLabel("Blacklisted users")
        .setUserSelectMenuComponent(
          new UserSelectMenuBuilder()
            .setCustomId(INPUT_BLACKLIST)
            .setPlaceholder("Leave empty = no blacklist")
            .setDefaultUsers([...snapshot.blacklistedUserIds])
            .setMaxValues(25)
            .setRequired(false),
        ),
    );
}

/** Pre-filled modal for the "internal" timing config values. */
export function buildConfigInternalModal(
  configService: ConfigService,
): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(CONFIG_INTERNAL_MODAL_ID)
    .setTitle("Edit internal config")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Flush interval (ms)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(INPUT_FLUSH)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Positive whole number, e.g. 180000")
            .setMinLength(1)
            .setMaxLength(10)
            .setValue(String(configService.getFlushIntervalMs()))
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel("Eviction interval (ms)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(INPUT_EVICTION)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Positive whole number, e.g. 300000")
            .setMinLength(1)
            .setMaxLength(10)
            .setValue(String(configService.getEvictionIntervalMs()))
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel("Stale max age (ms)")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(INPUT_STALE)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Positive whole number, e.g. 600000")
            .setMinLength(1)
            .setMaxLength(10)
            .setValue(String(configService.getCacheStaleMaxAgeMs()))
            .setRequired(true),
        ),
    );
}

// ─── Modal submit handling ─────────────────────────────────────────────

/**
 * Build the modal handlers for the config modals.
 *
 * Each handler is first-class: it is routed by its custom id and owns its
 * permission check directly (Administrator), because Discord does not link a
 * modal submit back to the command that opened it.
 */
export function createConfigModalHandlers(
  configService: ConfigService,
): ModalHandler[] {
  return [
    {
      customId: CONFIG_MAIN_MODAL_ID,
      checkPermissions: requireAdministrator,
      execute: (interaction) =>
        handleConfigModalSubmit(interaction, configService),
    },
    {
      customId: CONFIG_INTERNAL_MODAL_ID,
      checkPermissions: requireAdministrator,
      execute: (interaction) =>
        handleConfigModalSubmit(interaction, configService),
    },
  ];
}

/**
 * Handle a config modal submission: validate all inputs, then persist them.
 * On validation failure a friendly ephemeral error is replied and nothing is
 * saved. Database errors are allowed to propagate to the interaction router,
 * which replies with a generic failure message.
 */
export async function handleConfigModalSubmit(
  interaction: ModalSubmitInteraction,
  configService: ConfigService,
): Promise<void> {
  if (interaction.customId === CONFIG_MAIN_MODAL_ID) {
    await handleMainSubmit(interaction, configService);
    return;
  }

  if (interaction.customId === CONFIG_INTERNAL_MODAL_ID) {
    await handleInternalSubmit(interaction, configService);
    return;
  }
}

async function handleMainSubmit(
  interaction: ModalSubmitInteraction,
  configService: ConfigService,
): Promise<void> {
  const cooldown = parsePositiveInt(
    interaction.fields.getTextInputValue(INPUT_COOLDOWN),
  );
  const channels = [
    ...(interaction.fields.getSelectedChannels(INPUT_CHANNELS)?.keys() ?? []),
  ];
  const inherit = interaction.fields.getCheckbox(INPUT_INHERIT);
  const blacklist = [
    ...(interaction.fields.getSelectedUsers(INPUT_BLACKLIST)?.keys() ?? []),
  ];

  if (cooldown === null) {
    await interaction.reply({
      content:
        "Invalid **cooldown**. Provide a positive whole number of milliseconds (e.g. `20000`).",
      ephemeral: true,
    });
    return;
  }

  await configService.setCooldownMs(cooldown);
  await configService.setAllowedChannels(channels);
  await configService.setAllowChannelChildren(inherit);
  await configService.setBlacklistedUsers(blacklist);

  logger.info("Main config updated", {
    cooldownMs: cooldown,
    allowedChannels: channels.length,
    allowChannelChildren: inherit,
    blacklistedUsers: blacklist.length,
  });

  await interaction.reply({
    content:
      `Config updated.\n` +
      `- Point cooldown: **${cooldown}** ms\n` +
      `- Allowed channels: ${
        channels.length === 0
          ? "**all channels**"
          : channels.map((id) => channelMention(id)).join(", ")
      }\n` +
      `- Count child channels: **${inherit}**\n` +
      `- Blacklisted users: ${
        blacklist.length === 0
          ? "**none**"
          : blacklist.map((id) => userMention(id)).join(", ")
      }`,
    ephemeral: true,
  });
}

async function handleInternalSubmit(
  interaction: ModalSubmitInteraction,
  configService: ConfigService,
): Promise<void> {
  const flush = parsePositiveInt(
    interaction.fields.getTextInputValue(INPUT_FLUSH),
  );
  const eviction = parsePositiveInt(
    interaction.fields.getTextInputValue(INPUT_EVICTION),
  );
  const stale = parsePositiveInt(
    interaction.fields.getTextInputValue(INPUT_STALE),
  );

  if (flush === null || eviction === null || stale === null) {
    await interaction.reply({
      content:
        "Invalid timing value. All values must be positive whole numbers of milliseconds.",
      ephemeral: true,
    });
    return;
  }

  await configService.setFlushIntervalMs(flush);
  await configService.setEvictionIntervalMs(eviction);
  await configService.setCacheStaleMaxAgeMs(stale);

  logger.info("Internal config updated", {
    flushIntervalMs: flush,
    evictionIntervalMs: eviction,
    staleMaxAgeMs: stale,
  });

  await interaction.reply({
    content:
      `Config updated.\n` +
      `- Flush interval: **${flush}** ms\n` +
      `- Eviction interval: **${eviction}** ms\n` +
      `- Stale max age: **${stale}** ms`,
    ephemeral: true,
  });
}
