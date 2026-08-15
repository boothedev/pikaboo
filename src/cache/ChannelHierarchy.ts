/**
 * In-memory map of a channel/thread id to its immediate parent id.
 *
 * Populated from GUILD_CREATE and kept in sync via channel/thread events.
 * Used to resolve a message channel's ancestors (e.g. thread → text channel
 * → category) so that children of an allowed channel are also allowed.
 */
export class ChannelHierarchy {
  private parentById = new Map<string, string>();

  /** Record (or clear) the parent of a channel/thread. */
  setParent(childId: string, parentId: string | null): void {
    if (parentId === null) {
      this.parentById.delete(childId);
    } else {
      this.parentById.set(childId, parentId);
    }
  }

  /** Remove a channel/thread entirely (e.g. on delete). */
  remove(childId: string): void {
    this.parentById.delete(childId);
  }

  /** The immediate parent id of a channel/thread, if known. */
  getParent(childId: string): string | undefined {
    return this.parentById.get(childId);
  }

  /**
   * The channel id followed by all ancestor ids (parent, grandparent, ...),
   * walking up until a top-level channel (no parent) is reached.
   *
   * `immediateParentId` is the parent id read straight off the channel object
   * (e.g. `message.channel.parentId`), so this works even if the channel
   * itself hasn't been cached yet. A cycle guard prevents infinite loops.
   */
  getSelfAndAncestors(
    channelId: string,
    immediateParentId: string | null,
  ): string[] {
    const ids = [channelId];
    const seen = new Set<string>([channelId]);

    let parentId: string | null = immediateParentId;
    while (parentId !== null && !seen.has(parentId)) {
      ids.push(parentId);
      seen.add(parentId);
      parentId = this.parentById.get(parentId) ?? null;
    }

    return ids;
  }

  get size(): number {
    return this.parentById.size;
  }
}
