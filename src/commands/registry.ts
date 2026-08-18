import type { Client, Interaction, RepliableInteraction } from "discord.js";
import type {
  ChatInputCommand,
  ComponentHandler,
  ModalHandler,
  PermissionCheck,
  RegistryEntries,
} from "./types";
import { createLogger } from "@/utils/logger";

const logger = createLogger("InteractionRegistry");

/**
 * Index handlers into a `Map` keyed by a string derived from each entry.
 * Duplicate keys are rejected so routing can never be ambiguous.
 */
function indexBy<T>(
  entries: readonly T[],
  keyOf: (entry: T) => string,
  label: string,
): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const entry of entries) {
    const key = keyOf(entry);
    if (map.has(key)) {
      throw new Error(`Duplicate ${label}: "${key}"`);
    }
    map.set(key, entry);
  }
  return map;
}

/**
 * Holds the bot's interaction handlers and routes interactions to them.
 *
 * Each interaction type has its own natural routing key, so handlers are held
 * in independent `Map`s for O(1) lookup:
 *
 * - slash commands       → keyed by `commandName`
 * - components (buttons/selects) → keyed by `customId`
 * - modals               → keyed by `customId`
 *
 * Keys are derived from each handler's own `name`/`customId` (a single source
 * of truth), and duplicate keys are rejected at construction. Because Discord
 * links a modal submit to nothing but its custom id, modal handlers are
 * first-class: each declares its own custom id and permission check,
 * independent of the command, button, or other interaction that opened it.
 */
export class InteractionRegistry {
  private readonly commands: ReadonlyMap<string, ChatInputCommand>;
  private readonly components: ReadonlyMap<string, ComponentHandler>;
  private readonly modals: ReadonlyMap<string, ModalHandler>;

  constructor(entries: RegistryEntries = {}) {
    this.commands = indexBy(
      entries.commands ?? [],
      (command) => command.data.name,
      "command name",
    );
    this.components = indexBy(
      entries.components ?? [],
      (component) => component.customId,
      "component custom id",
    );
    this.modals = indexBy(
      entries.modals ?? [],
      (modal) => modal.customId,
      "modal custom id",
    );
  }

  /** Register (overwrite) all slash commands with Discord. */
  async register(client: Client<true>): Promise<void> {
    await client.application.commands.set(
      [...this.commands.values()].map((command) => command.data.toJSON()),
    );
    logger.info(`Registered ${this.commands.size} command(s)`);
  }

  /**
   * Route an interaction to its handler.
   *
   * Returns `true` when the interaction was handled (including permission
   * rejections) and `false` when no handler owns it. Errors thrown by a
   * handler are intentionally left to propagate so the caller can apply its
   * own safety net (e.g. a generic failure reply).
   */
  async handle(interaction: Interaction): Promise<boolean> {
    if (interaction.isChatInputCommand()) {
      return this.dispatch(
        interaction,
        this.commands.get(interaction.commandName),
      );
    }

    if (interaction.isMessageComponent()) {
      return this.dispatch(
        interaction,
        this.components.get(interaction.customId),
      );
    }

    if (interaction.isModalSubmit()) {
      return this.dispatch(interaction, this.modals.get(interaction.customId));
    }

    return false;
  }

  /**
   * Run a matched handler after applying its permission check.
   * Rejections are replied to here, so handlers only run when allowed.
   */
  private async dispatch<I extends RepliableInteraction>(
    interaction: I,
    handler:
      | {
          checkPermissions?: PermissionCheck;
          execute: (interaction: I) => Promise<void> | void;
        }
      | undefined,
  ): Promise<boolean> {
    if (!handler) return false;

    const rejection = handler.checkPermissions?.(interaction);
    if (rejection) {
      await interaction.reply({ content: rejection, ephemeral: true });
      return true;
    }

    await handler.execute(interaction);
    return true;
  }
}
