/**
 * Shared identifiers for the admin slash command and its modals.
 * Centralized so command registration, interaction routing, and modal
 * handlers all reference the same strings.
 */

export const ADMIN_COMMAND_NAME = "pikaboo-admin";

// Subcommand groups
export const CONFIG_GROUP = "config";
export const POINT_GROUP = "point";

// Config subcommands
export const CONFIG_MAIN = "main";
export const CONFIG_INTERNAL = "internal";

// Point subcommands
export const POINT_CHECK = "check";
export const POINT_SET = "set";
export const POINT_ADJUST = "adjust";

// Modal custom IDs
export const CONFIG_MAIN_MODAL_ID = "pikaboo:config:main";
export const CONFIG_INTERNAL_MODAL_ID = "pikaboo:config:internal";

// Main-modal component custom IDs
export const INPUT_COOLDOWN = "cooldown";
export const INPUT_CHANNELS = "channels";
export const INPUT_INHERIT = "inherit";
export const INPUT_BLACKLIST = "blacklist";

// Internal-modal component custom IDs
export const INPUT_FLUSH = "flush";
export const INPUT_EVICTION = "eviction";
export const INPUT_STALE = "stale";
