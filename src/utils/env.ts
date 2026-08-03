export const env = (
  name: string,
  defaultValue?: string | (() => string),
): string => {
  const value = process.env[name];

  if (value) return value;
  if (typeof defaultValue === "string") return defaultValue;
  if (typeof defaultValue === "function") return defaultValue();

  throw new Error(
    `${name} is not set. Create a .env file or set the environment variable.`,
  );
};
