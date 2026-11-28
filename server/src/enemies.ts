import {
  canShootAt,
  ELITE_HEALTH_MULTIPLIER,
  ELITE_RETURN_CHANCE,
  ENEMIES,
  effectOf,
  type CombatSpell,
  rollLoot,
  tilesApart,
  WALK_TICKS_PER_TILE,
  type LootWon,
  type Tile,
  type TileKind,
} from "@runic/shared";
import { EnemyEffects } from "./enemyEffects.ts";
import { Enemy, type EnemyWorld, type SyncedEnemy } from "./enemyState.ts";
import { findPath, legalSteps, nextTo, pathToFirst } from "./pathfinding.ts";

export { Enemy, type EnemyWorld } from "./enemyState.ts";

/** What an enemy remembers that clients don't: its home tile, timers and who has damaged it. */
type Memory = {
  home: Tile;
  nextStepTick: number;
  nextSwingTick: number;
  returnTick: number;
  effects: EnemyEffects;
  leashOrigin: Tile;
  /** Who has damaged it since it last recovered or returned. Not saved (spec §6). */
  damagers: Set<string>;
};

/**
 * Every enemy in the region, from its tile in the map: its synced entry in `synced`, and what it
 * remembers. It notices, chases, leashes, wanders and goes home on its own; the world rolls and
 * applies the swings it asks for, and tells it when a player attacks.
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
          effects: new EnemyEffects(),
          leashOrigin: { x, y },
          damagers: new Set(),
        });
        synced.set(
          id,
          Object.assign(new Enemy(), {
            x,
            y,
            kind: enemy,
            health: ENEMIES[enemy].health,
            maxHealth: ENEMIES[enemy].health,
          }),
        );
      }),
    );
  }

  /**
   * A player's attack dealt `damage`, 0 for a miss. It renews the chase unless the enemy is
   * docile (#238). Returns each damager's loot
   * if this killed it, and undefined if it lives.
   */
  takeHit(
    tick: number,
    enemyId: string,
    playerId: string,
    damage: number,
    attacker: Tile,
    spell?: CombatSpell,
  ): LootWon[] | undefined {
    const enemy = this.synced.get(enemyId)!;
    const memory = this.memories.get(enemyId)!;
    const { docile, returnTicks, loot, bone } = ENEMIES[enemy.kind];
    if (!docile) {
      if (enemy.state !== "fighting") this.startFight(tick, enemy, memory);
      enemy.target = playerId;
      memory.leashOrigin = { x: attacker.x, y: attacker.y };
    }
    if (damage) memory.damagers.add(playerId);
    enemy.health -= damage;
    if (enemy.health > 0) {
      const effect = damage && spell ? effectOf(spell) : undefined;
      if (effect)
        memory.effects.apply(enemy, effect, tick, memory.nextSwingTick);
      return undefined;
    }
    memory.effects.clear(enemy);
    enemy.state = "dead";
    enemy.target = "";
    memory.returnTick = tick + returnTicks;
    // It starts over, as it can't be damaged until it returns.
    const won = rollLoot(loot, memory.damagers, this.random, bone, enemy.elite);
    memory.damagers.clear();
    return won;
  }

  /** Accuracy points a running air spell takes from this enemy. */
  accuracyPenalty(id: string) {
    return this.memories.get(id)!.effects.accuracyPenalty;
  }

  /** One tick of every enemy, in order, so a swing's result shows to the enemies after it. */
  advance(world: EnemyWorld) {
    const { tick } = world;
    for (const [id, memory] of this.memories) {
      const enemy = this.synced.get(id)!;
      memory.effects.advance(enemy, tick);
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
          !target.dead &&
          target.health > 0 &&
          tilesApart(target, memory.leashOrigin) <= stats.leashTiles &&
          this.chase(tick, enemy, memory, target)
        ) {
          if (
            !enemy.water &&
            tick >= memory.nextSwingTick &&
            this.canAttack(enemy, target)
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
        this.goHome(tick, enemy, memory);
        if (tilesApart(enemy, memory.home) === 0) {
          enemy.health = enemy.maxHealth;
          enemy.state = "idle";
          memory.damagers.clear();
          memory.effects.clear(enemy);
        }
        continue;
      }
      if (enemy.state !== "idle" || enemy.earth || tick < memory.nextStepTick)
        continue;
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
      const { docile, health } = ENEMIES[enemy.kind];
      const elite = !docile && this.random() < ELITE_RETURN_CHANCE;
      const maxHealth = elite ? health * ELITE_HEALTH_MULTIPLIER : health;
      Object.assign(enemy, {
        ...memory.home,
        elite,
        maxHealth,
        health: maxHealth,
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
    memory.leashOrigin = { x: enemy.x, y: enemy.y };
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
    for (const { id, player, dropped, hittable } of world.players()) {
      const tiles = tilesApart(enemy, player);
      if (player.dead || dropped || !hittable || chased.has(id)) continue;
      // Strictly nearer, so a tie stays with whoever was checked first.
      if (tiles >= nearestTiles || !this.pathToTarget(enemy, player)) continue;
      nearest = id;
      nearestTiles = tiles;
    }
    return nearest;
  }

  /** Undefined means the target cannot be reached, even by a route around an obstacle. */
  private pathToTarget(enemy: Tile, target: Tile) {
    const path = pathToFirst(
      this.tiles,
      enemy,
      ({ x, y }) => x === target.x && y === target.y,
    );
    path?.pop(); // Stay on the last tile before the target.
    return path;
  }

  private canAttack(enemy: SyncedEnemy, target: Tile) {
    const { reachTiles } = ENEMIES[enemy.kind];
    return reachTiles === undefined
      ? nextTo(this.tiles, enemy, target)
      : canShootAt(this.tiles, enemy, target, reachTiles);
  }

  private chase(
    tick: number,
    enemy: SyncedEnemy,
    memory: Memory,
    target: Tile,
  ) {
    if (enemy.earth || tick < memory.nextStepTick) return true;
    if (
      ENEMIES[enemy.kind].reachTiles !== undefined &&
      this.canAttack(enemy, target)
    )
      return true;
    const path = this.pathToTarget(enemy, target);
    if (!path) return false;
    if (path.length) this.step(tick, enemy, memory, path[0]!);
    return true;
  }

  private goHome(tick: number, enemy: SyncedEnemy, memory: Memory) {
    if (enemy.earth || tick < memory.nextStepTick) return;
    const [step] = findPath(this.tiles, enemy, memory.home);
    if (step) this.step(tick, enemy, memory, step);
  }

  private step(tick: number, enemy: SyncedEnemy, memory: Memory, to: Tile) {
    Object.assign(enemy, to);
    memory.nextStepTick = tick + WALK_TICKS_PER_TILE;
  }
}
