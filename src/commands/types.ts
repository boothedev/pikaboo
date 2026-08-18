import type {
  ChatInputCommandInteraction,
  Interaction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";

/**
 * The builder shape produced while defining a slash command. Commands may be
 * plain, options-only, or subcommand-based, so all three builder types are
 * accepted.
 */
export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

/**
 * Runtime permission gate. Return a user-facing rejection message to deny the
 * interaction, or `null` to allow it.
 */
export type PermissionCheck = (interaction: Interaction) => string | null;

/**
 * A top-level slash command, routed by `data.name`.
 */
export interface ChatInputCommand {
  /** The slash command builder. Its `name` is used for registration/routing. */
  data: CommandData;
  /** Optional runtime permission check. */
  checkPermissions?: PermissionCheck;
  /** Handles a chat-input interaction for this command. */
  execute(interaction: ChatInputCommandInteraction): Promise<void> | void;
}

/**
 * A button/select-menu component handler, routed by `customId`.
 *
 * Components can open modals (and do many other things), so their handlers are
 * first-class and independent of any command. This covers buttons and every
 * select-menu type (string, user, role, channel, mentionable) as the bot gains
 * them.
 */
export interface ComponentHandler {
  /** Component custom id this handler responds to. */
  customId: string;
  /** Optional runtime permission check. */
  checkPermissions?: PermissionCheck;
  /** Handles a button/select-menu interaction. */
  execute(interaction: MessageComponentInteraction): Promise<void> | void;
}

/**
 * A modal-submit handler, routed by `customId`.
 *
 * Modal submits are identified only by their custom id — Discord does not link
 * them back to whatever opened them (chat-input command, context-menu command,
 * button, select menu, or even another modal). Modal handlers are therefore
 * first-class and own their permission check directly, independent of any
 * trigger. Adopt a namespaced custom id convention (e.g. `admin:config:main`)
 * so ownership and collisions stay clear.
 */
export interface ModalHandler {
  /** Modal custom id this handler responds to. */
  customId: string;
  /** Optional runtime permission check. */
  checkPermissions?: PermissionCheck;
  /** Handles a modal-submit interaction. */
  execute(interaction: ModalSubmitInteraction): Promise<void> | void;
}

/** The collections a registry is built from. */
export interface RegistryEntries {
  commands?: readonly ChatInputCommand[];
  components?: readonly ComponentHandler[];
  modals?: readonly ModalHandler[];
}
