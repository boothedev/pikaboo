import { PermissionFlagsBits, type Interaction } from "discord.js";

/**
 * Reusable runtime permission guards.
 *
 * Each guard returns a user-facing rejection message (or `null` when allowed)
 * so commands can attach them via `checkPermissions`. Add more guards here as
 * the bot gains commands with different permission requirements.
 */

/**
 * Require the caller to hold the Administrator permission.
 */
export function requireAdministrator(interaction: Interaction): string | null {
  if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return null;
  }
  return "You need the **Administrator** permission to use this command.";
}
