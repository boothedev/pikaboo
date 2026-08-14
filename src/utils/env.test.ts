import { describe, it, expect, afterEach } from "vitest";
import { env } from "./env";

const KEY = "PIKABOO_TEST_ENV";

describe("env", () => {
  afterEach(() => {
    delete process.env[KEY];
  });

  it("returns the value when set", () => {
    process.env[KEY] = "hello";
    expect(env(KEY)).toBe("hello");
  });

  it("returns a string default when unset", () => {
    expect(env(KEY, "fallback")).toBe("fallback");
  });

  it("returns a function default when unset", () => {
    expect(env(KEY, () => "computed")).toBe("computed");
  });

  it("throws when unset and no default", () => {
    expect(() => env(KEY)).toThrow(`${KEY} is not set`);
  });
});
