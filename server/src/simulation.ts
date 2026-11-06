import { ArraySchema, schema, t } from "@colyseus/schema";
import {
  BUSHES,
  bushId,
  bushRefusal,
  addXp,
  BLOCK_CHANCE_PER_BLOCKING_LEVEL,
  BLOCKING_XP_PER_BLOCK,
  COMBAT_LEVELS_PER_DAMAGE,
  COMBAT_LOCK_TICKS,
  costsOf,
  DEFENSE_XP_PER_DAMAGE_TAKEN,
  DEFENSE_XP_PER_ENEMY_SWING,
  EAT_INTERVAL_TICKS,
  EAT_SWING_DELAY_TICKS,
  EMPTY_SLOT,
  FIGHT_BACK_DELAY_TICKS,
  FOOD_HEALS,
  GEAR,
  GEAR_SLOTS,
  gearRefusal,
  HEALING_POOL_INTERVAL_TICKS,
  INVENTORY_SLOTS,
  levelFor,
  makeRefusal,
  MAX_PINNED_SKILLS,
  mineChance,
  pickChance,
  pickIntervalTicks,
  PLAYER_BASE_DAMAGE,
  PLAYER_DEAD_TICKS,
  PLAYER_HIT_CHANCE,
  PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL,
  RECIPES,
  REGEN_INTERVAL_TICKS,
  REGEN_PERCENT_OF_MAX_HEALTH,
  respawnTile,
  SKILLS,
  slotFor,
  STARTING_PINNED_SKILLS,
  stationRefusal,
  tilesApart,
  SWING_INTERVAL_TICKS,
  ENEMIES,
  STARTING_HEALTH,
  STARTING_HITPOINTS_XP,
  TOOLS,
  VEINS,
  veinId,
  veinRefusal,
  WALK_TICKS_PER_TILE,
  type BushKind,
  type PlayerAction,
  type EnemyKind,
  type EnemyState,
  type GearSlot,
  type RecipeItem,
  type StationKind,
  type Tier,
  XP_PER_DAMAGE_DEALT,
  type Tile,
  type TileKind,
  type WorldEvent,
} from "@runic/shared";
import { findPath, legalSteps, pathNextTo } from "./pathfinding.ts";
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
    miningXp: t.uint32().default(0),
    smithingXp: t.uint32().default(0),
    blockingXp: t.uint32().default(0),
    /** In any order; the sheet's order decides how they show. */
    pinnedSkills: t.array("string"),
    health: t.uint8(),
    maxHealth: t.uint8(),
    inventory: t.array("string"),
    /** Parallel to `inventory`: how many in each slot, 0 for an empty one. */
    inventoryCounts: t.array("uint8"),
    tools: t.array("string"),
    /** The item id worn in each gear slot, or "". */
    weapon: t.string().default(""),
    shield: t.string().default(""),
    /** The id of the enemy this player is after, or "". */
    target: t.string().default(""),
    action: t.string<PlayerAction>().default(""),
    dead: t.boolean().default(false),
  },
  "Player",
);

export const Enemy = schema(
  {
    x: t.uint8(),
    y: t.uint8(),
    kind: t.string<EnemyKind>(),
    health: t.uint8(),
    target: t.string().default(""),
    state: t.string<EnemyState>().default("idle"),
  },
  "Enemy",
);

export const Bush = schema({ picksLeft: t.uint8() }, "Bush");

export const Vein = schema({ oreLeft: t.uint8() }, "Vein");

export const WorldState = schema(
  {
    tick: t.uint32().default(0),
    players: t.map(Player),
    enemies: t.map(Enemy),
    bushes: t.map(Bush),
    veins: t.map(Vein),
  },
  "WorldState",
);

/** The whole game: rules and state, with no network. Tests and the room both drive it through tick(). */
export class Simulation {
  state = new WorldState();
  /** Only the latest click per player counts, so a flood of them costs one path per tick. */
  private queuedActions = new Map<
    string,
    | { to: Tile }
    | { enemy: string }
    | { bush: string }
    | { vein: string }
    | { blacksmith: Tile }
    | { make: RecipeItem; all: boolean }
  >();
  /** What a player's action and timers need that clients don't. */
  private unsyncedPlayers = new Map<
    string,
    {
      path: Tile[];
      nextStepTick: number;
      nextSwingTick: number;
      enemy?: string;
      bush?: string;
      vein?: string;
      visiting?: boolean;
      /** `doneTick` stays unset until arrival starts the first wait. */
      making?: { item: RecipeItem; all: boolean; doneTick?: number };
      /** Outlives the action, so clicking again can't beat the attempt interval. */
      nextPickTick: number;
      nextEatTick: number;
      /** Health eaten but not yet given. Not saved, so leaving loses it (spec §6). */
      healingPool: number;
      /** The combat lock runs until this tick. */
      lockEndTick: number;
      respawnTick: number;
      dropped?: boolean;
    }
  >();
  /** Apart from the action, which eating doesn't replace (spec §4). */
  private queuedEats = new Map<string, number>();
  /** Apart from the action too, which discarding doesn't replace (spec §4). */
  private queuedDiscards = new Map<string, number>();
  /** By username, so joining again can't beat the attempt or eat interval. */
  private timersOfLeavers = new Map<
    string,
    { nextPickTick: number; nextEatTick: number }
  >();
  /** Each enemy's home tile, plus the timers clients don't need. */
  private unsyncedEnemies = new Map<
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
  private veinSites = new Map<
    string,
    Tile & { tier: Tier; regrowTick?: number }
  >();
  private blacksmith?: Tile;
  private stations: Partial<Record<StationKind, Tile>> = {};
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
        const { bush, vein, enemy, blacksmith, station } = kind;
        if (blacksmith) this.blacksmith = { x, y };
        if (station) this.stations[station] = { x, y };
        if (bush) {
          this.bushSites.set(bushId({ x, y }), { x, y, kind: bush });
          this.state.bushes.set(
            bushId({ x, y }),
            Object.assign(new Bush(), { picksLeft: BUSHES[bush].picks }),
          );
        }
        if (vein) {
          this.veinSites.set(veinId({ x, y }), { x, y, tier: vein });
          this.state.veins.set(
            veinId({ x, y }),
            Object.assign(new Vein(), { oreLeft: VEINS[vein].ores }),
          );
        }
        if (!enemy) return;
        const id = String(this.unsyncedEnemies.size);
        this.unsyncedEnemies.set(id, {
          x,
          y,
          nextStepTick: 0,
          nextSwingTick: 0,
          returnTick: 0,
          fightStart: { x, y },
        });
        this.state.enemies.set(
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

  /** `saved` is the account's last save; without one, this is a new account. */
  addPlayer(id: string, saved?: PlayerSave, username = "") {
    const {
      inventory,
      inventoryCounts = [],
      pinnedSkills = STARTING_PINNED_SKILLS,
      tools = [],
      ...fields
    } = this.loginSave(saved);
    const player = Object.assign(new Player(), fields, {
      username,
      maxHealth: levelFor(fields.hitpointsXp),
    });
    player.pinnedSkills = new ArraySchema(...pinnedSkills);
    player.tools = new ArraySchema(...tools);
    player.inventory = new ArraySchema(...inventory);
    // A filled slot with no count is a stack of 1: every existing save's food (spec §6).
    player.inventoryCounts = new ArraySchema(
      ...inventory.map((item, slot) =>
        item === EMPTY_SLOT ? 0 : inventoryCounts[slot] || 1,
      ),
    );
    this.state.players.set(id, player);
    this.unsyncedPlayers.set(id, {
      path: [],
      nextStepTick: 0,
      nextSwingTick: 0,
      nextPickTick: 0,
      nextEatTick: 0,
      healingPool: 0,
      lockEndTick: 0,
      respawnTick: 0,
      ...this.timersOfLeavers.get(username),
    });
    this.timersOfLeavers.delete(username);
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
    const {
      x,
      y,
      combatXp,
      defenseXp,
      foragingXp,
      hitpointsXp,
      miningXp,
      smithingXp,
      blockingXp,
      health,
      weapon,
      shield,
    } = player;
    return {
      x,
      y,
      combatXp,
      defenseXp,
      foragingXp,
      hitpointsXp,
      miningXp,
      smithingXp,
      blockingXp,
      health,
      weapon,
      shield,
      pinnedSkills: [...player.pinnedSkills],
      inventory: [...player.inventory],
      inventoryCounts: [...player.inventoryCounts],
      tools: [...player.tools],
      // Or a save during death could bring someone back with 0 health (D13).
      ...(player.dead && this.respawned(player)),
    };
  }

  /** What dying changes, once it's over. */
  private respawned(player: InstanceType<typeof Player>) {
    return { ...respawnTile(this.tiles), health: player.maxHealth };
  }

  removePlayer(id: string) {
    const username = this.state.players.get(id)?.username;
    const unsynced = this.unsyncedPlayers.get(id);
    if (username && unsynced) {
      const { nextPickTick, nextEatTick } = unsynced;
      this.timersOfLeavers.set(username, { nextPickTick, nextEatTick });
    }
    this.state.players.delete(id);
    this.unsyncedPlayers.delete(id);
    this.queuedActions.delete(id);
    this.queuedEats.delete(id);
    this.queuedDiscards.delete(id);
    this.queuedLogouts.delete(id);
  }

  /** Lost connection but stays in the world: idle (D9), and still there to be hit. */
  dropPlayer(id: string) {
    this.clearAction(id);
    this.unsyncedPlayers.get(id)!.dropped = true;
    this.queuedActions.delete(id);
    this.queuedEats.delete(id);
    this.queuedDiscards.delete(id);
    this.queuedLogouts.delete(id);
  }

  private clearAction(id: string) {
    const unsynced = this.unsyncedPlayers.get(id)!;
    unsynced.path = [];
    unsynced.enemy = unsynced.bush = unsynced.vein = undefined;
    unsynced.making = undefined;
    unsynced.visiting = false;
    Object.assign(this.state.players.get(id)!, { target: "", action: "" });
  }

  reconnectPlayer(id: string) {
    this.unsyncedPlayers.get(id)!.dropped = false;
  }

  lockRunning(id: string) {
    return this.state.tick < (this.unsyncedPlayers.get(id)?.lockEndTick ?? 0);
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

  /** `enemy` comes straight off the network, so anything but a live enemy's id is ignored. */
  queueTarget(id: string, enemy: string) {
    if (!this.alive(id)) return;
    const target = this.state.enemies.get(enemy);
    if (!target || target.state === "dead") return;
    this.queuedActions.set(id, { enemy });
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

  /** `vein` comes straight off the network, so anything but a vein's id is ignored, as is a click the rules refuse. */
  queueMine(id: string, vein: string) {
    const player = this.state.players.get(id);
    const site = this.veinSites.get(vein);
    if (!player || !site || player.dead) return;
    const { oreLeft } = this.state.veins.get(vein)!;
    if (veinRefusal(site.tier, oreLeft, player)) return;
    this.queuedActions.set(id, { vein });
  }

  /**
   * Comes straight off the network, so anything but a recipe's item is ignored, as is an
   * anvil pick with no hammer. Level and materials wait for arrival (spec §4).
   */
  queueMake(id: string, intent: { item: string; all: boolean }) {
    const player = this.state.players.get(id);
    const { item, all } = intent ?? {};
    // A string first: an array of one would pass hasOwn by turning into its element.
    if (!player || player.dead || typeof item !== "string") return;
    if (!Object.hasOwn(RECIPES, item)) return;
    const make = item as RecipeItem;
    const { station } = RECIPES[make];
    if (!this.stations[station] || stationRefusal(station, player)) return;
    this.queuedActions.set(id, { make, all: all === true });
  }

  queueVisit(id: string) {
    if (this.alive(id) && this.blacksmith)
      this.queuedActions.set(id, { blacksmith: this.blacksmith });
  }

  /** `slot` comes straight off the network, so anything but a slot's index is ignored. */
  queueEat(id: string, slot: number) {
    if (!this.alive(id)) return;
    if (!Number.isInteger(slot) || slot < 0 || slot >= INVENTORY_SLOTS) return;
    this.queuedEats.set(id, slot);
  }

  /** `slot` comes straight off the network, so anything but a slot's index is ignored. */
  queueDiscard(id: string, slot: number) {
    if (!this.alive(id)) return;
    if (!Number.isInteger(slot) || slot < 0 || slot >= INVENTORY_SLOTS) return;
    this.queuedDiscards.set(id, slot);
  }

  /** Comes straight off the network, so anything invalid is ignored. A tick reads no pins, so like chat this skips the queue. */
  pinSkill(id: string, intent: { skill: string; pinned: boolean }) {
    const pins = this.state.players.get(id)?.pinnedSkills;
    const { skill, pinned } = intent ?? {};
    if (!pins || !SKILLS.some(([name]) => name === skill)) return;
    const at = pins.indexOf(skill);
    if (pinned === false && at >= 0) pins.splice(at, 1);
    if (pinned === true && at < 0 && pins.length < MAX_PINNED_SKILLS)
      pins.push(skill);
  }

  /**
   * `slot` comes straight off the network, so anything but a slot holding gear is ignored.
   * Like pins it skips the queue, so a second click within the tick isn't lost, and it
   * touches no action or timer (spec §4).
   */
  equip(id: string, slot: number) {
    if (!this.alive(id)) return;
    if (!Number.isInteger(slot) || slot < 0 || slot >= INVENTORY_SLOTS) return;
    const player = this.state.players.get(id)!;
    const item = player.inventory[slot]!;
    const gear = GEAR.get(item);
    if (!gear) return;
    const refusal = gearRefusal(item, player);
    if (refusal) {
      this.events.push({ type: "told", player: id, line: refusal });
      return;
    }
    // Whatever was worn lands where this came from, so swapping always works (spec §4).
    this.placeGear(id, slot, player[gear.slot]);
    player[gear.slot] = item;
  }

  /** `gearSlot` comes straight off the network, so anything but a gear slot is ignored. */
  takeOff(id: string, gearSlot: GearSlot) {
    if (!this.alive(id) || !GEAR_SLOTS.includes(gearSlot)) return;
    const player = this.state.players.get(id)!;
    const worn = player[gearSlot];
    if (!worn) return;
    const slot = player.inventory.indexOf(EMPTY_SLOT);
    if (slot < 0) {
      const line = "You have no empty slot to take that off into.";
      this.events.push({ type: "told", player: id, line });
      return;
    }
    this.placeGear(id, slot, worn);
    player[gearSlot] = "";
  }

  /** Puts gear, or "", in a slot. A discard waiting on the slot meant what was there, not this. */
  private placeGear(id: string, slot: number, item: string) {
    const player = this.state.players.get(id)!;
    player.inventory[slot] = item;
    player.inventoryCounts[slot] = item ? 1 : 0;
    if (this.queuedDiscards.get(id) === slot) this.queuedDiscards.delete(id);
  }

  private discard(id: string, slot: number) {
    const player = this.state.players.get(id)!;
    if (!player.inventory[slot]) return;
    player.inventory[slot] = EMPTY_SLOT;
    player.inventoryCounts[slot] = 0;
  }

  private eat(id: string, slot: number) {
    const player = this.state.players.get(id)!;
    const unsynced = this.unsyncedPlayers.get(id)!;
    const heals = FOOD_HEALS.get(player.inventory[slot]);
    if (heals === undefined || this.state.tick < unsynced.nextEatTick) return;
    unsynced.nextEatTick = this.state.tick + EAT_INTERVAL_TICKS;
    // From now if no swing is waiting, or a past timer would swallow the delay.
    unsynced.nextSwingTick =
      Math.max(unsynced.nextSwingTick, this.state.tick) + EAT_SWING_DELAY_TICKS;
    if (--player.inventoryCounts[slot]! === 0)
      player.inventory[slot] = EMPTY_SLOT;
    // Not at full health, or a swing later this tick could save it from being lost.
    if (player.health < player.maxHealth) unsynced.healingPool += heals;
    this.events.push({ type: "eaten", player: id });
  }

  /** One tick, in the order of spec §6. */
  tick() {
    this.state.tick++;
    this.applyIntents();
    this.advancePlayers();
    this.advancePicks();
    this.advanceMining();
    this.advanceMaking();
    this.advanceVisits();
    this.advancePlayerSwings();
    this.advanceEnemies();
    this.advancePlayerTimers();
    this.advanceBushes();
    this.advanceVeins();
    this.advanceEnemyReturns();
  }

  private applyIntents() {
    for (const [id, action] of this.queuedActions) {
      const unsynced = this.unsyncedPlayers.get(id)!;
      unsynced.bush = unsynced.vein = unsynced.making = undefined;
      unsynced.visiting = false;
      if ("enemy" in action) {
        unsynced.enemy = action.enemy;
      } else if ("make" in action) {
        unsynced.enemy = undefined;
        const path = pathNextTo(
          this.tiles,
          this.state.players.get(id)!,
          this.stations[RECIPES[action.make].station]!,
        );
        unsynced.path = path ?? [];
        if (path) unsynced.making = { item: action.make, all: action.all };
      } else if ("blacksmith" in action) {
        unsynced.enemy = undefined;
        const path = pathNextTo(
          this.tiles,
          this.state.players.get(id)!,
          action.blacksmith,
        );
        unsynced.path = path ?? [];
        unsynced.visiting = path !== undefined;
      } else if ("bush" in action) {
        unsynced.enemy = undefined;
        const path = pathNextTo(
          this.tiles,
          this.state.players.get(id)!,
          this.bushSites.get(action.bush)!,
        );
        unsynced.path = path ?? [];
        if (path) unsynced.bush = action.bush;
      } else if ("vein" in action) {
        unsynced.enemy = undefined;
        const path = pathNextTo(
          this.tiles,
          this.state.players.get(id)!,
          this.veinSites.get(action.vein)!,
        );
        unsynced.path = path ?? [];
        if (path) unsynced.vein = action.vein;
      } else {
        unsynced.enemy = undefined;
        unsynced.path = findPath(
          this.tiles,
          this.state.players.get(id)!,
          action.to,
        );
      }
    }
    this.queuedActions.clear();
    for (const [id, slot] of this.queuedEats) this.eat(id, slot);
    this.queuedEats.clear();
    for (const [id, slot] of this.queuedDiscards) this.discard(id, slot);
    this.queuedDiscards.clear();
    for (const id of this.queuedLogouts) {
      if (this.state.tick >= this.unsyncedPlayers.get(id)!.lockEndTick) {
        this.loggedOut.push(id);
      }
    }
    this.queuedLogouts.clear();
  }

  private advancePlayers() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      // nextStepTick outlives each walk, so clicking again can't beat the walking speed.
      if (this.state.tick < unsynced.nextStepTick) continue;
      const player = this.state.players.get(id)!;
      if (unsynced.enemy !== undefined) {
        // Re-pathed every step since it can move. A path's last step lands on its tile, so
        // stopping short of that is exactly "next to" (spec D1).
        const enemy = this.state.enemies.get(unsynced.enemy)!;
        unsynced.path = findPath(this.tiles, player, enemy).slice(0, -1);
      }
      if (!unsynced.path.length) continue;
      Object.assign(player, unsynced.path.shift());
      unsynced.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
    }
  }

  /** After the steps, so the first attempt lands on the tick of arrival (D5). */
  private advancePicks() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      if (unsynced.bush === undefined || unsynced.path.length) continue;
      const player = this.state.players.get(id)!;
      const site = this.bushSites.get(unsynced.bush)!;
      const bush = this.state.bushes.get(unsynced.bush)!;
      if (bushRefusal(site.kind, bush.picksLeft, player)) {
        unsynced.bush = undefined;
        continue;
      }
      if (this.state.tick < unsynced.nextPickTick) continue;
      const level = levelFor(player.foragingXp);
      unsynced.nextPickTick = this.state.tick + pickIntervalTicks(level);
      const success = this.random() < pickChance(site.kind, level);
      this.events.push({ type: "pick", player: id, success });
      if (!success) continue;
      const { xp, food, regrowTicks } = BUSHES[site.kind];
      player.foragingXp = addXp(player.foragingXp, xp);
      const slot = slotFor(food, player);
      player.inventory[slot] = food;
      player.inventoryCounts[slot]!++;
      if (--bush.picksLeft === 0)
        site.regrowTick = this.state.tick + regrowTicks;
      unsynced.bush = undefined;
    }
  }

  /** As picks, and on the same timer, so swapping between them can't beat it. */
  private advanceMining() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      if (unsynced.vein === undefined || unsynced.path.length) continue;
      const player = this.state.players.get(id)!;
      const site = this.veinSites.get(unsynced.vein)!;
      const vein = this.state.veins.get(unsynced.vein)!;
      if (veinRefusal(site.tier, vein.oreLeft, player)) {
        unsynced.vein = undefined;
        continue;
      }
      if (this.state.tick < unsynced.nextPickTick) continue;
      const level = levelFor(player.miningXp);
      unsynced.nextPickTick = this.state.tick + pickIntervalTicks(level);
      const success = this.random() < mineChance(site.tier, level);
      this.events.push({ type: "mine", player: id, success });
      if (!success) continue;
      const { xp, ore, regrowTicks } = VEINS[site.tier];
      player.miningXp = addXp(player.miningXp, xp);
      const slot = slotFor(ore, player);
      player.inventory[slot] = ore;
      player.inventoryCounts[slot]!++;
      if (--vein.oreLeft === 0) site.regrowTick = this.state.tick + regrowTicks;
      unsynced.vein = undefined;
    }
  }

  /** After the steps, so the first wait starts on the tick of arrival. */
  private advanceMaking() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const { making } = unsynced;
      if (!making || unsynced.path.length) continue;
      if (making.doneTick !== undefined) {
        if (this.state.tick < making.doneTick) continue;
        if (!this.finishItem(id, making.item) || !making.all) {
          unsynced.making = undefined;
          continue;
        }
      }
      const player = this.state.players.get(id)!;
      const refusal = makeRefusal(making.item, player);
      if (refusal) {
        unsynced.making = undefined;
        this.events.push({ type: "told", player: id, line: refusal });
        continue;
      }
      const { station, ticks } = RECIPES[making.item];
      making.doneTick = this.state.tick + ticks;
      this.events.push({ type: "make", player: id, station, ticks });
    }
  }

  /** Swaps materials for the item and experience, all at once or, with a line saying why, not at all. */
  private finishItem(id: string, item: RecipeItem) {
    const player = this.state.players.get(id)!;
    const told = (line: string) => {
      this.events.push({ type: "told", player: id, line });
      return false;
    };
    // Discarding during the wait is allowed, so they may have gone.
    const refusal = makeRefusal(item, player);
    if (refusal) return told(refusal);
    const inventory = [...player.inventory];
    const inventoryCounts = [...player.inventoryCounts];
    for (const [cost, count] of costsOf(item)) {
      let left = count;
      inventory.forEach((held, slot) => {
        if (held !== cost || !left) return;
        const taken = Math.min(left, inventoryCounts[slot]!);
        left -= taken;
        inventoryCounts[slot]! -= taken;
        if (!inventoryCounts[slot]) inventory[slot] = EMPTY_SLOT;
      });
    }
    // On the copy, so the last ore in a full inventory leaves room for its bar.
    const slot = slotFor(item, { inventory, inventoryCounts });
    if (slot < 0) return told("Your inventory is full.");
    inventory[slot] = item;
    inventoryCounts[slot]!++;
    inventory.forEach((held, i) => {
      player.inventory[i] = held;
      player.inventoryCounts[i] = inventoryCounts[i]!;
    });
    player.smithingXp = addXp(player.smithingXp, RECIPES[item].xp);
    return true;
  }

  /** After the steps, so the tools come on the tick of arrival. */
  private advanceVisits() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      if (!unsynced.visiting || unsynced.path.length) continue;
      unsynced.visiting = false;
      const player = this.state.players.get(id)!;
      const lacking = TOOLS.filter((tool) => !player.tools.includes(tool));
      player.tools.push(...lacking);
      const line = lacking.length
        ? `The Blacksmith gives you ${lacking.map((tool) => `a ${tool}`).join(" and ")}.`
        : "You already have every tool.";
      this.events.push({ type: "told", player: id, line });
    }
  }

  private advanceBushes() {
    for (const [id, site] of this.bushSites) {
      if (this.state.tick !== site.regrowTick) continue;
      this.state.bushes.get(id)!.picksLeft = BUSHES[site.kind].picks;
      site.regrowTick = undefined;
    }
  }

  private advanceVeins() {
    for (const [id, site] of this.veinSites) {
      if (this.state.tick !== site.regrowTick) continue;
      this.state.veins.get(id)!.oreLeft = VEINS[site.tier].ores;
      site.regrowTick = undefined;
    }
  }

  /** After the moves, so the first swing lands on the tick the player arrives. */
  private advancePlayerSwings() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      if (unsynced.enemy === undefined) continue;
      const player = this.state.players.get(id)!;
      const enemy = this.state.enemies.get(unsynced.enemy)!;
      if (this.state.tick < unsynced.nextSwingTick) continue;
      if (!this.nextTo(player, enemy)) continue;
      unsynced.nextSwingTick = this.state.tick + SWING_INTERVAL_TICKS;
      this.playerSwing(id, player, unsynced.enemy, enemy);
    }
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const player = this.state.players.get(id)!;
      player.target = unsynced.enemy ?? "";
      player.action =
        unsynced.enemy !== undefined
          ? "fighting"
          : unsynced.bush !== undefined
            ? "foraging"
            : unsynced.vein !== undefined
              ? "mining"
              : unsynced.making
                ? "smithing"
                : unsynced.path.length
                  ? "walking"
                  : "";
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
    enemyId: string,
    enemy: InstanceType<typeof Enemy>,
  ) {
    this.lock(id);
    const combat = levelFor(player.combatXp);
    const rolled = this.rollDamage(
      PLAYER_HIT_CHANCE + PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL * (combat - 1),
      PLAYER_BASE_DAMAGE + Math.floor(combat / COMBAT_LEVELS_PER_DAMAGE),
    );
    const damage = Math.min(
      // Only on a hit, as 0 means a miss.
      rolled && rolled + (GEAR.get(player.weapon)?.hitBonus ?? 0),
      enemy.health, // No XP for overkill.
    );
    const xp = damage * XP_PER_DAMAGE_DEALT;
    player.combatXp = addXp(player.combatXp, xp);
    player.hitpointsXp = addXp(player.hitpointsXp, xp);
    player.maxHealth = levelFor(player.hitpointsXp);
    this.events.push({
      type: "playerSwing",
      player: id,
      enemy: enemyId,
      damage,
    });

    const home = this.unsyncedEnemies.get(enemyId)!;
    const { noticeTiles } = ENEMIES[enemy.kind];
    // One that attacks first ignores players on its way home, though they can attack it (spec §4).
    if (enemy.state !== "going home" || noticeTiles === undefined) {
      if (enemy.state !== "fighting") this.startFight(enemy, home);
      enemy.target = id;
    }
    enemy.health -= damage;
    if (enemy.health > 0) return;

    enemy.state = "dead";
    enemy.target = "";
    home.returnTick = this.state.tick + ENEMIES[enemy.kind].returnTicks;
    this.events.push({ type: "enemyDied", enemy: enemyId });
    for (const unsynced of this.unsyncedPlayers.values()) {
      if (unsynced.enemy !== enemyId) continue;
      unsynced.enemy = undefined;
      unsynced.path = [];
    }
  }

  private startFight(
    enemy: InstanceType<typeof Enemy>,
    home: { fightStart: Tile; nextSwingTick: number },
  ) {
    enemy.state = "fighting";
    home.fightStart = { x: enemy.x, y: enemy.y };
    // Its timer outlives a fight, like the player's (spec D2).
    home.nextSwingTick = Math.max(
      home.nextSwingTick,
      this.state.tick + ENEMIES[enemy.kind].firstSwingDelayTicks,
    );
  }

  /** The nearest live, connected player in range that no other Skeleton is after (spec §4). */
  private noticedBy(enemy: InstanceType<typeof Enemy>, noticeTiles: number) {
    const chased = new Set(
      [...this.state.enemies.values()]
        .filter(
          ({ kind, state }) => kind === enemy.kind && state === "fighting",
        )
        .map(({ target }) => target),
    );
    let nearest: string | undefined;
    let nearestTiles = noticeTiles + 1;
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const player = this.state.players.get(id)!;
      const tiles = tilesApart(enemy, player);
      if (player.dead || unsynced.dropped || chased.has(id)) continue;
      // Strictly nearer, so a tie stays with whoever was checked first.
      if (tiles >= nearestTiles) continue;
      nearest = id;
      nearestTiles = tiles;
    }
    return nearest;
  }

  /** One step towards `to`, if a step is due. `stopNextTo` stays off its tile (spec D1). */
  private stepEnemy(
    enemy: InstanceType<typeof Enemy>,
    home: { nextStepTick: number },
    to: Tile,
    stopNextTo: boolean,
  ) {
    if (this.state.tick < home.nextStepTick) return;
    const path = findPath(this.tiles, enemy, to);
    if (stopNextTo) path.pop();
    if (!path.length) return;
    Object.assign(enemy, path[0]);
    home.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
  }

  private enemySwing(
    id: string,
    enemy: InstanceType<typeof Enemy>,
    player: InstanceType<typeof Player>,
    home: { nextSwingTick: number },
  ) {
    if (this.state.tick < home.nextSwingTick || !this.nextTo(enemy, player)) {
      return;
    }
    const {
      hitChance,
      hitChancePerDefenseLevel,
      maxDamage,
      swingIntervalTicks,
    } = ENEMIES[enemy.kind];
    home.nextSwingTick = this.state.tick + swingIntervalTicks;
    this.lock(enemy.target);
    const defense = levelFor(player.defenseXp);
    const rolled = Math.min(
      this.rollDamage(
        hitChance + hitChancePerDefenseLevel * (defense - 1),
        maxDamage,
      ),
      player.health,
    );
    const blocked = rolled > 0 && this.rollBlock(player);
    const damage = blocked ? 0 : rolled;
    if (blocked)
      player.blockingXp = addXp(player.blockingXp, BLOCKING_XP_PER_BLOCK);
    player.health -= damage;
    player.defenseXp = addXp(
      player.defenseXp,
      DEFENSE_XP_PER_ENEMY_SWING + damage * DEFENSE_XP_PER_DAMAGE_TAKEN,
    );
    this.events.push({
      type: "enemySwing",
      enemy: id,
      player: enemy.target,
      damage,
      blocked,
    });
    if (player.health === 0) this.die(enemy.target, player);
    else if (player.action === "") this.fightBack(enemy.target, player, id);
  }

  private rollBlock(player: InstanceType<typeof Player>) {
    const base = GEAR.get(player.shield)?.blockChance;
    if (base === undefined) return false;
    const levelsAbove1 = levelFor(player.blockingXp) - 1;
    return (
      this.random() < base + BLOCK_CHANCE_PER_BLOCKING_LEVEL * levelsAbove1
    );
  }

  /** An action of "" is idle, but a dropped player has gone and shouldn't fight (spec D5). */
  private fightBack(
    id: string,
    player: InstanceType<typeof Player>,
    enemyId: string,
  ) {
    const unsynced = this.unsyncedPlayers.get(id)!;
    if (unsynced.dropped) return;
    unsynced.enemy = enemyId;
    unsynced.nextSwingTick = Math.max(
      unsynced.nextSwingTick,
      this.state.tick + FIGHT_BACK_DELAY_TICKS,
    );
    // Now, as a second enemy swinging this tick must find them busy.
    Object.assign(player, { target: enemyId, action: "fighting" });
  }

  /** Not refreshed while dropped, or an enemy's swings would hold them here until killed (Q3). */
  lock(id: string) {
    const unsynced = this.unsyncedPlayers.get(id)!;
    if (!unsynced.dropped)
      unsynced.lockEndTick = this.state.tick + COMBAT_LOCK_TICKS;
  }

  private die(id: string, player: InstanceType<typeof Player>) {
    player.dead = true;
    this.clearAction(id);
    const unsynced = this.unsyncedPlayers.get(id)!;
    unsynced.healingPool = 0;
    unsynced.respawnTick = this.state.tick + PLAYER_DEAD_TICKS;
    this.events.push({ type: "playerDied", player: id });
  }

  private advancePlayerTimers() {
    const regenerates = this.state.tick % REGEN_INTERVAL_TICKS === 0;
    const poolGives = this.state.tick % HEALING_POOL_INTERVAL_TICKS === 0;
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const player = this.state.players.get(id)!;
      if (player.dead) {
        if (this.state.tick < unsynced.respawnTick) continue;
        Object.assign(player, this.respawned(player), { dead: false });
        unsynced.lockEndTick = 0;
        this.events.push({ type: "playerRespawned", player: id });
        continue;
      }
      if (regenerates && this.state.tick >= unsynced.lockEndTick) {
        const heals = Math.ceil(
          (player.maxHealth * REGEN_PERCENT_OF_MAX_HEALTH) / 100,
        );
        player.health = Math.min(player.health + heals, player.maxHealth);
      }
      if (poolGives && unsynced.healingPool > 0) {
        unsynced.healingPool--;
        player.health = Math.min(player.health + 1, player.maxHealth);
      }
      if (player.health === player.maxHealth) unsynced.healingPool = 0;
    }
  }

  private advanceEnemyReturns() {
    for (const [id, home] of this.unsyncedEnemies) {
      const enemy = this.state.enemies.get(id)!;
      if (enemy.state !== "dead" || this.state.tick < home.returnTick) {
        continue;
      }
      Object.assign(enemy, {
        x: home.x,
        y: home.y,
        health: ENEMIES[enemy.kind].health,
        state: "idle",
      });
      this.events.push({ type: "enemyReturned", enemy: id });
    }
  }

  private advanceEnemies() {
    for (const [id, home] of this.unsyncedEnemies) {
      const enemy = this.state.enemies.get(id)!;
      const { noticeTiles } = ENEMIES[enemy.kind];
      if (enemy.state === "idle" && noticeTiles !== undefined) {
        const noticed = this.noticedBy(enemy, noticeTiles);
        if (noticed !== undefined) {
          this.startFight(enemy, home);
          enemy.target = noticed;
        }
      }
      if (enemy.state === "fighting") {
        const target = this.state.players.get(enemy.target);
        if (
          target &&
          target.health > 0 &&
          tilesApart(target, home.fightStart) <= ENEMIES[enemy.kind].leashTiles
        ) {
          this.stepEnemy(enemy, home, target, true);
          this.enemySwing(id, enemy, target, home);
          if (target.health > 0) continue;
        }
        enemy.state = "going home";
        enemy.target = "";
      }
      if (enemy.state === "going home") {
        this.stepEnemy(enemy, home, home, false);
        if (tilesApart(enemy, home) === 0) {
          enemy.health = ENEMIES[enemy.kind].health;
          enemy.state = "idle";
        }
        continue;
      }
      if (enemy.state !== "idle" || this.state.tick < home.nextStepTick) {
        continue;
      }
      const { wanderChance, wanderTiles } = ENEMIES[enemy.kind];
      if (this.random() >= wanderChance) continue;
      const steps = legalSteps(this.tiles, enemy).filter(
        (step) => tilesApart(step, home) <= wanderTiles,
      );
      Object.assign(enemy, steps[Math.floor(this.random() * steps.length)]);
      home.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
    }
  }
}
