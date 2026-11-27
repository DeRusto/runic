import {
  FIRES,
  LIGHTING_TICKS,
  lightRefusal,
  lightTileAt,
  removeItems,
  siteId,
  type FireLog,
  type Tile,
} from "@runic/shared";
import type { World } from "./worldContext.ts";
import { Fire } from "./worldState.ts";

/** Lighting fires on the ground, and the fires burning until they go out (#224). A burning fire is a station for cooking. */
export class Firemaking {
  constructor(private readonly world: World) {}

  /** Starts lighting the log in `slot` on the player's own tile, or says why not (#224). */
  startLighting(id: string, slot: number) {
    const player = this.world.player(id);
    const unsynced = this.world.unsynced(id);
    const log = player.inventory[slot]!;
    const refusal = lightRefusal(log, this.lightTileAt(player), player);
    if (refusal) {
      this.world.tell(id, refusal);
      return;
    }
    // The log is consumed at once, so a new click during the lighting loses it (#224).
    removeItems(player.inventory, player.inventoryCounts, log, 1);
    // Or a walk in progress would carry them off the tile the fire was checked for.
    unsynced.path = [];
    unsynced.action = {
      kind: "lighting",
      log: log as FireLog,
      doneTick: this.world.state.tick + LIGHTING_TICKS,
    };
    this.world.events.push({
      type: "make",
      player: id,
      station: "fire",
      ticks: LIGHTING_TICKS,
    });
  }

  /**
   * What the player's tile is like for lighting a fire on it (#224). The tile kind gives the
   * ground and any prop; a fire of their own and an enemy standing there come from state.
   */
  private lightTileAt(tile: Tile) {
    return lightTileAt(tile, {
      tiles: this.world.tiles,
      fires: this.world.state.fires,
      enemies: this.world.state.enemies.values(),
    });
  }

  /** A fire of `log`'s tier on the player's own tile, and a station of kind "fire" while it burns (#224). */
  private placeFire({ x, y }: Tile, log: FireLog) {
    this.world.state.fires.set(
      siteId({ x, y }),
      Object.assign(new Fire(), {
        log,
        endTick: this.world.state.tick + FIRES[log].ticks,
      }),
    );
    (this.world.stations.fire ??= []).push({ x, y });
  }

  /** Fires despawn silently when their time is up, and stop being stations (#224). */
  advanceFires() {
    for (const [id, fire] of this.world.state.fires) {
      if (this.world.state.tick < fire.endTick) continue;
      this.world.state.fires.delete(id);
      const [x, y] = id.split(",").map(Number) as [number, number];
      const tiles = this.world.stations.fire!;
      tiles.splice(
        tiles.findIndex((tile) => tile.x === x && tile.y === y),
        1,
      );
    }
  }

  /** When the lighting is over, the fire appears and pays its experience (#224). */
  advanceLighting() {
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const { action } = unsynced;
      if (
        action?.kind !== "lighting" ||
        this.world.state.tick < action.doneTick
      )
        continue;
      unsynced.action = undefined;
      const player = this.world.state.players.get(id)!;
      // A rival may have lit one here first; the log already burnt, so nothing is placed.
      if (this.lightTileAt(player).fire) continue;
      this.placeFire(player, action.log);
      this.world.earnXp(player, "firemakingXp", FIRES[action.log].xp);
    }
  }
}
