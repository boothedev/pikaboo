import { describe, it, expect, vi } from "vitest";
import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ModalSubmitInteraction,
} from "discord.js";
import { InteractionRegistry } from "./registry";
import type {
  ChatInputCommand,
  ComponentHandler,
  ModalHandler,
  PermissionCheck,
} from "./types";

/** Build a minimal command for testing routing, without the full builder API. */
function makeCommand(opts: {
  name: string;
  execute?: ChatInputCommand["execute"];
  checkPermissions?: PermissionCheck;
}): ChatInputCommand {
  return {
    data: {
      name: opts.name,
      toJSON: () => ({ name: opts.name }),
    } as ChatInputCommand["data"],
    execute: opts.execute ?? vi.fn().mockResolvedValue(undefined),
    checkPermissions: opts.checkPermissions,
  };
}

/** Build a minimal modal handler. */
function makeModal(opts: {
  customId: string;
  execute?: ModalHandler["execute"];
  checkPermissions?: PermissionCheck;
}): ModalHandler {
  return {
    customId: opts.customId,
    execute: opts.execute ?? vi.fn().mockResolvedValue(undefined),
    checkPermissions: opts.checkPermissions,
  };
}

/** Build a minimal button/select component handler. */
function makeComponent(opts: {
  customId: string;
  execute?: ComponentHandler["execute"];
  checkPermissions?: PermissionCheck;
}): ComponentHandler {
  return {
    customId: opts.customId,
    execute: opts.execute ?? vi.fn().mockResolvedValue(undefined),
    checkPermissions: opts.checkPermissions,
  };
}

/** A minimal chat-input interaction with a spy-able `reply`. */
function chatInput(name: string) {
  return {
    isChatInputCommand: () => true,
    isMessageComponent: () => false,
    isModalSubmit: () => false,
    reply: vi.fn().mockResolvedValue(undefined),
    commandName: name,
  } as unknown as ChatInputCommandInteraction;
}

/** A minimal modal-submit interaction with a spy-able `reply`. */
function modalSubmit(customId: string) {
  return {
    isChatInputCommand: () => false,
    isMessageComponent: () => false,
    isModalSubmit: () => true,
    reply: vi.fn().mockResolvedValue(undefined),
    customId,
  } as unknown as ModalSubmitInteraction;
}

/** A minimal button/select interaction with a spy-able `reply`. */
function messageComponent(customId: string) {
  return {
    isChatInputCommand: () => false,
    isMessageComponent: () => true,
    isModalSubmit: () => false,
    reply: vi.fn().mockResolvedValue(undefined),
    customId,
  } as unknown as ButtonInteraction;
}

describe("InteractionRegistry", () => {
  it("executes a command that has no permission check", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const registry = new InteractionRegistry({
      commands: [makeCommand({ name: "ping", execute })],
    });
    const interaction = chatInput("ping");

    await expect(registry.handle(interaction)).resolves.toBe(true);

    expect(execute).toHaveBeenCalledWith(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("rejects a command when its permission check returns a message", async () => {
    const execute = vi.fn();
    const registry = new InteractionRegistry({
      commands: [
        makeCommand({
          name: "admin",
          execute,
          checkPermissions: () => "no permission",
        }),
      ],
    });
    const interaction = chatInput("admin");

    await expect(registry.handle(interaction)).resolves.toBe(true);

    expect(execute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "no permission",
      ephemeral: true,
    });
  });

  it("executes a command when its permission check passes", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const registry = new InteractionRegistry({
      commands: [
        makeCommand({
          name: "admin",
          execute,
          checkPermissions: () => null,
        }),
      ],
    });
    const interaction = chatInput("admin");

    await registry.handle(interaction);

    expect(execute).toHaveBeenCalledWith(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("routes a modal submit by custom id, independent of any command", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const registry = new InteractionRegistry({
      modals: [makeModal({ customId: "shop:redeem:confirm", execute })],
    });
    const interaction = modalSubmit("shop:redeem:confirm");

    await expect(registry.handle(interaction)).resolves.toBe(true);

    expect(execute).toHaveBeenCalledWith(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("applies a modal handler's own permission check", async () => {
    const execute = vi.fn();
    const registry = new InteractionRegistry({
      modals: [
        makeModal({
          customId: "admin:config:main",
          execute,
          checkPermissions: () => "no permission",
        }),
      ],
    });
    const interaction = modalSubmit("admin:config:main");

    await expect(registry.handle(interaction)).resolves.toBe(true);

    expect(execute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: "no permission",
      ephemeral: true,
    });
  });

  it("routes a button/select component by custom id", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const registry = new InteractionRegistry({
      components: [
        makeComponent({
          customId: "shop:open",
          execute,
          checkPermissions: () => null,
        }),
      ],
    });
    const interaction = messageComponent("shop:open");

    await expect(registry.handle(interaction)).resolves.toBe(true);

    expect(execute).toHaveBeenCalledWith(interaction);
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it("ignores interactions that no handler owns", async () => {
    const registry = new InteractionRegistry({
      commands: [makeCommand({ name: "ping" })],
      components: [makeComponent({ customId: "shop:open" })],
      modals: [makeModal({ customId: "shop:redeem:confirm" })],
    });

    await expect(registry.handle(chatInput("unknown"))).resolves.toBe(false);
    await expect(
      registry.handle(messageComponent("unknown:component")),
    ).resolves.toBe(false);
    await expect(
      registry.handle(modalSubmit("unknown:modal")),
    ).resolves.toBe(false);
  });

  it("rejects duplicate routing keys", () => {
    expect(
      () =>
        new InteractionRegistry({
          commands: [
            makeCommand({ name: "ping" }),
            makeCommand({ name: "ping" }),
          ],
        }),
    ).toThrow('Duplicate command name: "ping"');

    expect(
      () =>
        new InteractionRegistry({
          modals: [
            makeModal({ customId: "m" }),
            makeModal({ customId: "m" }),
          ],
        }),
    ).toThrow('Duplicate modal custom id: "m"');
  });

  it("registers the JSON payload of every command", async () => {
    const registry = new InteractionRegistry({
      commands: [makeCommand({ name: "ping" }), makeCommand({ name: "admin" })],
    });
    const set = vi.fn().mockResolvedValue(undefined);
    const client = {
      application: { commands: { set } },
    } as unknown as Client<true>;

    await registry.register(client);

    expect(set).toHaveBeenCalledWith([{ name: "ping" }, { name: "admin" }]);
  });
});
