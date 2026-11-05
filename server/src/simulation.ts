import { ArraySchema, schema, t } from "@colyseus/schema";
import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  levelFor,
  respawnTile,
  SPIDER_HEALTH,
  SPIDER_WANDER_CHANCE,
  SPIDER_WANDER_TILES,
  TILE_KINDS,
  STARTING_HEALTH,
  STARTING_HITPOINTS_XP,
  WALK_TICKS_PER_TILE,
  type Tile,
  type TileKind,
} from "@runic/shared";
import { findPath, legalSteps } from "./pathfinding.ts";
import type { PlayerSave } from "./saves.ts";

export const Player = schema(
  {
    username: t.string(),
    x: t.uint8(),
    y: t.uint8(),
    combatXp: t.uint32(),
    defenseXp: t.uint32(),
    foragingXp: t.uint32(),
    hitpointsXp: t.uint32(),
    health: t.uint8(),
    maxHealth: t.uint8(),
    inventory: t.array("string"),
  },
  "Player",
);

export const Spider = schema(
  {
    x: t.uint8(),
    y: t.uint8(),
    health: t.uint8().default(SPIDER_HEALTH),
    target: t.string().default(""),
    state: t.string().default("idle"),
  },
  "Spider",
);

export const WorldState = schema(
  {
    tick: t.uint32().default(0),
    players: t.map(Player),
    spiders: t.map(Spider),
  },
  "WorldState",
);

/** The whole game: rules and state, with no network. Tests and the room both drive it through tick(). */
export class Simulation {
  state = new WorldState();
  /** Only the latest click per player counts, so a flood of them costs one path per tick. */
  private queuedActions = new Map<string, { to: Tile } | { spider: string }>();
  private walks = new Map<
    string,
    { path: Tile[]; nextStepTick: number; spider?: string }
  >();
  private spiderHomes = new Map<string, Tile & { nextStepTick: number }>();
  private queuedLogouts = new Set<string>();
  /** Players whose log out intent was accepted, for the room to disconnect. */
  readonly loggedOut: string[] = [];

  constructor(
    private tiles: TileKind[][],
    readonly random: () => number,
  ) {
    tiles.forEach((row, y) =>
      row.forEach((kind, x) => {
        if (kind !== TILE_KINDS.S) return;
        const id = String(this.spiderHomes.size);
        this.spiderHomes.set(id, { x, y, nextStepTick: 0 });
        this.state.spiders.set(id, Object.assign(new Spider(), { x, y }));
      }),
    );
  }

  /** `saved` is the account's last save; without one, this is a new account. */
  addPlayer(id: string, saved?: PlayerSave, username = "") {
    const { inventory, ...fields } = this.loginSave(saved);
    const player = Object.assign(new Player(), fields, {
      username,
      maxHealth: levelFor(fields.hitpointsXp),
    });
    player.inventory = new ArraySchema(...inventory);
    this.state.players.set(id, player);
    this.walks.set(id, { path: [], nextStepTick: 0 });
  }

  private loginSave(saved: PlayerSave | undefined): PlayerSave {
    const respawn = respawnTile(this.tiles);
    if (!saved) {
      return {
        ...respawn,
        combatXp: 0,
        defenseXp: 0,
        foragingXp: 0,
        hitpointsXp: STARTING_HITPOINTS_XP,
        health: STARTING_HEALTH,
        inventory: Array<string>(INVENTORY_SLOTS).fill(EMPTY_SLOT),
      };
    }
    const tile = this.tiles[saved.y]?.[saved.x];
    return !tile || tile.blocks ? { ...saved, ...respawn } : saved;
  }

  /** What to write to the database for this player, if they're in the region. */
  saveOf(id: string): PlayerSave | undefined {
    const player = this.state.players.get(id);
    if (!player) return undefined;
    const { x, y, combatXp, defenseXp, foragingXp, hitpointsXp, health } =
      player;
    return {
      x,
      y,
      combatXp,
      defenseXp,
      foragingXp,
      hitpointsXp,
      health,
      inventory: [...player.inventory],
    };
  }

  removePlayer(id: string) {
    this.state.players.delete(id);
    this.walks.delete(id);
    this.queuedActions.delete(id);
    this.queuedLogouts.delete(id);
  }

  queueLogout(id: string) {
    if (this.state.players.has(id)) this.queuedLogouts.add(id);
  }

  /** `to` comes straight off the network, so anything but a tile on the grid is ignored. */
  queueWalk(id: string, to: Tile) {
    if (!this.state.players.has(id)) return;
    if (!Number.isInteger(to?.x) || !Number.isInteger(to?.y)) return;
    if (!this.tiles[to.y]?.[to.x]) return;
    this.queuedActions.set(id, { to: { x: to.x, y: to.y } });
  }

  /** `spider` comes straight off the network, so anything but a Spider's id is ignored. */
  queueTarget(id: string, spider: string) {
    if (!this.state.players.has(id) || !this.state.spiders.has(spider)) return;
    this.queuedActions.set(id, { spider });
  }

  /** One tick, in the order of spec §6. */
  tick() {
    this.state.tick++;
    this.applyIntents();
    this.advancePlayers();
    this.advanceSpiders();
  }

  private applyIntents() {
    for (const [id, action] of this.queuedActions) {
      const walk = this.walks.get(id)!;
      if ("spider" in action) {
        walk.spider = action.spider;
      } else {
        walk.spider = undefined;
        walk.path = findPath(
          this.tiles,
          this.state.players.get(id)!,
          action.to,
        );
      }
    }
    this.queuedActions.clear();
    this.loggedOut.push(...this.queuedLogouts);
    this.queuedLogouts.clear();
  }

  private advancePlayers() {
    for (const [id, walk] of this.walks) {
      // nextStepTick outlives each walk, so clicking again can't beat the walking speed.
      if (this.state.tick < walk.nextStepTick) continue;
      const player = this.state.players.get(id)!;
      if (walk.spider !== undefined) {
        // Re-pathed every step since it can move. A path's last step lands on its tile, so
        // stopping short of that is exactly "next to" (spec D1).
        const spider = this.state.spiders.get(walk.spider)!;
        walk.path = findPath(this.tiles, player, spider).slice(0, -1);
      }
      if (!walk.path.length) continue;
      Object.assign(player, walk.path.shift());
      walk.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
    }
  }

  private advanceSpiders() {
    for (const [id, home] of this.spiderHomes) {
      const spider = this.state.spiders.get(id)!;
      if (spider.state !== "idle" || this.state.tick < home.nextStepTick) {
        continue;
      }
      if (this.random() >= SPIDER_WANDER_CHANCE) continue;
      const steps = legalSteps(this.tiles, spider).filter(
        ({ x, y }) =>
          Math.max(Math.abs(x - home.x), Math.abs(y - home.y)) <=
          SPIDER_WANDER_TILES,
      );
      Object.assign(spider, steps[Math.floor(this.random() * steps.length)]);
      home.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
    }
  }
}
