import { pino, type Logger as PinoLogger } from "pino";

const isDevelopment = process.env.NODE_ENV === "development";

const root = pino({
  level: process.env.LOG_LEVEL ?? (isDevelopment ? "debug" : "info"),
  base: { service: "pikaboo" },
  ...(isDevelopment
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}),
});

/** Logger interface preserving the codebase's `(message, dataOrError?)` signature. */
export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, err?: unknown): void;
}

function createAdapter(base: PinoLogger): Logger {
  return {
    info(msg, data) {
      if (data) base.info(data, msg);
      else base.info(msg);
    },
    warn(msg, data) {
      if (data) base.warn(data, msg);
      else base.warn(msg);
    },
    debug(msg, data) {
      if (data) base.debug(data, msg);
      else base.debug(msg);
    },
    error(msg, err) {
      if (err instanceof Error) base.error({ err }, msg);
      else if (err !== undefined) base.error({ error: err }, msg);
      else base.error(msg);
    },
  };
}

/**
 * Create a logger scoped to a module. Every log line includes a `module`
 * field with the given name.
 */
export function createLogger(module: string): Logger {
  return createAdapter(root.child({ module }));
}
