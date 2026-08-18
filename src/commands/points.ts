import {
  SlashCommandSubcommandGroupBuilder,
  userMention,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { PointService } from "@/services/PointService";
import { POINT_ADJUST, POINT_GROUP, POINT_SET, POINT_CHECK } from "./ids";

/**
 * Build the `point` subcommand group:
 *   /pikaboo-admin point check  → check a user's points
 *   /pikaboo-admin point set    → set a user's points to an exact value
 *   /pikaboo-admin point adjust → add/remove points from a user
 */
export function buildPointGroup(): SlashCommandSubcommandGroupBuilder {
  return new SlashCommandSubcommandGroupBuilder()
    .setName(POINT_GROUP)
    .setDescription("Inspect and manage user points")
    .addSubcommand((sub) =>
      sub
        .setName(POINT_CHECK)
        .setDescription("Check a user's current points")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to check")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName(POINT_SET)
        .setDescription("Set a user's points to an exact value")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to update")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("points")
            .setDescription("New point total (non-negative)")
            .setRequired(true)
            .setMinValue(0),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName(POINT_ADJUST)
        .setDescription("Add or remove points from a user")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("The user to adjust")
            .setRequired(true),
        )
        .addIntegerOption((option) =>
          option
            .setName("delta")
            .setDescription("Points to add (use a negative value to remove)")
            .setRequired(true),
        ),
    );
}

/**
 * Handle `/pikaboo-admin point <check|set|adjust>`.
 * Reads the resolved user and delegates point mutations to PointService.
 */
export async function handlePointCommand(
  interaction: ChatInputCommandInteraction,
  pointService: PointService,
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const user = interaction.options.getUser("user", true);

  switch (subcommand) {
    case POINT_CHECK: {
      const points = await pointService.getPoints(user.id);
      await interaction.reply({
        content: `${userMention(user.id)} has **${points}** point(s).`,
        ephemeral: true,
      });
      return;
    }

    case POINT_SET: {
      const value = interaction.options.getInteger("points", true);
      const total = await pointService.setPoints(user.id, value);
      await interaction.reply({
        content: `Set ${userMention(user.id)}'s points to **${total}**.`,
        ephemeral: true,
      });
      return;
    }

    case POINT_ADJUST: {
      const delta = interaction.options.getInteger("delta", true);
      const total = await pointService.adjustPoints(user.id, delta);
      const verb = delta >= 0 ? "Added" : "Removed";
      await interaction.reply({
        content: `${verb} **${Math.abs(delta)}** point(s) for ${userMention(user.id)}. New total: **${total}**.`,
        ephemeral: true,
      });
      return;
    }

    default:
      await interaction.reply({
        content: "Unknown point subcommand.",
        ephemeral: true,
      });
  }
}
