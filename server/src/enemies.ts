import { schema, t } from "@colyseus/schema";
import {
  ENEMIES,
  rollLoot,
  tilesApart,
  WALK_TICKS_PER_TILE,
  type EnemyKind,
  type EnemyState,
  type LootWon,
  type Tile,
  type TileKind,
} from "@runic/shared";
import { findPath, legalSteps, nextTo } from "./pathfinding.ts";

export const Enemy = schema(
  {
    x: t.uint8(),
    y: t.uint8(),
    kind: t.string<EnemyKind>(),
    health: t.uint16(),
    target: t.string().default(""),
    state: t.string<EnemyState>().default("idle"),
  },
  "Enemy",
);
type SyncedEnemy = InstanceType<typeof Enemy>;

/** What an enemy remembers that clients don't: its home tile, timers and who has damaged it. */
type Memory = {
  home: Tile;
  nextStepTick: number;
  nextSwingTick: number;
  returnTick: number;
  fightStart: Tile;
  /** Who has damaged it since it last recovered or returned. Not saved (spec §6). */
  damagers: Set<string>;
};

/** A player as an enemy sees one: where they are and how much health they have, read live. */
type Fighter = Tile & { health: number };

/** What `advance` needs from the world on one tick. */
export type EnemyWorld = {
  tick: number;
  /** Every player in join order, as noticing checks them: a tie stays with the first. */
  players(): Iterable<{
    id: string;
    player: Fighter & { dead: boolean };
    dropped: boolean;
  }>;
  /** A player, live, so a swing's damage shows at once; undefined once they have left. */
  player(id: string): Fighter | undefined;
  /** Rolls a swing that is due and applies it to the player. It may change their health. */
  swing(enemyId: string, playerId: string): void;
};

/**
 * Every enemy in the region, from its tile in the map: its synced entry in `synced`, and what it
 * remembers. It notices, chases, leashes, wanders and goes home on its own; the world rolls and
 * applies the swings it asks for, and tells it when a player's swing lands.
 */
export class Enemies {
  private memories = new Map<string, Memory>();

  constructor(
    private tiles: TileKind[][],
    private synced: Map<string, SyncedEnemy>,
    private random: () => number,
  ) {
    tiles.forEach((row, y) =>
      row.forEach(({ enemy }, x) => {
        if (!enemy) return;
        const id = String(this.memories.size);
        this.memories.set(id, {
          home: { x, y },
          nextStepTick: 0,
          nextSwingTick: 0,
          returnTick: 0,
          fightStart: { x, y },
          damagers: new Set(),
        });
        synced.set(
          id,
          Object.assign(new Enemy(), {
            x,
            y,
            kind: enemy,
            health: ENEMIES[enemy].health,
          }),
        );
      }),
    );
  }

  /**
   * A player's swing landed for `damage`, 0 for a miss. It turns to fight them, unless it is
   * docile (#238) or attacks first and is on its way home (spec §4). Returns each damager's loot
   * if this killed it, and undefined if it lives.
   */
  takeHit(
    tick: number,
    enemyId: string,
    playerId: string,
    damage: number,
  ): LootWon[] | undefined {
    const enemy = this.synced.get(enemyId)!;
    const memory = this.memories.get(enemyId)!;
    const { noticeTiles, docile, returnTicks } = ENEMIES[enemy.kind];
    if (
      !docile &&
      (enemy.state !== "going home" || noticeTiles === undefined)
    ) {
      if (enemy.state !== "fighting") this.startFight(tick, enemy, memory);
      enemy.target = playerId;
    }
    if (damage) memory.damagers.add(playerId);
    enemy.health -= damage;
    if (enemy.health > 0) return undefined;
    enemy.state = "dead";
    enemy.target = "";
    memory.returnTick = tick + returnTicks;
    // It starts over, as it can't be damaged until it returns.
    const loot = rollLoot(
      ENEMIES[enemy.kind].loot,
      memory.damagers,
      this.random,
    );
    memory.damagers.clear();
    return loot;
  }

  /** One tick of every enemy, in order, so a swing's result shows to the enemies after it. */
  advance(world: EnemyWorld) {
    const { tick } = world;
    for (const [id, memory] of this.memories) {
      const enemy = this.synced.get(id)!;
      const stats = ENEMIES[enemy.kind];
      // A docile creature stands: no noticing, wandering or fighting, dead or alive (#238).
      if (stats.docile) continue;
      if (enemy.state === "idle" && stats.noticeTiles !== undefined) {
        const noticed = this.noticedBy(enemy, stats.noticeTiles, world);
        if (noticed !== undefined) {
          this.startFight(tick, enemy, memory);
          enemy.target = noticed;
        }
      }
      if (enemy.state === "fighting") {
        const target = world.player(enemy.target);
        if (
          target &&
          target.health > 0 &&
          tilesApart(target, memory.fightStart) <= stats.leashTiles
        ) {
          this.step(tick, enemy, memory, target, true);
          if (
            tick >= memory.nextSwingTick &&
            nextTo(this.tiles, enemy, target)
          ) {
            memory.nextSwingTick = tick + stats.swingIntervalTicks;
            world.swing(id, enemy.target);
          }
          if (target.health > 0) continue;
        }
        enemy.state = "going home";
        enemy.target = "";
      }
      if (enemy.state === "going home") {
        this.step(tick, enemy, memory, memory.home, false);
        if (tilesApart(enemy, memory.home) === 0) {
          enemy.health = stats.health;
          enemy.state = "idle";
          memory.damagers.clear();
        }
        continue;
      }
      if (enemy.state !== "idle" || tick < memory.nextStepTick) continue;
      if (this.random() >= stats.wanderChance) continue;
      const steps = legalSteps(this.tiles, enemy).filter(
        (step) => tilesApart(step, memory.home) <= stats.wanderTiles,
      );
      Object.assign(enemy, steps[Math.floor(this.random() * steps.length)]);
      memory.nextStepTick = tick + WALK_TICKS_PER_TILE;
    }
  }

  /** Brings back, at home and full health, every dead enemy whose time is up. Returns their ids. */
  returnDead(tick: number) {
    const returned: string[] = [];
    for (const [id, memory] of this.memories) {
      const enemy = this.synced.get(id)!;
      if (enemy.state !== "dead" || tick < memory.returnTick) continue;
      Object.assign(enemy, {
        ...memory.home,
        health: ENEMIES[enemy.kind].health,
        state: "idle",
      });
      returned.push(id);
    }
    return returned;
  }

  /** A leaver wins no loot (spec D8). */
  forget(playerId: string) {
    for (const memory of this.memories.values())
      memory.damagers.delete(playerId);
  }

  private startFight(tick: number, enemy: SyncedEnemy, memory: Memory) {
    enemy.state = "fighting";
    memory.fightStart = { x: enemy.x, y: enemy.y };
    // Its timer outlives a fight, like the player's (spec D2).
    memory.nextSwingTick = Math.max(
      memory.nextSwingTick,
      tick + ENEMIES[enemy.kind].firstSwingDelayTicks,
    );
  }

  /** The nearest live, connected player in range that no other enemy of its kind is after (spec §4). */
  private noticedBy(
    enemy: SyncedEnemy,
    noticeTiles: number,
    world: EnemyWorld,
  ) {
    const chased = new Set(
      [...this.synced.values()]
        .filter(
          ({ kind, state }) => kind === enemy.kind && state === "fighting",
        )
        .map(({ target }) => target),
    );
    let nearest: string | undefined;
    let nearestTiles = noticeTiles + 1;
    for (const { id, player, dropped } of world.players()) {
      const tiles = tilesApart(enemy, player);
      if (player.dead || dropped || chased.has(id)) continue;
      // Strictly nearer, so a tie stays with whoever was checked first.
      if (tiles >= nearestTiles) continue;
      nearest = id;
      nearestTiles = tiles;
    }
    return nearest;
  }

  /** One step towards `to`, if a step is due. `stopNextTo` stays off its tile (spec D1). */
  private step(
    tick: number,
    enemy: SyncedEnemy,
    memory: Memory,
    to: Tile,
    stopNextTo: boolean,
  ) {
    if (tick < memory.nextStepTick) return;
    const path = findPath(this.tiles, enemy, to);
    if (stopNextTo) path.pop();
    if (!path.length) return;
    Object.assign(enemy, path[0]);
    memory.nextStepTick = tick + WALK_TICKS_PER_TILE;
  }
}
