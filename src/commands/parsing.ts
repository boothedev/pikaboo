/**
 * Pure parsing helper for admin modal text inputs.
 *
 * Only numeric config values still arrive as text (channel/user selects and
 * checkboxes now use native components that return resolved values directly).
 * This helper is kept free of Discord and database dependencies so it remains
 * unit-testable.
 */

/**
 * Parse a positive whole number (e.g. "20000" → 20000).
 * Returns null when the value is not a positive integer.
 */
export function parsePositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
