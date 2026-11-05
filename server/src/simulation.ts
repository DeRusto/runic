import { ArraySchema, schema, t } from "@colyseus/schema";
import {
  BUSHES,
  bushId,
  bushRefusal,
  COMBAT_LEVELS_PER_DAMAGE,
  COMBAT_LOCK_TICKS,
  DEFENSE_XP_PER_DAMAGE_TAKEN,
  DEFENSE_XP_PER_SPIDER_SWING,
  EAT_INTERVAL_TICKS,
  EAT_SWING_DELAY_TICKS,
  EMPTY_SLOT,
  FOOD_HEALS,
  INVENTORY_SLOTS,
  levelFor,
  MAX_XP,
  pickChance,
  pickIntervalTicks,
  PLAYER_BASE_DAMAGE,
  PLAYER_DEAD_TICKS,
  PLAYER_HIT_CHANCE,
  PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL,
  REGEN_INTERVAL_TICKS,
  REGEN_PERCENT_OF_MAX_HEALTH,
  respawnTile,
  LEASH_TILES,
  SPIDER_FIRST_SWING_DELAY_TICKS,
  SPIDER_HEALTH,
  SPIDER_HIT_CHANCE,
  SPIDER_HIT_CHANCE_PER_DEFENSE_LEVEL,
  SPIDER_MAX_DAMAGE,
  SPIDER_RESPAWN_TICKS,
  SPIDER_WANDER_CHANCE,
  SPIDER_WANDER_TILES,
  SWING_INTERVAL_TICKS,
  TILE_KINDS,
  STARTING_HEALTH,
  STARTING_HITPOINTS_XP,
  WALK_TICKS_PER_TILE,
  type BushKind,
  XP_PER_DAMAGE_DEALT,
  type Tile,
  type TileKind,
  type WorldEvent,
} from "@runic/shared";
import { findPath, legalSteps, pathNextTo } from "./pathfinding.ts";
import type { PlayerSave } from "./saves.ts";

/** Distance in 8-way tiles. */
const tilesApart = (a: Tile, b: Tile) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

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
    /** The id of the Spider this player is after, or "". */
    target: t.string().default(""),
    dead: t.boolean().default(false),
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

export const Bush = schema({ picksLeft: t.uint8() }, "Bush");

export const WorldState = schema(
  {
    tick: t.uint32().default(0),
    players: t.map(Player),
    spiders: t.map(Spider),
    bushes: t.map(Bush),
  },
  "WorldState",
);

/** The whole game: rules and state, with no network. Tests and the room both drive it through tick(). */
export class Simulation {
  state = new WorldState();
  /** Only the latest click per player counts, so a flood of them costs one path per tick. */
  private queuedActions = new Map<
    string,
    { to: Tile } | { spider: string } | { bush: string }
  >();
  private walks = new Map<
    string,
    {
      path: Tile[];
      nextStepTick: number;
      nextSwingTick: number;
      spider?: string;
      bush?: string;
      /** Outlives the action, so clicking again can't beat the attempt interval. */
      nextPickTick: number;
      nextEatTick: number;
      /** The combat lock runs until this tick. */
      lockEndTick: number;
      respawnTick: number;
      dropped?: boolean;
    }
  >();
  /** Apart from the action, which eating doesn't replace (spec §4). */
  private queuedEats = new Map<string, number>();
  private spiderHomes = new Map<
    string,
    Tile & {
      nextStepTick: number;
      nextSwingTick: number;
      returnTick: number;
      fightStart: Tile;
    }
  >();
  private bushSites = new Map<
    string,
    Tile & { kind: BushKind; regrowTick?: number }
  >();
  private queuedLogouts = new Set<string>();
  /** Players whose log out intent was accepted, for the room to disconnect. */
  readonly loggedOut: string[] = [];
  /** This tick's one-shot moments, for the room to broadcast after the patch and empty. */
  readonly events: WorldEvent[] = [];

  constructor(
    private tiles: TileKind[][],
    readonly random: () => number,
  ) {
    tiles.forEach((row, y) =>
      row.forEach((kind, x) => {
        const { prop } = kind;
        if (prop === "berryBush" || prop === "herbBush") {
          this.bushSites.set(bushId({ x, y }), { x, y, kind: prop });
          this.state.bushes.set(
            bushId({ x, y }),
            Object.assign(new Bush(), { picksLeft: BUSHES[prop].picks }),
          );
        }
        if (kind !== TILE_KINDS.S) return;
        const id = String(this.spiderHomes.size);
        this.spiderHomes.set(id, {
          x,
          y,
          nextStepTick: 0,
          nextSwingTick: 0,
          returnTick: 0,
          fightStart: { x, y },
        });
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
    this.walks.set(id, {
      path: [],
      nextStepTick: 0,
      nextSwingTick: 0,
      nextPickTick: 0,
      nextEatTick: 0,
      lockEndTick: 0,
      respawnTick: 0,
    });
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
      // Or a save during death could bring someone back with 0 health (D13).
      ...(player.dead && this.respawned(player)),
    };
  }

  /** What dying changes, once it's over. */
  private respawned(player: InstanceType<typeof Player>) {
    return { ...respawnTile(this.tiles), health: player.maxHealth };
  }

  removePlayer(id: string) {
    this.state.players.delete(id);
    this.walks.delete(id);
    this.queuedActions.delete(id);
    this.queuedEats.delete(id);
    this.queuedLogouts.delete(id);
  }

  /** Lost connection but stays in the world: idle (D9), and still there to be hit. */
  dropPlayer(id: string) {
    const walk = this.walks.get(id)!;
    walk.path = [];
    walk.spider = walk.bush = undefined;
    walk.dropped = true;
    this.queuedActions.delete(id);
    this.queuedEats.delete(id);
    this.queuedLogouts.delete(id);
  }

  reconnectPlayer(id: string) {
    this.walks.get(id)!.dropped = false;
  }

  lockRunning(id: string) {
    return this.state.tick < (this.walks.get(id)?.lockEndTick ?? 0);
  }

  queueLogout(id: string) {
    if (this.state.players.has(id)) this.queuedLogouts.add(id);
  }

  /** Checked as an intent arrives. Enough, since death comes after intents apply in a tick. */
  private alive(id: string) {
    const player = this.state.players.get(id);
    return player !== undefined && !player.dead;
  }

  /** `to` comes straight off the network, so anything but a tile on the grid is ignored. */
  queueWalk(id: string, to: Tile) {
    if (!this.alive(id)) return;
    if (!Number.isInteger(to?.x) || !Number.isInteger(to?.y)) return;
    if (!this.tiles[to.y]?.[to.x]) return;
    this.queuedActions.set(id, { to: { x: to.x, y: to.y } });
  }

  /** `spider` comes straight off the network, so anything but a live Spider's id is ignored. */
  queueTarget(id: string, spider: string) {
    if (!this.alive(id)) return;
    const target = this.state.spiders.get(spider);
    if (!target || target.state === "dead") return;
    this.queuedActions.set(id, { spider });
  }

  /** `bush` comes straight off the network, so anything but a bush's id is ignored, as is a click the rules refuse. */
  queueForage(id: string, bush: string) {
    const player = this.state.players.get(id);
    const site = this.bushSites.get(bush);
    if (!player || !site || player.dead) return;
    const { picksLeft } = this.state.bushes.get(bush)!;
    if (bushRefusal(site.kind, picksLeft, player)) return;
    this.queuedActions.set(id, { bush });
  }

  /** `slot` comes straight off the network, so anything but a slot's index is ignored. */
  queueEat(id: string, slot: number) {
    if (!this.alive(id)) return;
    if (!Number.isInteger(slot) || slot < 0 || slot >= INVENTORY_SLOTS) return;
    this.queuedEats.set(id, slot);
  }

  private eat(id: string, slot: number) {
    const player = this.state.players.get(id)!;
    const walk = this.walks.get(id)!;
    const heals = FOOD_HEALS.get(player.inventory[slot]);
    if (heals === undefined || this.state.tick < walk.nextEatTick) return;
    walk.nextEatTick = this.state.tick + EAT_INTERVAL_TICKS;
    // From now if no swing is waiting, or a past timer would swallow the delay.
    walk.nextSwingTick =
      Math.max(walk.nextSwingTick, this.state.tick) + EAT_SWING_DELAY_TICKS;
    player.inventory[slot] = EMPTY_SLOT;
    const health = Math.min(player.health + heals, player.maxHealth);
    this.events.push({
      type: "eaten",
      player: id,
      healed: health - player.health,
    });
    player.health = health;
  }

  /** One tick, in the order of spec §6. */
  tick() {
    this.state.tick++;
    this.applyIntents();
    this.advancePlayers();
    this.advancePicks();
    this.advancePlayerSwings();
    this.advanceSpiders();
    this.advancePlayerTimers();
    this.advanceBushes();
    this.advanceSpiderReturns();
  }

  private applyIntents() {
    for (const [id, action] of this.queuedActions) {
      const walk = this.walks.get(id)!;
      walk.bush = undefined;
      if ("spider" in action) {
        walk.spider = action.spider;
      } else if ("bush" in action) {
        walk.spider = undefined;
        const path = pathNextTo(
          this.tiles,
          this.state.players.get(id)!,
          this.bushSites.get(action.bush)!,
        );
        walk.path = path ?? [];
        if (path) walk.bush = action.bush;
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
    for (const [id, slot] of this.queuedEats) this.eat(id, slot);
    this.queuedEats.clear();
    for (const id of this.queuedLogouts) {
      if (this.state.tick >= this.walks.get(id)!.lockEndTick) {
        this.loggedOut.push(id);
      }
    }
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

  /** After the steps, so the first attempt lands on the tick of arrival (D5). */
  private advancePicks() {
    for (const [id, walk] of this.walks) {
      if (walk.bush === undefined || walk.path.length) continue;
      const player = this.state.players.get(id)!;
      const site = this.bushSites.get(walk.bush)!;
      const bush = this.state.bushes.get(walk.bush)!;
      if (bushRefusal(site.kind, bush.picksLeft, player)) {
        walk.bush = undefined;
        continue;
      }
      if (this.state.tick < walk.nextPickTick) continue;
      const level = levelFor(player.foragingXp);
      walk.nextPickTick = this.state.tick + pickIntervalTicks(level);
      const success = this.random() < pickChance(site.kind, level);
      this.events.push({ type: "pick", player: id, success });
      if (!success) continue;
      const { xp, food, regrowTicks } = BUSHES[site.kind];
      player.foragingXp = Math.min(player.foragingXp + xp, MAX_XP);
      player.inventory[player.inventory.indexOf(EMPTY_SLOT)] = food;
      if (--bush.picksLeft === 0)
        site.regrowTick = this.state.tick + regrowTicks;
      walk.bush = undefined;
    }
  }

  private advanceBushes() {
    for (const [id, site] of this.bushSites) {
      if (this.state.tick !== site.regrowTick) continue;
      this.state.bushes.get(id)!.picksLeft = BUSHES[site.kind].picks;
      site.regrowTick = undefined;
    }
  }

  /** After the moves, so the first swing lands on the tick the player arrives. */
  private advancePlayerSwings() {
    for (const [id, walk] of this.walks) {
      if (walk.spider === undefined) continue;
      const player = this.state.players.get(id)!;
      const spider = this.state.spiders.get(walk.spider)!;
      if (this.state.tick < walk.nextSwingTick) continue;
      if (!this.nextTo(player, spider)) continue;
      walk.nextSwingTick = this.state.tick + SWING_INTERVAL_TICKS;
      this.playerSwing(id, player, walk.spider, spider);
    }
    for (const [id, walk] of this.walks) {
      this.state.players.get(id)!.target = walk.spider ?? "";
    }
  }

  /** Next to is one legal step away or on the same tile (spec D1). */
  private nextTo(a: Tile, b: Tile) {
    return (
      (a.x === b.x && a.y === b.y) ||
      legalSteps(this.tiles, a).some(({ x, y }) => x === b.x && y === b.y)
    );
  }

  /** The damage of one swing, 0 for a miss. */
  private rollDamage(hitChance: number, maxDamage: number) {
    return this.random() < hitChance
      ? 1 + Math.floor(this.random() * maxDamage)
      : 0;
  }

  private playerSwing(
    id: string,
    player: InstanceType<typeof Player>,
    spiderId: string,
    spider: InstanceType<typeof Spider>,
  ) {
    this.lock(id);
    const combat = levelFor(player.combatXp);
    const damage = Math.min(
      this.rollDamage(
        PLAYER_HIT_CHANCE + PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL * (combat - 1),
        PLAYER_BASE_DAMAGE + Math.floor(combat / COMBAT_LEVELS_PER_DAMAGE),
      ),
      spider.health, // No XP for overkill.
    );
    const xp = damage * XP_PER_DAMAGE_DEALT;
    player.combatXp = Math.min(player.combatXp + xp, MAX_XP);
    player.hitpointsXp = Math.min(player.hitpointsXp + xp, MAX_XP);
    player.maxHealth = levelFor(player.hitpointsXp);
    this.events.push({
      type: "playerSwing",
      player: id,
      spider: spiderId,
      damage,
    });

    const home = this.spiderHomes.get(spiderId)!;
    if (spider.state !== "fighting") {
      spider.state = "fighting";
      home.fightStart = { x: spider.x, y: spider.y };
      // Its timer outlives a fight, like the player's (spec D2).
      home.nextSwingTick = Math.max(
        home.nextSwingTick,
        this.state.tick + SPIDER_FIRST_SWING_DELAY_TICKS,
      );
    }
    spider.target = id;
    spider.health -= damage;
    if (spider.health > 0) return;

    spider.state = "dead";
    spider.target = "";
    home.returnTick = this.state.tick + SPIDER_RESPAWN_TICKS;
    this.events.push({ type: "spiderDied", spider: spiderId });
    for (const walk of this.walks.values()) {
      if (walk.spider !== spiderId) continue;
      walk.spider = undefined;
      walk.path = [];
    }
  }

  /** One step towards `to`, if a step is due. `stopNextTo` stays off its tile (spec D1). */
  private stepSpider(
    spider: InstanceType<typeof Spider>,
    home: { nextStepTick: number },
    to: Tile,
    stopNextTo: boolean,
  ) {
    if (this.state.tick < home.nextStepTick) return;
    const path = findPath(this.tiles, spider, to);
    if (stopNextTo) path.pop();
    if (!path.length) return;
    Object.assign(spider, path[0]);
    home.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
  }

  private spiderSwing(
    id: string,
    spider: InstanceType<typeof Spider>,
    player: InstanceType<typeof Player>,
    home: { nextSwingTick: number },
  ) {
    if (this.state.tick < home.nextSwingTick || !this.nextTo(spider, player)) {
      return;
    }
    home.nextSwingTick = this.state.tick + SWING_INTERVAL_TICKS;
    this.lock(spider.target);
    const defense = levelFor(player.defenseXp);
    const damage = Math.min(
      this.rollDamage(
        SPIDER_HIT_CHANCE + SPIDER_HIT_CHANCE_PER_DEFENSE_LEVEL * (defense - 1),
        SPIDER_MAX_DAMAGE,
      ),
      player.health,
    );
    player.health -= damage;
    player.defenseXp = Math.min(
      player.defenseXp +
        DEFENSE_XP_PER_SPIDER_SWING +
        damage * DEFENSE_XP_PER_DAMAGE_TAKEN,
      MAX_XP,
    );
    this.events.push({
      type: "spiderSwing",
      spider: id,
      player: spider.target,
      damage,
    });
    if (player.health === 0) this.die(spider.target, player);
  }

  /** Not refreshed while dropped, or a Spider's swings would hold them here until killed (Q3). */
  lock(id: string) {
    const walk = this.walks.get(id)!;
    if (!walk.dropped) walk.lockEndTick = this.state.tick + COMBAT_LOCK_TICKS;
  }

  private die(id: string, player: InstanceType<typeof Player>) {
    const walk = this.walks.get(id)!;
    player.dead = true;
    player.target = "";
    walk.path = [];
    walk.spider = walk.bush = undefined;
    walk.respawnTick = this.state.tick + PLAYER_DEAD_TICKS;
    this.events.push({ type: "playerDied", player: id });
  }

  private advancePlayerTimers() {
    const regenerates = this.state.tick % REGEN_INTERVAL_TICKS === 0;
    for (const [id, walk] of this.walks) {
      const player = this.state.players.get(id)!;
      if (player.dead) {
        if (this.state.tick < walk.respawnTick) continue;
        Object.assign(player, this.respawned(player), { dead: false });
        walk.lockEndTick = 0;
        this.events.push({ type: "playerRespawned", player: id });
      } else if (regenerates && this.state.tick >= walk.lockEndTick) {
        const heals = Math.ceil(
          (player.maxHealth * REGEN_PERCENT_OF_MAX_HEALTH) / 100,
        );
        player.health = Math.min(player.health + heals, player.maxHealth);
      }
    }
  }

  private advanceSpiderReturns() {
    for (const [id, home] of this.spiderHomes) {
      const spider = this.state.spiders.get(id)!;
      if (spider.state !== "dead" || this.state.tick < home.returnTick) {
        continue;
      }
      Object.assign(spider, {
        x: home.x,
        y: home.y,
        health: SPIDER_HEALTH,
        state: "idle",
      });
      this.events.push({ type: "spiderReturned", spider: id });
    }
  }

  private advanceSpiders() {
    for (const [id, home] of this.spiderHomes) {
      const spider = this.state.spiders.get(id)!;
      if (spider.state === "fighting") {
        const target = this.state.players.get(spider.target);
        if (
          target &&
          target.health > 0 &&
          tilesApart(target, home.fightStart) <= LEASH_TILES
        ) {
          this.stepSpider(spider, home, target, true);
          this.spiderSwing(id, spider, target, home);
          if (target.health > 0) continue;
        }
        spider.state = "going home";
        spider.target = "";
      }
      if (spider.state === "going home") {
        this.stepSpider(spider, home, home, false);
        if (tilesApart(spider, home) === 0) {
          spider.health = SPIDER_HEALTH;
          spider.state = "idle";
        }
        continue;
      }
      if (spider.state !== "idle" || this.state.tick < home.nextStepTick) {
        continue;
      }
      if (this.random() >= SPIDER_WANDER_CHANCE) continue;
      const steps = legalSteps(this.tiles, spider).filter(
        (step) => tilesApart(step, home) <= SPIDER_WANDER_TILES,
      );
      Object.assign(spider, steps[Math.floor(this.random() * steps.length)]);
      home.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
    }
  }
}
