import { ArraySchema, schema, t } from "@colyseus/schema";
import {
  addXp,
  armourPercentOf,
  attemptChance,
  BLOCK_CHANCE_PER_BLOCKING_LEVEL,
  BLOCKING_XP_PER_BLOCK,
  COMBAT_LEVELS_PER_DAMAGE,
  COMBAT_LOCK_TICKS,
  costsOf,
  DEFENSE_XP_PER_DAMAGE_TAKEN,
  DEFENSE_XP_PER_ENEMY_SWING,
  DOUBLE_YIELD,
  EAT_INTERVAL_TICKS,
  EAT_SWING_DELAY_TICKS,
  EMPTY_SLOT,
  FIGHT_BACK_DELAY_TICKS,
  FOOD_HEALS,
  gatheringSource,
  gatherRefusal,
  GATHERING,
  GATHERING_SKILLS,
  GEAR,
  GEAR_SLOTS,
  gearRefusal,
  HEALING_POOL_INTERVAL_TICKS,
  HEALTH_PER_HITPOINTS_LEVEL,
  INVENTORY_SLOTS,
  ITEMS,
  levelFor,
  makeRefusal,
  MASTERY_SHARE_PERCENT,
  MAX_PINNED_SKILLS,
  pickIntervalTicks,
  PLAYER_BASE_DAMAGE,
  PLAYER_CRIT_CHANCE,
  PLAYER_CRIT_MULTIPLIER,
  PLAYER_DEAD_TICKS,
  PLAYER_HIT_CHANCE,
  PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL,
  RECIPES,
  REGEN_INTERVAL_TICKS,
  REGEN_PERCENT_OF_MAX_HEALTH,
  respawnTile,
  siteId,
  SKILLS,
  slotFor,
  takeRefusal,
  STARTING_PINNED_SKILLS,
  stationRefusal,
  tilesApart,
  SWING_INTERVAL_TICKS,
  ENEMIES,
  STARTING_HEALTH,
  STARTING_HITPOINTS_XP,
  TOOLS,
  WALK_TICKS_PER_TILE,
  xpOf,
  type GatheringLeftField,
  type GatheringSkill,
  type PlayerAction,
  type EnemyKind,
  type EnemyState,
  type GearSlot,
  type ItemId,
  type RecipeItem,
  type StationKind,
  XP_PER_DAMAGE_DEALT,
  type Tile,
  type TileKind,
  type WorldEvent,
  type XpField,
} from "@runic/shared";
import { GroundItem, GroundItems } from "./groundItems.ts";
import { findPath, legalSteps, pathNextTo } from "./pathfinding.ts";
import type { PlayerSave } from "./saves.ts";

const isInventorySlot = (slot: number) =>
  Number.isInteger(slot) && slot >= 0 && slot < INVENTORY_SLOTS;

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
    masteryXp: t.uint32().default(0),
    /** The fraction of a point of Mastery not yet earned, so small gains add up. */
    masteryHundredths: t.uint8().default(0),
    /** In any order; the sheet's order decides how they show. */
    pinnedSkills: t.array("string"),
    health: t.uint16(),
    maxHealth: t.uint16(),
    inventory: t.array("string"),
    /** Parallel to `inventory`: how many in each slot, 0 for an empty one. */
    inventoryCounts: t.array("uint8"),
    tools: t.array("string"),
    /** The item id worn in each gear slot, or "". */
    weapon: t.string().default(""),
    shield: t.string().default(""),
    head: t.string().default(""),
    body: t.string().default(""),
    legs: t.string().default(""),
    hands: t.string().default(""),
    feet: t.string().default(""),
    cape: t.string().default(""),
    neck: t.string().default(""),
    ring: t.string().default(""),
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
    health: t.uint16(),
    target: t.string().default(""),
    state: t.string<EnemyState>().default("idle"),
  },
  "Enemy",
);

export const Bush = schema({ picksLeft: t.uint8() }, "Bush");

export const Vein = schema({ minesLeft: t.uint8() }, "Vein");

const SITE_SCHEMAS = { bushes: Bush, veins: Vein };

export const WorldState = schema(
  {
    tick: t.uint32().default(0),
    players: t.map(Player),
    enemies: t.map(Enemy),
    bushes: t.map(Bush),
    veins: t.map(Vein),
    /** Tagged for views: the room adds each one to the views of the players who can see it. */
    groundItems: t.map(GroundItem).view(),
  },
  "WorldState",
);

/** A bush or vein: where it is and what it is, its synced entry and when it grows back. */
type GatheringSite = Tile & {
  skill: GatheringSkill;
  kind: string;
  synced: Partial<Record<GatheringLeftField, number>>;
  regrowTick?: number;
};

/** What a player is doing, beyond walking. Each kind but visiting is also its synced `PlayerAction`. */
type UnsyncedAction =
  | { kind: "fighting"; enemy: string }
  | { kind: GatheringSkill; site: string }
  | { kind: "visiting" }
  | { kind: "taking"; groundItem: string }
  | { kind: "following"; player: string }
  /** `doneTick` stays unset until arrival starts the first wait. */
  | { kind: "smithing"; item: RecipeItem; all: boolean; doneTick?: number };

/** The whole game: rules and state, with no network. Tests and the room both drive it through tick(). */
export class Simulation {
  state = new WorldState();
  /** Only the latest click per player counts, so a flood of them costs one path per tick. */
  private queuedActions = new Map<
    string,
    | { to: Tile }
    | { enemy: string }
    | { gather: GatheringSkill; site: string }
    | { blacksmith: Tile }
    | { make: RecipeItem; all: boolean }
    | { take: string }
    | { follow: string }
  >();
  /** What a player's action and timers need that clients don't. */
  private unsyncedPlayers = new Map<
    string,
    {
      path: Tile[];
      nextStepTick: number;
      nextSwingTick: number;
      action?: UnsyncedAction;
      /** Outlives the action, so clicking again can't beat the attempt interval. */
      nextAttemptTick: number;
      nextEatTick: number;
      /** What each healing tick still to come gives, in eating order. Not saved, so leaving loses it (spec §6). */
      healingPool: number[];
      /** The combat lock runs until this tick. */
      lockEndTick: number;
      respawnTick: number;
      dropped?: boolean;
    }
  >();
  /** Apart from the action, which eating doesn't replace (spec §4). */
  private queuedEats = new Map<string, number>();
  /** Apart from the action too, which dropping doesn't replace (spec §4). */
  private queuedDrops = new Map<string, number>();
  /** By username, so joining again can't beat the attempt or eat interval. */
  private timersOfLeavers = new Map<
    string,
    { nextAttemptTick: number; nextEatTick: number }
  >();
  /** What an enemy needs that clients don't: its home tile, timers and who has damaged it. */
  private unsyncedEnemies = new Map<
    string,
    {
      home: Tile;
      nextStepTick: number;
      nextSwingTick: number;
      returnTick: number;
      fightStart: Tile;
      /** Who has damaged it since it last recovered or returned. Not saved (spec §6). */
      damagers: Set<string>;
    }
  >();
  /** Bushes and veins, by the tile that keys them. */
  private sites = new Map<string, GatheringSite>();
  private blacksmith?: Tile;
  private stations: Partial<Record<StationKind, Tile>> = {};
  private queuedLogouts = new Set<string>();
  /** Players whose log out intent was accepted, for the room to disconnect. */
  readonly loggedOut: string[] = [];
  private readonly groundItems = new GroundItems(this.state.groundItems);
  /** This tick's one-shot moments, for the room to broadcast after the patch and empty. */
  readonly events: WorldEvent[] = [];

  constructor(
    private tiles: TileKind[][],
    readonly random: () => number,
  ) {
    tiles.forEach((row, y) =>
      row.forEach((kind, x) => {
        const { enemy, blacksmith, station } = kind;
        if (blacksmith) this.blacksmith = { x, y };
        if (station) this.stations[station] = { x, y };
        for (const skill of GATHERING_SKILLS) {
          const { site, stateField, leftField } = GATHERING[skill];
          const siteKind = kind[site];
          if (!siteKind) continue;
          const id = siteId({ x, y });
          const synced = Object.assign(new SITE_SCHEMAS[stateField](), {
            [leftField]: gatheringSource(skill, siteKind).holds,
          });
          // The row keeps the schema and its map together, which the types can't follow.
          this.state[stateField].set(id, synced as never);
          this.sites.set(id, { x, y, skill, kind: siteKind, synced });
        }
        if (!enemy) return;
        const id = String(this.unsyncedEnemies.size);
        this.unsyncedEnemies.set(id, {
          home: { x, y },
          nextStepTick: 0,
          nextSwingTick: 0,
          returnTick: 0,
          fightStart: { x, y },
          damagers: new Set(),
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
      maxHealth: levelFor(fields.hitpointsXp) * HEALTH_PER_HITPOINTS_LEVEL,
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
      nextAttemptTick: 0,
      nextEatTick: 0,
      healingPool: [],
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
      masteryXp,
      masteryHundredths,
      health,
      weapon,
      shield,
      head,
      body,
      legs,
      hands,
      feet,
      cape,
      neck,
      ring,
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
      masteryXp,
      masteryHundredths,
      health,
      weapon,
      shield,
      head,
      body,
      legs,
      hands,
      feet,
      cape,
      neck,
      ring,
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
      const { nextAttemptTick, nextEatTick } = unsynced;
      this.timersOfLeavers.set(username, { nextAttemptTick, nextEatTick });
    }
    this.state.players.delete(id);
    this.unsyncedPlayers.delete(id);
    this.queuedActions.delete(id);
    this.queuedEats.delete(id);
    this.queuedDrops.delete(id);
    this.queuedLogouts.delete(id);
    this.stopFollowersOf(id);
    // A leaver has no inventory to fill (spec D8).
    for (const enemy of this.unsyncedEnemies.values())
      enemy.damagers.delete(id);
  }

  /** Lost connection but stays in the world: idle (D9), and still there to be hit. */
  dropPlayer(id: string) {
    this.clearAction(id);
    this.unsyncedPlayers.get(id)!.dropped = true;
    this.queuedActions.delete(id);
    this.queuedEats.delete(id);
    this.queuedDrops.delete(id);
    this.queuedLogouts.delete(id);
  }

  /** Death or logout on the target's side ends following too. */
  private stopFollowersOf(target: string) {
    for (const [id, { action }] of this.unsyncedPlayers) {
      if (action?.kind === "following" && action.player === target)
        this.clearAction(id);
    }
  }

  private clearAction(id: string) {
    const unsynced = this.unsyncedPlayers.get(id)!;
    unsynced.path = [];
    unsynced.action = undefined;
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

  /** `target` is a player's session id, checked by the room's /follow command. */
  follow(id: string, target: string) {
    if (!this.alive(id)) return;
    this.queuedActions.set(id, { follow: target });
  }

  /** The session id of the player this one follows, if any. A queued intent counts already, since it replaces the action on the next tick. */
  following(id: string) {
    const queued = this.queuedActions.get(id);
    if (queued) return "follow" in queued ? queued.follow : undefined;
    const action = this.unsyncedPlayers.get(id)?.action;
    return action?.kind === "following" ? action.player : undefined;
  }

  unfollow(id: string) {
    if (!this.following(id)) return;
    this.queuedActions.delete(id);
    this.clearAction(id);
  }

  /** `site` comes straight off the network, so anything but the id of this skill's site is ignored, as is a click the rules refuse. */
  queueGather(id: string, skill: GatheringSkill, site: string) {
    const player = this.state.players.get(id);
    const found = this.sites.get(site);
    if (!player || found?.skill !== skill || player.dead) return;
    if (this.siteRefusal(found, player)) return;
    this.queuedActions.set(id, { gather: skill, site });
  }

  private siteRefusal(
    { skill, kind, synced }: GatheringSite,
    player: InstanceType<typeof Player>,
  ) {
    const left = synced[GATHERING[skill].leftField]!;
    return gatherRefusal(skill, kind, left, player);
  }

  /**
   * Comes straight off the network, so anything but a recipe's item is ignored, as is choosing
   * an anvil recipe with no hammer. Level and materials wait for arrival (spec §4).
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

  /** `groundItem` comes straight off the network, so anything but the id of one this player can see is ignored. */
  queueTake(id: string, groundItem: string) {
    if (typeof groundItem !== "string") return;
    if (!this.alive(id) || !this.canSee(id, groundItem)) return;
    this.queuedActions.set(id, { take: groundItem });
  }

  /** `slot` comes straight off the network, so anything but a slot's index is ignored. */
  queueEat(id: string, slot: number) {
    if (!this.alive(id)) return;
    if (!isInventorySlot(slot)) return;
    this.queuedEats.set(id, slot);
  }

  /** `slot` comes straight off the network, so anything but a slot's index is ignored. */
  queueDrop(id: string, slot: number) {
    if (!this.alive(id)) return;
    if (!isInventorySlot(slot)) return;
    this.queuedDrops.set(id, slot);
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
    if (!isInventorySlot(slot)) return;
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

  /** Puts gear, or "", in a slot. A drop waiting on the slot meant what was there, not this. */
  private placeGear(id: string, slot: number, item: string) {
    const player = this.state.players.get(id)!;
    player.inventory[slot] = item;
    player.inventoryCounts[slot] = item ? 1 : 0;
    if (this.queuedDrops.get(id) === slot) this.queuedDrops.delete(id);
  }

  /** Adds one `item` to the slot `slotFor` chose. */
  private addToSlot(
    player: InstanceType<typeof Player>,
    slot: number,
    item: string,
  ) {
    player.inventory[slot] = item;
    player.inventoryCounts[slot]!++;
  }

  /** How many more of `item` fit: spaces in its stacks, plus one per empty slot. Counted before any land, so a double with a single free slot and no stack leaves its second ore on the ground (#152). */
  private roomFor(item: ItemId, player: InstanceType<typeof Player>) {
    let room = 0;
    player.inventory.forEach((held, slot) => {
      if (held === EMPTY_SLOT) room++;
      else if (held === item)
        room += ITEMS[item].stack - player.inventoryCounts[slot]!;
    });
    return room;
  }

  private drop(id: string, slot: number) {
    const player = this.state.players.get(id)!;
    const item = player.inventory[slot]!;
    if (!item) return;
    const count = player.inventoryCounts[slot]!;
    const { username } = player;
    this.groundItems.spawn(player, item, count, username, this.state.tick);
    player.inventory[slot] = EMPTY_SLOT;
    player.inventoryCounts[slot] = 0;
  }

  private eat(id: string, slot: number) {
    const player = this.state.players.get(id)!;
    const unsynced = this.unsyncedPlayers.get(id)!;
    const food = FOOD_HEALS.get(player.inventory[slot]);
    if (food === undefined || this.state.tick < unsynced.nextEatTick) return;
    unsynced.nextEatTick = this.state.tick + EAT_INTERVAL_TICKS;
    // From now if no swing is waiting, or a past timer would swallow the delay.
    unsynced.nextSwingTick =
      Math.max(unsynced.nextSwingTick, this.state.tick) + EAT_SWING_DELAY_TICKS;
    if (--player.inventoryCounts[slot]! === 0)
      player.inventory[slot] = EMPTY_SLOT;
    // Not at full health, or a swing later this tick could save it from being lost.
    if (player.health < player.maxHealth) {
      unsynced.healingPool.push(
        ...Array<number>(food.ticks).fill(food.perTick),
      );
    }
    this.events.push({ type: "eaten", player: id });
  }

  /** Whether this player can see the ground item with this id; the room sends them only those. */
  canSee(id: string, groundItem: string) {
    const player = this.state.players.get(id);
    return (
      player !== undefined &&
      this.groundItems.canSee(player.username, groundItem)
    );
  }

  /** One tick, in the order of spec §6. */
  tick() {
    this.state.tick++;
    this.applyIntents();
    this.advancePlayers();
    for (const skill of GATHERING_SKILLS) this.advanceGathering(skill);
    this.advanceMaking();
    this.advanceVisits();
    this.advanceTakes();
    this.advancePlayerSwings();
    this.advanceEnemies();
    this.advancePlayerTimers();
    this.advanceSites();
    this.advanceEnemyReturns();
    this.groundItems.advance(this.state.tick);
  }

  private applyIntents() {
    for (const [id, intent] of this.queuedActions) {
      const unsynced = this.unsyncedPlayers.get(id)!;
      const player = this.state.players.get(id)!;
      // With no way there, the old action still ends, and nothing replaces it.
      const goNextTo = (tile: Tile, action: UnsyncedAction) => {
        const path = pathNextTo(this.tiles, player, tile);
        unsynced.path = path ?? [];
        unsynced.action = path && action;
      };
      if ("enemy" in intent) {
        unsynced.action = { kind: "fighting", enemy: intent.enemy };
      } else if ("make" in intent) {
        goNextTo(this.stations[RECIPES[intent.make].station]!, {
          kind: "smithing",
          item: intent.make,
          all: intent.all,
        });
      } else if ("blacksmith" in intent) {
        goNextTo(intent.blacksmith, { kind: "visiting" });
      } else if ("take" in intent) {
        // Onto its tile, not next to it. It may have gone since the intent arrived.
        const groundItem = this.state.groundItems.get(intent.take);
        unsynced.path = groundItem
          ? findPath(this.tiles, player, groundItem)
          : [];
        unsynced.action = groundItem && {
          kind: "taking",
          groundItem: intent.take,
        };
      } else if ("follow" in intent) {
        // The target may have left or died since the intent arrived.
        unsynced.action = this.alive(intent.follow)
          ? { kind: "following", player: intent.follow }
          : undefined;
        unsynced.path = [];
      } else if ("gather" in intent) {
        goNextTo(this.sites.get(intent.site)!, {
          kind: intent.gather,
          site: intent.site,
        });
      } else {
        unsynced.action = undefined;
        unsynced.path = findPath(this.tiles, player, intent.to);
      }
    }
    this.queuedActions.clear();
    for (const [id, slot] of this.queuedEats) this.eat(id, slot);
    this.queuedEats.clear();
    for (const [id, slot] of this.queuedDrops) this.drop(id, slot);
    this.queuedDrops.clear();
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
      if (unsynced.action?.kind === "fighting") {
        // Re-pathed every step since it can move. A path's last step lands on its tile, so
        // stopping short of that is exactly "next to" (spec D1).
        const enemy = this.state.enemies.get(unsynced.action.enemy)!;
        unsynced.path = findPath(this.tiles, player, enemy).slice(0, -1);
      } else if (unsynced.action?.kind === "following") {
        // Next to, never on, the target's tile: so a follower on it steps off.
        const target = this.state.players.get(unsynced.action.player)!;
        unsynced.path = pathNextTo(this.tiles, player, target) ?? [];
      }
      if (!unsynced.path.length) continue;
      Object.assign(player, unsynced.path.shift());
      unsynced.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
    }
  }

  /** After the steps, so the first attempt lands on the tick of arrival (D5). Every skill shares one timer, so swapping between them can't beat it. */
  private advanceGathering(skill: GatheringSkill) {
    const { xpField, verb, leftField } = GATHERING[skill];
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== skill || unsynced.path.length) continue;
      const player = this.state.players.get(id)!;
      const site = this.sites.get(action.site)!;
      if (this.siteRefusal(site, player)) {
        unsynced.action = undefined;
        continue;
      }
      if (this.state.tick < unsynced.nextAttemptTick) continue;
      const level = levelFor(player[xpField]);
      unsynced.nextAttemptTick = this.state.tick + pickIntervalTicks(level);
      const source = gatheringSource(skill, site.kind);
      const success = this.random() < attemptChance(source.level, level);
      const count: 1 | 2 =
        success &&
        source.doubleChance !== undefined &&
        this.random() < source.doubleChance
          ? DOUBLE_YIELD
          : 1;
      this.events.push({
        type: verb,
        player: id,
        success,
        ...(success ? { count } : {}),
      });
      if (!success) continue;
      this.earnXp(player, xpField, source.xp);
      // Room is counted before either lands, so the second ore goes on the
      // ground, owned by the miner, when the first took the last of it.
      const room = this.roomFor(source.item, player);
      for (let i = 0; i < count; i++) {
        if (i < room)
          this.addToSlot(player, slotFor(source.item, player), source.item);
        else
          this.groundItems.spawn(
            player,
            source.item,
            1,
            player.username,
            this.state.tick,
          );
      }
      if (--site.synced[leftField]! === 0)
        site.regrowTick = this.state.tick + source.regrowTicks;
      unsynced.action = undefined;
    }
  }

  /** After the steps, so the first wait starts on the tick of arrival. */
  private advanceMaking() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const { action: making } = unsynced;
      if (making?.kind !== "smithing" || unsynced.path.length) continue;
      if (making.doneTick !== undefined) {
        if (this.state.tick < making.doneTick) continue;
        if (!this.finishItem(id, making.item) || !making.all) {
          unsynced.action = undefined;
          continue;
        }
      }
      const player = this.state.players.get(id)!;
      const refusal = makeRefusal(making.item, player);
      if (refusal) {
        unsynced.action = undefined;
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
    // Dropping during the wait is allowed, so they may have gone.
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
    for (const [field, gained] of xpOf(item))
      this.earnXp(player, field, gained);
    return true;
  }

  /** Mastery's share is of what lands, so experience lost to the cap earns none. */
  private earnXp(
    player: InstanceType<typeof Player>,
    field: XpField,
    gained: number,
  ) {
    const before = player[field];
    player[field] = addXp(before, gained);
    const hundredths =
      player.masteryHundredths +
      (player[field] - before) * MASTERY_SHARE_PERCENT;
    player.masteryXp = addXp(player.masteryXp, Math.floor(hundredths / 100));
    player.masteryHundredths = hundredths % 100;
  }

  /**
   * After the steps, so the take lands on the tick of arrival. Visibility is checked again, and
   * the first player to arrive takes what fits; a second on the same tick gets none, even of a remainder.
   */
  private advanceTakes() {
    const takenThisTick = new Set<string>();
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== "taking" || unsynced.path.length) continue;
      unsynced.action = undefined;
      const player = this.state.players.get(id)!;
      const groundItem = this.state.groundItems.get(action.groundItem);
      if (!groundItem || !this.canSee(id, action.groundItem)) continue;
      if (takenThisTick.has(action.groundItem)) continue;
      // With no way there, the path ran out short of the tile.
      if (player.x !== groundItem.x || player.y !== groundItem.y) continue;
      const item = groundItem.item as ItemId;
      const line = takeRefusal(item, player);
      if (line) {
        this.events.push({ type: "told", player: id, line });
        continue;
      }
      let taken = 0;
      while (taken < groundItem.count && !takeRefusal(item, player)) {
        this.addToSlot(player, slotFor(item, player), item);
        taken++;
      }
      this.groundItems.take(action.groundItem, taken);
      takenThisTick.add(action.groundItem);
    }
  }

  /** After the steps, so the tools come on the tick of arrival. */
  private advanceVisits() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      if (unsynced.action?.kind !== "visiting" || unsynced.path.length) {
        continue;
      }
      unsynced.action = undefined;
      const player = this.state.players.get(id)!;
      const lacking = TOOLS.filter((tool) => !player.tools.includes(tool));
      player.tools.push(...lacking);
      const line = lacking.length
        ? `The Blacksmith gives you ${lacking.map((tool) => `a ${tool}`).join(" and ")}.`
        : "You already have every tool.";
      this.events.push({ type: "told", player: id, line });
    }
  }

  private advanceSites() {
    for (const site of this.sites.values()) {
      if (this.state.tick !== site.regrowTick) continue;
      const { leftField } = GATHERING[site.skill];
      site.synced[leftField] = gatheringSource(site.skill, site.kind).holds;
      site.regrowTick = undefined;
    }
  }

  /** After the moves, so the first swing lands on the tick the player arrives. */
  private advancePlayerSwings() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== "fighting") continue;
      const player = this.state.players.get(id)!;
      const enemy = this.state.enemies.get(action.enemy)!;
      if (this.state.tick < unsynced.nextSwingTick) continue;
      if (!this.nextTo(player, enemy)) continue;
      unsynced.nextSwingTick = this.state.tick + SWING_INTERVAL_TICKS;
      this.playerSwing(id, player, action.enemy, enemy);
    }
    for (const [id, { action, path }] of this.unsyncedPlayers) {
      const player = this.state.players.get(id)!;
      player.target = action?.kind === "fighting" ? action.enemy : "";
      player.action =
        action &&
        action.kind !== "visiting" &&
        action.kind !== "taking" &&
        action.kind !== "following"
          ? action.kind
          : path.length
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
    const min = HEALTH_PER_HITPOINTS_LEVEL;
    return this.random() < hitChance
      ? min + Math.floor(this.random() * (maxDamage - min + 1))
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
      PLAYER_BASE_DAMAGE +
        HEALTH_PER_HITPOINTS_LEVEL *
          Math.floor(combat / COMBAT_LEVELS_PER_DAMAGE),
    );
    // Only on a hit, as 0 means a miss.
    const hit = rolled && rolled + (GEAR.get(player.weapon)?.hitBonus ?? 0);
    const critical = hit > 0 && this.random() < PLAYER_CRIT_CHANCE;
    const damage = Math.min(
      critical ? Math.round(hit * PLAYER_CRIT_MULTIPLIER) : hit,
      enemy.health, // No XP for overkill.
    );
    const xp = Math.round(
      (damage * XP_PER_DAMAGE_DEALT) / HEALTH_PER_HITPOINTS_LEVEL,
    );
    this.earnXp(player, "combatXp", xp);
    this.earnXp(player, "hitpointsXp", xp);
    player.maxHealth =
      levelFor(player.hitpointsXp) * HEALTH_PER_HITPOINTS_LEVEL;
    this.events.push({
      type: "playerSwing",
      player: id,
      enemy: enemyId,
      damage,
      critical,
    });

    const unsyncedEnemy = this.unsyncedEnemies.get(enemyId)!;
    const { noticeTiles } = ENEMIES[enemy.kind];
    // One that attacks first ignores players on its way home, though they can attack it (spec §4).
    if (enemy.state !== "going home" || noticeTiles === undefined) {
      if (enemy.state !== "fighting") this.startFight(enemy, unsyncedEnemy);
      enemy.target = id;
    }
    if (damage) unsyncedEnemy.damagers.add(id);
    enemy.health -= damage;
    if (enemy.health > 0) return;

    enemy.state = "dead";
    enemy.target = "";
    unsyncedEnemy.returnTick =
      this.state.tick + ENEMIES[enemy.kind].returnTicks;
    this.events.push({ type: "enemyDied", enemy: enemyId });
    this.rollEmberbones(enemy, unsyncedEnemy.damagers);
    for (const unsynced of this.unsyncedPlayers.values()) {
      const { action } = unsynced;
      if (action?.kind !== "fighting" || action.enemy !== enemyId) continue;
      unsynced.action = undefined;
      unsynced.path = [];
    }
  }

  /** Each damager's own chance, and then it starts over, as it can't be damaged until it returns. */
  private rollEmberbones(
    enemy: InstanceType<typeof Enemy>,
    damagers: Set<string>,
  ) {
    const { emberboneChance = 0 } = ENEMIES[enemy.kind];
    for (const id of emberboneChance ? damagers : []) {
      if (this.random() >= emberboneChance) continue;
      const { username } = this.state.players.get(id)!;
      this.groundItems.spawn(enemy, "emberbone", 1, username, this.state.tick);
      const line = "You find an Emberbone. It is on the ground.";
      this.events.push({ type: "told", player: id, line });
    }
    damagers.clear();
  }

  private startFight(
    enemy: InstanceType<typeof Enemy>,
    unsynced: { fightStart: Tile; nextSwingTick: number },
  ) {
    enemy.state = "fighting";
    unsynced.fightStart = { x: enemy.x, y: enemy.y };
    // Its timer outlives a fight, like the player's (spec D2).
    unsynced.nextSwingTick = Math.max(
      unsynced.nextSwingTick,
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
    unsynced: { nextStepTick: number },
    to: Tile,
    stopNextTo: boolean,
  ) {
    if (this.state.tick < unsynced.nextStepTick) return;
    const path = findPath(this.tiles, enemy, to);
    if (stopNextTo) path.pop();
    if (!path.length) return;
    Object.assign(enemy, path[0]);
    unsynced.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
  }

  private enemySwing(
    id: string,
    enemy: InstanceType<typeof Enemy>,
    player: InstanceType<typeof Player>,
    unsynced: { nextSwingTick: number },
  ) {
    if (
      this.state.tick < unsynced.nextSwingTick ||
      !this.nextTo(enemy, player)
    ) {
      return;
    }
    const {
      hitChance,
      hitChancePerDefenseLevel,
      maxDamage,
      swingIntervalTicks,
    } = ENEMIES[enemy.kind];
    unsynced.nextSwingTick = this.state.tick + swingIntervalTicks;
    this.lock(enemy.target);
    const defense = levelFor(player.defenseXp);
    const rolled = this.rollDamage(
      hitChance + hitChancePerDefenseLevel * (defense - 1),
      maxDamage,
    );
    const blocked = rolled > 0 && this.rollBlock(player);
    const landed = blocked ? 0 : rolled;
    // Armour never turns a landed hit into 0, and the health cap comes after it, or a big hit could leave the player alive.
    const armoured =
      landed &&
      Math.max(1, Math.round((landed * (100 - armourPercentOf(player))) / 100));
    const damage = Math.min(armoured, player.health);
    if (blocked) this.earnXp(player, "blockingXp", BLOCKING_XP_PER_BLOCK);
    // From the hit before armour, so better armour doesn't slow Defense training.
    const defenseXpDamage = Math.min(landed, player.health);
    player.health -= damage;
    this.earnXp(
      player,
      "defenseXp",
      Math.round(
        DEFENSE_XP_PER_ENEMY_SWING +
          (defenseXpDamage * DEFENSE_XP_PER_DAMAGE_TAKEN) /
            HEALTH_PER_HITPOINTS_LEVEL,
      ),
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
    unsynced.action = { kind: "fighting", enemy: enemyId };
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
    this.stopFollowersOf(id);
    // Drop on death (#119): the Toolbelt stays.
    player.inventory.forEach((_, slot) => this.drop(id, slot));
    for (const gearSlot of GEAR_SLOTS) {
      const worn = player[gearSlot];
      if (!worn) continue;
      this.groundItems.spawn(player, worn, 1, player.username, this.state.tick);
      player[gearSlot] = "";
    }
    const unsynced = this.unsyncedPlayers.get(id)!;
    unsynced.healingPool.length = 0;
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
      if (poolGives && unsynced.healingPool.length > 0) {
        const amount = Math.min(
          unsynced.healingPool.shift()!,
          player.maxHealth - player.health,
        );
        player.health += amount;
        if (amount > 0)
          this.events.push({ type: "healed", player: id, amount });
      }
      if (player.health === player.maxHealth) unsynced.healingPool.length = 0;
    }
  }

  private advanceEnemyReturns() {
    for (const [id, unsynced] of this.unsyncedEnemies) {
      const enemy = this.state.enemies.get(id)!;
      if (enemy.state !== "dead" || this.state.tick < unsynced.returnTick) {
        continue;
      }
      Object.assign(enemy, {
        ...unsynced.home,
        health: ENEMIES[enemy.kind].health,
        state: "idle",
      });
      this.events.push({ type: "enemyReturned", enemy: id });
    }
  }

  private advanceEnemies() {
    for (const [id, unsynced] of this.unsyncedEnemies) {
      const enemy = this.state.enemies.get(id)!;
      const { noticeTiles } = ENEMIES[enemy.kind];
      if (enemy.state === "idle" && noticeTiles !== undefined) {
        const noticed = this.noticedBy(enemy, noticeTiles);
        if (noticed !== undefined) {
          this.startFight(enemy, unsynced);
          enemy.target = noticed;
        }
      }
      if (enemy.state === "fighting") {
        const target = this.state.players.get(enemy.target);
        if (
          target &&
          target.health > 0 &&
          tilesApart(target, unsynced.fightStart) <=
            ENEMIES[enemy.kind].leashTiles
        ) {
          this.stepEnemy(enemy, unsynced, target, true);
          this.enemySwing(id, enemy, target, unsynced);
          if (target.health > 0) continue;
        }
        enemy.state = "going home";
        enemy.target = "";
      }
      if (enemy.state === "going home") {
        this.stepEnemy(enemy, unsynced, unsynced.home, false);
        if (tilesApart(enemy, unsynced.home) === 0) {
          enemy.health = ENEMIES[enemy.kind].health;
          enemy.state = "idle";
          unsynced.damagers.clear();
        }
        continue;
      }
      if (enemy.state !== "idle" || this.state.tick < unsynced.nextStepTick) {
        continue;
      }
      const { wanderChance, wanderTiles } = ENEMIES[enemy.kind];
      if (this.random() >= wanderChance) continue;
      const steps = legalSteps(this.tiles, enemy).filter(
        (step) => tilesApart(step, unsynced.home) <= wanderTiles,
      );
      Object.assign(enemy, steps[Math.floor(this.random() * steps.length)]);
      unsynced.nextStepTick = this.state.tick + WALK_TICKS_PER_TILE;
    }
  }
}
