import { schema, t } from "@colyseus/schema";
import {
  respawnTile,
  WALK_TICKS_PER_TILE,
  type Tile,
  type TileKind,
} from "@runic/shared";
import { findPath } from "./pathfinding.ts";

export const Player = schema({ x: t.uint8(), y: t.uint8() }, "Player");

export const WorldState = schema(
  { tick: t.uint32().default(0), players: t.map(Player) },
  "WorldState",
);

/** The whole game: rules and state, with no network. Tests and the room both drive it through tick(). */
export class Simulation {
  state = new WorldState();
  /** Only the latest click per player counts, so a flood of them costs one path per tick. */
  private queuedWalks = new Map<string, Tile>();
  private walks = new Map<string, { path: Tile[]; nextStepTick: number }>();

  constructor(
    private tiles: TileKind[][],
    readonly random: () => number,
  ) {}

  addPlayer(id: string) {
    this.state.players.set(
      id,
      Object.assign(new Player(), respawnTile(this.tiles)),
    );
    this.walks.set(id, { path: [], nextStepTick: 0 });
  }

  removePlayer(id: string) {
    this.state.players.delete(id);
    this.walks.delete(id);
    this.queuedWalks.delete(id);
  }

  /** `to` comes straight off the network, so anything but a tile on the grid is ignored. */
  queueWalk(id: string, to: Tile) {
    if (!this.state.players.has(id)) return;
    if (!Number.isInteger(to?.x) || !Number.isInteger(to?.y)) return;
    if (!this.tiles[to.y]?.[to.x]) return;
    this.queuedWalks.set(id, { x: to.x, y: to.y });
  }

  /** One tick, in the order of spec §6. */
  tick() {
    this.state.tick++;
    this.applyIntents();
    this.advancePlayers();
  }

  private applyIntents() {
    for (const [id, to] of this.queuedWalks) {
      this.walks.get(id)!.path = findPath(
        this.tiles,
        this.state.players.get(id)!,
        to,
      );
    }
    this.queuedWalks.clear();
  }

  private advancePlayers() {
    for (const [id, walk] of this.walks) {
      // nextStepTick outlives each walk, so clicking again can't beat the walking speed.
      if (!walk.path.length || this.state.tick < walk.nextStepTick) continue;
      Object.assign(this.state.players.get(id)!, walk.path.shift());
      walk.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
    }
  }
}
