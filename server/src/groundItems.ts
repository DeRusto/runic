import { schema, t, type MapSchema, type SchemaType } from "@colyseus/schema";
import {
  GROUND_ITEM_DESPAWN_TICKS,
  GROUND_ITEM_OWNER_TICKS,
  type Tile,
} from "@runic/shared";

/** One item or stack lying on a tile, from a single drop. */
export const GroundItem = schema(
  {
    x: t.uint8(),
    y: t.uint8(),
    item: t.string(),
    count: t.uint8(),
    /** The username of the only player who can see it, or "" once everyone can. */
    owner: t.string().default(""),
  },
  "GroundItem",
);
export type GroundItem = SchemaType<typeof GroundItem>;

/**
 * Every ground item in the region, kept in the synced map it is given. Only the server's
 * memory holds them, so a restart clears them (#117).
 */
export class GroundItems {
  private nextId = 0;
  /** The tick each ground item was dropped on, by its id in the synced map. */
  private dropTicks = new Map<string, number>();

  constructor(private synced: MapSchema<GroundItem>) {}

  /**
   * Puts `count` of `item` on `tile` as a new ground item that never merges with another.
   * Only `owner`, a username, can see it until its owner minute ends.
   */
  spawn(tile: Tile, item: string, count: number, owner: string, tick: number) {
    const id = String(this.nextId++);
    const { x, y } = tile;
    this.synced.set(
      id,
      Object.assign(new GroundItem(), { x, y, item, count, owner }),
    );
    this.dropTicks.set(id, tick);
    return id;
  }

  /** Whether the player with this username can see the ground item with this id. */
  canSee(username: string, id: string) {
    const groundItem = this.synced.get(id);
    return (
      groundItem !== undefined &&
      (groundItem.owner === "" || groundItem.owner === username)
    );
  }

  /** Runs every ground item's timers up to `tick`. */
  advance(tick: number) {
    for (const [id, dropTick] of this.dropTicks) {
      if (tick >= dropTick + GROUND_ITEM_OWNER_TICKS)
        this.synced.get(id)!.owner = "";
      if (tick < dropTick + GROUND_ITEM_DESPAWN_TICKS) continue;
      this.synced.delete(id);
      this.dropTicks.delete(id);
    }
  }
}
