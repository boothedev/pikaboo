import { describe, it, expect } from "vitest";
import { ChannelHierarchy } from "./ChannelHierarchy";

describe("ChannelHierarchy", () => {
  it("stores and returns parents", () => {
    const h = new ChannelHierarchy();
    h.setParent("text", "category");

    expect(h.getParent("text")).toBe("category");
    expect(h.getParent("category")).toBeUndefined();
    expect(h.size).toBe(1);
  });

  it("clears a parent when set to null", () => {
    const h = new ChannelHierarchy();
    h.setParent("text", "category");
    h.setParent("text", null);

    expect(h.getParent("text")).toBeUndefined();
    expect(h.size).toBe(0);
  });

  it("removes entries", () => {
    const h = new ChannelHierarchy();
    h.setParent("thread", "text");
    h.remove("thread");

    expect(h.getParent("thread")).toBeUndefined();
  });

  it("walks the ancestor chain (thread -> text -> category)", () => {
    const h = new ChannelHierarchy();
    h.setParent("text", "category");
    h.setParent("thread", "text");

    expect(h.getSelfAndAncestors("thread", "text")).toEqual([
      "thread",
      "text",
      "category",
    ]);
  });

  it("returns just the channel for a top-level channel", () => {
    const h = new ChannelHierarchy();
    expect(h.getSelfAndAncestors("top", null)).toEqual(["top"]);
  });

  it("uses the immediate parent even if the channel is not in the map", () => {
    const h = new ChannelHierarchy();
    h.setParent("text", "category");

    // "thread" is not in the map, but its parent is known from the channel object.
    expect(h.getSelfAndAncestors("thread", "text")).toEqual([
      "thread",
      "text",
      "category",
    ]);
  });

  it("guards against cycles", () => {
    const h = new ChannelHierarchy();
    h.setParent("a", "b");
    h.setParent("b", "a");

    expect(h.getSelfAndAncestors("a", "b")).toEqual(["a", "b"]);
  });

  it("resolves eligibility: an allowed category covers its descendants", () => {
    const h = new ChannelHierarchy();
    h.setParent("text", "category");
    h.setParent("thread", "text");

    const allowed = new Set(["category"]);
    const isEligible = (channelId: string, parentId: string | null) =>
      h.getSelfAndAncestors(channelId, parentId).some((id) => allowed.has(id));

    expect(isEligible("thread", "text")).toBe(true); // thread under allowed category
    expect(isEligible("text", "category")).toBe(true); // channel under allowed category
    expect(isEligible("other", null)).toBe(false); // unrelated top-level channel
  });
});
