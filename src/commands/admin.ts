import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { ConfigService } from "@/services/ConfigService";
import type { PointService } from "@/services/PointService";
import type { ChatInputCommand } from "./types";
import { requireAdministrator } from "./guards";
import {
  buildConfigGroup,
  buildConfigInternalModal,
  buildConfigMainModal,
} from "./config";
import { buildPointGroup, handlePointCommand } from "./points";
import {
  ADMIN_COMMAND_NAME,
  CONFIG_GROUP,
  CONFIG_INTERNAL,
  CONFIG_MAIN,
  POINT_GROUP,
} from "./ids";

/**
 * Create the `/pikaboo-admin` command.
 *
 * The command is restricted to Administrators at registration time (Discord
 * hides it from others) and at runtime via `requireAdministrator`. Its two
 * subcommand groups — `config` and `point` — are assembled from their own
 * modules. The config modals it opens are registered separately as
 * first-class modal handlers (see `createConfigModalHandlers`).
 */
export function createAdminCommand(
  configService: ConfigService,
  pointService: PointService,
): ChatInputCommand {
  return {
    data: new SlashCommandBuilder()
      .setName(ADMIN_COMMAND_NAME)
      .setDescription("Pikaboo admin controls")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommandGroup(buildConfigGroup())
      .addSubcommandGroup(buildPointGroup()),

    checkPermissions: requireAdministrator,

    async execute(interaction) {
      const group = interaction.options.getSubcommandGroup();

      if (group === CONFIG_GROUP) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === CONFIG_MAIN) {
          await interaction.showModal(buildConfigMainModal(configService));
          return;
        }
        if (subcommand === CONFIG_INTERNAL) {
          await interaction.showModal(buildConfigInternalModal(configService));
          return;
        }
        return;
      }

      if (group === POINT_GROUP) {
        await handlePointCommand(interaction, pointService);
      }
    },
  };
}
