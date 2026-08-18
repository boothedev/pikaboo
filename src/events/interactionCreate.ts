import type { Interaction } from "discord.js";
import type { InteractionRegistry } from "@/commands/registry";
import { createLogger } from "@/utils/logger";

const logger = createLogger("Interaction");

/**
 * Creates the interactionCreate event handler.
 *
 * This handler stays generic: all routing and permission decisions are
 * delegated to the InteractionRegistry, which maps interactions to commands,
 * component handlers, and modal handlers. Adding a new interaction never
 * requires touching this file.
 *
 * Its only responsibility is a safety net — logging and replying with a generic
 * message when an interaction handler throws before it has replied.
 */
export function createInteractionHandler(
  registry: InteractionRegistry,
): (interaction: Interaction) => Promise<void> {
  return async (interaction: Interaction): Promise<void> => {
    try {
      await registry.handle(interaction);
    } catch (err) {
      logger.error("Interaction handling failed", err);
      if (
        interaction.isRepliable() &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content:
            "Something went wrong while handling this interaction. Please try again.",
          ephemeral: true,
        });
      }
    }
  };
}
