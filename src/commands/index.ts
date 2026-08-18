import type { ConfigService } from "@/services/ConfigService";
import type { PointService } from "@/services/PointService";
import { createAdminCommand } from "./admin";
import { createConfigModalHandlers } from "./config";
import { InteractionRegistry } from "./registry";

export { InteractionRegistry } from "./registry";
export { createAdminCommand } from "./admin";
export { createConfigModalHandlers } from "./config";
export * from "./types";

/**
 * Build the bot's complete interaction registry.
 *
 * Add new commands, component handlers, or modal handlers here. Each entry is
 * self-contained (own custom id / name and permission check), so nothing else
 * needs to change when an interaction is added or removed.
 */
export function createInteractionRegistry(
  configService: ConfigService,
  pointService: PointService,
): InteractionRegistry {
  return new InteractionRegistry({
    commands: [createAdminCommand(configService, pointService)],
    components: [],
    modals: createConfigModalHandlers(configService),
  });
}
