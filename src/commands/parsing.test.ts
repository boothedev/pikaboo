import { describe, it, expect } from "vitest";
import { parsePositiveInt } from "./parsing";

describe("parsePositiveInt", () => {
  it("parses positive whole numbers", () => {
    expect(parsePositiveInt("20000")).toBe(20000);
    expect(parsePositiveInt("  42  ")).toBe(42);
    expect(parsePositiveInt("1")).toBe(1);
  });

  it("returns null for non-positive or non-integer values", () => {
    expect(parsePositiveInt("0")).toBeNull();
    expect(parsePositiveInt("-5")).toBeNull();
    expect(parsePositiveInt("3.5")).toBeNull();
    expect(parsePositiveInt("abc")).toBeNull();
    expect(parsePositiveInt("")).toBeNull();
    expect(parsePositiveInt("12 000")).toBeNull();
  });
});
