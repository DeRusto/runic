import { ArraySchema, schema, t } from "@colyseus/schema";
import {
  addItems,
  addXp,
  armourPercentOf,
  AUGMENTATIONS,
  augmentationOf,
  attemptChance,
  avoidanceOf,
  blockOf,
  BLOCKING_XP_PER_BLOCK,
  burnPercent,
  capeIn,
  COMBAT_LOCK_TICKS,
  COINS,
  cookedItem,
  costsOf,
  dealRefusal,
  dealTotals,
  DEFENSE_XP_PER_DAMAGE_TAKEN,
  DEFENSE_XP_PER_ENEMY_SWING,
  DELICIOUS_BUFF_INTERVAL_TICKS,
  DELICIOUS_BUFF_PERCENT,
  DELICIOUS_BUFF_TICKS,
  DOUBLE_YIELD,
  EAT_INTERVAL_TICKS,
  EAT_SWING_DELAY_TICKS,
  EMPTY_SLOT,
  enemyHitChance,
  FIGHT_BACK_DELAY_TICKS,
  FIRES,
  FOOD_HEALS,
  gatheringSource,
  gatherRefusal,
  GATHERING,
  GATHERING_SKILLS,
  gearOf,
  GEAR_SLOTS,
  gearRefusal,
  gossamerItem,
  HEALING_POOL_INTERVAL_TICKS,
  HEALTH_PER_HITPOINTS_LEVEL,
  hitOf,
  INVENTORY_SLOTS,
  ITEMS,
  levelFor,
  LIGHTING_TICKS,
  lightRefusal,
  logoutRefusal,
  maxHealthOf,
  madeItem,
  makeRefusal,
  makingOf,
  LOG,
  LOGS,
  yieldOf,
  type AugmentationKind,
  type MakeItem,
  moveStack,
  MASTERY_SHARE_PERCENT,
  MAX_PINNED_SKILLS,
  pickIntervalTicks,
  potionFromPlant,
  potionOf,
  POTIONS,
  POTION_BUFF_TICKS,
  AVOIDANCE_POTION_POINTS,
  FORTITUDE_POTION_PERCENT,
  MIGHT_POTION_HIT,
  mixRefusal,
  removeItems,
  PLAYER_CRIT_CHANCE,
  PLAYER_CRIT_MULTIPLIER,
  PLAYER_DEAD_TICKS,
  RECIPES,
  REGEN_INTERVAL_TICKS,
  REGEN_PERCENT_OF_MAX_HEALTH,
  groundBlocks,
  respawnTile,
  rollCatch,
  rollFinds,
  findItemOf,
  identifyEssence,
  siteId,
  SHELF_SLOTS,
  SKILLS,
  slotFor,
  takeRefusal,
  STARTING_PINNED_SKILLS,
  stationRefusal,
  tilesApart,
  SWING_INTERVAL_TICKS,
  BANK_SLOTS,
  bankRefusal,
  bankSlotFor,
  depositRefusal,
  itemParts,
  ENEMIES,
  STARTING_HEALTH,
  STARTING_HITPOINTS_XP,
  aTool,
  VILLAGERS,
  WALK_TICKS_PER_TILE,
  choicesNodeOf,
  countOf,
  QUEST_DONE,
  currentQuestOf,
  doublesAt,
  openingNodeOf,
  stageOf,
  type Deal,
  type DealLine,
  offers,
  type DialogueAction,
  nodesOf,
  type Quest,
  type QuestTurnIn,
  type Tool,
  type Villager,
  type VillagerId,
  xpOf,
  type GatheringLeftField,
  type GatheringSkill,
  type PlayerAction,
  type EnemyKind,
  type EnemyState,
  type FireLog,
  type GearSlot,
  type ItemId,
  type RecipeItem,
  type SitePool,
  type StationKind,
  type Virtue,
  XP_PER_DAMAGE_DEALT,
  type Tile,
  type TileKind,
  type WorldEvent,
  type XpField,
} from "@runic/shared";
import { GroundItem, GroundItems } from "./groundItems.ts";
import { Shelf } from "./shelf.ts";
import {
  findPath,
  legalSteps,
  pathNextTo,
  tilesNextTo,
} from "./pathfinding.ts";
import type { PlayerSave } from "./saves.ts";

/** What opens and closes each kind of villager window, and what a hit makes the villager do. */
const WINDOWS = {
  talk: { closed: "talkEnded", hit: "stops talking" },
  store: { opened: "storeOpened", closed: "storeClosed", hit: "stops trading" },
  bank: { opened: "bankOpened", closed: "bankClosed", hit: "shuts the bank" },
} as const;
type VillagerWindow = keyof typeof WINDOWS;

/** The Hitpoints level × 100, plus the Fortitude of every worn piece (spec §2). */
const maxHealthTotal = (
  player: { hitpointsXp: number } & Partial<Record<GearSlot, string>>,
) => {
  const { skill, gear } = maxHealthOf(player);
  return skill + gear;
};

/**
 * A tray's lines copied out of an untrusted payload, or undefined if it isn't a list of at most
 * `max` items, each with a whole count above 0.
 */
function dealLines(list: unknown, max: number) {
  if (!Array.isArray(list) || list.length > max) return undefined;
  const lines = list.map((line) => ({ item: line?.item, count: line?.count }));
  return lines.every(
    (line) => typeof line.item === "string" && isAmount(line.count),
  )
    ? (lines as DealLine[])
    : undefined;
}

const isInventorySlot = (slot: number) =>
  Number.isInteger(slot) && slot >= 0 && slot < INVENTORY_SLOTS;
const isBankSlot = (slot: number) =>
  Number.isInteger(slot) && slot >= 0 && slot < BANK_SLOTS;
const isAmount = (amount: number) => Number.isInteger(amount) && amount > 0;

export const Player = schema(
  {
    username: t.string(),
    x: t.uint8(),
    y: t.uint8(),
    combatXp: t.uint32(),
    defenseXp: t.uint32(),
    herblawXp: t.uint32(),
    hitpointsXp: t.uint32(),
    miningXp: t.uint32().default(0),
    smithingXp: t.uint32().default(0),
    woodcuttingXp: t.uint32().default(0),
    fishingXp: t.uint32().default(0),
    cookingXp: t.uint32().default(0),
    firemakingXp: t.uint32().default(0),
    craftingXp: t.uint32().default(0),
    fletchingXp: t.uint32().default(0),
    runecraftingXp: t.uint32().default(0),
    blockingXp: t.uint32().default(0),
    masteryXp: t.uint32().default(0),
    /** The fraction of a point of Mastery not yet earned, so small gains add up. */
    masteryHundredths: t.uint8().default(0),
    /** Each started quest's id, in the order they were started (#231). */
    quests: t.array("string"),
    /** Parallel to `quests`: the stage it's on, or "done" (#231). */
    questStages: t.array("string"),
    /** The quest points finished quests have awarded (#231). */
    questPoints: t.uint16().default(0),
    /** Whether the player knows the veins' strange material for rune essence, taught by Odo's second quest (#232). */
    identifiesEssence: t.boolean().default(false),
    /** In any order; the sheet's order decides how they show. */
    pinnedSkills: t.array("string"),
    health: t.uint16(),
    maxHealth: t.uint16(),
    inventory: t.array("string"),
    /** Parallel to `inventory`: how many in each slot, 0 for an empty one. */
    inventoryCounts: t.array("uint32"),
    tools: t.array("string"),
    /** Like `inventory`, `BANK_SLOTS` long. Tagged for views: the room adds each player to their own view only, so nobody else sees it. */
    bank: t.array("string").view(),
    /** Parallel to `bank`, and uncapped. */
    bankCounts: t.array("uint32").view(),
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

export const Tree = schema({ chopsLeft: t.uint8() }, "Tree");

export const FishingSpot = schema({ catchesLeft: t.uint8() }, "FishingSpot");

/** A fire a player has lit, keyed in state by its tile: the log it burns, which sets its tier, and the tick it despawns on (#224). */
export const Fire = schema(
  { log: t.string<FireLog>(), endTick: t.uint32() },
  "Fire",
);

const SITE_SCHEMAS = {
  bushes: Bush,
  veins: Vein,
  trees: Tree,
  fishingSpots: FishingSpot,
};

export const WorldState = schema(
  {
    tick: t.uint32().default(0),
    players: t.map(Player),
    enemies: t.map(Enemy),
    bushes: t.map(Bush),
    veins: t.map(Vein),
    trees: t.map(Tree),
    fishingSpots: t.map(FishingSpot),
    /** Every burning fire, keyed by its tile, visible to everyone (#224). */
    fires: t.map(Fire),
    /** Tagged for views: the room adds each one to the views of the players who can see it. */
    groundItems: t.map(GroundItem).view(),
    /** The general store's shelf, the same for every player: item ids, and parallel to them how many. */
    shelf: t.array("string"),
    shelfCounts: t.array("uint32"),
  },
  "WorldState",
);

/** A site pool, with the ticks its run-out sites come back on, soonest first. */
type SitePoolState = SitePool & { comebackTicks: number[] };

/** A gathering site: where it is and what it is, its synced entry, and when it grows back or which pool it comes back in. */
type GatheringSite = Tile & {
  skill: GatheringSkill;
  kind: string;
  synced: Partial<Record<GatheringLeftField, number>>;
  regrowTick?: number;
  pool?: SitePoolState;
};

/** What a player is doing, beyond walking. Each kind but visiting is also its synced `PlayerAction`. */
type UnsyncedAction =
  | { kind: "fighting"; enemy: string }
  | { kind: GatheringSkill; site: string }
  | {
      kind: "visiting";
      villager: VillagerId;
      then?: Exclude<DialogueAction, "quest">;
    }
  | { kind: "taking"; groundItem: string }
  | { kind: "following"; player: string }
  /**
   * `item` is a recipe's product or an augmentation (#225), `all` for Make all, and `at` names
   * the fire a range recipe cooks at (#224). `doneTick` stays unset until arrival starts the
   * first wait.
   */
  | {
      kind: "smithing";
      item: MakeItem;
      all: boolean;
      at?: Tile;
      doneTick?: number;
    }
  /** The log is already burnt: a new click or a death during the lighting loses it (#224). */
  | { kind: "lighting"; log: FireLog; doneTick: number };

/** The whole game: rules and state, with no network. Tests and the room both drive it through tick(). */
export class Simulation {
  state = new WorldState();
  /** Only the latest click per player counts, so a flood of them costs one path per tick. */
  private queuedActions = new Map<
    string,
    | { to: Tile }
    | { enemy: string }
    | { gather: GatheringSkill; site: string }
    | { villager: VillagerId; then?: Exclude<DialogueAction, "quest"> }
    | { make: MakeItem; all: boolean; at?: Tile }
    | { light: number }
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
      /** A Delicious fish's buff, or none: its fish's per-tick heal, when it next heals and the tick it runs out on. Not saved (spec §6, #221). */
      delicious?: { perTick: number; nextHealTick: number; endTick: number };
      /**
       * A Virtue potion's buff, or none: its Virtue, the tick it runs out on and the health
       * a Fortitude one added, which the hit and Avoidance read from too. Not saved
       * (spec §6, #222).
       */
      potion?: { virtue: Virtue; endTick: number; bonus: number };
      /** The combat lock runs until this tick. */
      lockEndTick: number;
      respawnTick: number;
      /** Each started quest's progress, by quest id, kept for the save (#231). */
      quests: Map<string, { stage: string; turns: number }>;
      dropped?: boolean;
    }
  >();
  /** Apart from the action, which eating doesn't replace (spec §4). */
  private queuedEats = new Map<string, number>();
  /** Apart from the action too, which dropping doesn't replace (spec §4). */
  private queuedDrops = new Map<string, { slot: number; amount: number }>();
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
  /** Every gathering site, by the tile that keys it. */
  private sites = new Map<string, GatheringSite>();
  private villagers = new Map<VillagerId, Tile>();
  /**
   * Each player's open villager window, the villager they must stay beside, and for a
   * conversation the node whose choices they can pick from, if any. A player has at most one.
   */
  private windows = new Map<
    string,
    { kind: VillagerWindow; villager: VillagerId; node?: string }
  >();
  /** What each choice's action but a quest's does, with the villager who offered it; the choice has already been checked. A quest's runs in `choose`, where it decides where the talk moves to (#231). */
  private readonly dialogueActions: Record<
    Exclude<DialogueAction, "quest">,
    (id: string, villager: VillagerId) => void
  > = {
    giveTools: (id, villager) => this.giveTools(id, villager),
    openStore: (id, villager) => this.openWindow(id, "store", villager),
    openBank: (id, villager) => this.openWindow(id, "bank", villager),
  };
  private readonly shelf = new Shelf(this.state.shelf, this.state.shelfCounts);
  /** Each station's tiles: the furnace covers four. */
  private stations: Partial<Record<StationKind, Tile[]>> = {};
  private queuedLogouts = new Set<string>();
  /** Players whose log out intent was accepted, for the room to disconnect. */
  readonly loggedOut: string[] = [];
  private readonly groundItems = new GroundItems(this.state.groundItems);
  /** This tick's one-shot moments, for the room to broadcast after the patch and empty. */
  readonly events: WorldEvent[] = [];

  /** The region's tiles, copied so that a pooled site can block its spot only while it's there. */
  private tiles: TileKind[][];
  /** Each site pool, with the ticks its run-out sites come back on, soonest first. Not saved: a restart picks again. */
  private pools: SitePoolState[];

  constructor(
    tiles: TileKind[][],
    readonly random: () => number,
    pools: SitePool[] = [],
  ) {
    this.tiles = tiles.map((row) => row.map((tile) => ({ ...tile })));
    tiles.forEach((row, y) =>
      row.forEach((kind, x) => {
        const { enemy, villager, station } = kind;
        if (villager) this.villagers.set(villager, { x, y });
        if (station) (this.stations[station] ??= []).push({ x, y });
        for (const skill of GATHERING_SKILLS) {
          const siteKind = kind[GATHERING[skill].site];
          if (siteKind) this.addSite(skill, siteKind, { x, y });
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
    this.pools = pools.map((pool) => ({ ...pool, comebackTicks: [] }));
    for (const pool of this.pools)
      for (let i = 0; i < pool.active; i++) this.placePooledSite(pool);
  }

  /** A full site on `tile`, which blocks while it's there. */
  private addSite(
    skill: GatheringSkill,
    kind: string,
    { x, y }: Tile,
    pool?: SitePoolState,
  ) {
    const { site, stateField, leftField } = GATHERING[skill];
    const id = siteId({ x, y });
    const synced = Object.assign(new SITE_SCHEMAS[stateField](), {
      [leftField]: gatheringSource(skill, kind).holds,
    });
    // The row keeps the schema and its map together, which the types can't follow.
    this.state[stateField].set(id, synced as never);
    this.sites.set(id, { x, y, skill, kind, synced, pool });
    Object.assign(this.tiles[y]![x]!, { [site]: kind, blocks: true });
  }

  /** A full site on a free spot of `pool`, picked at random: false if every spot has a site, a player, an enemy or a ground item on it. */
  private placePooledSite(pool: SitePoolState) {
    const standing = [
      ...this.state.players.values(),
      ...this.state.enemies.values(),
      ...this.state.groundItems.values(),
    ];
    const free = pool.spots.filter(
      (spot) =>
        !this.sites.has(siteId(spot)) &&
        !standing.some(({ x, y }) => x === spot.x && y === spot.y),
    );
    if (!free.length) return false;
    const spot = free[Math.floor(this.random() * free.length)]!;
    this.addSite(pool.skill, pool.kind, spot, pool);
    return true;
  }

  /** Takes a run-out pooled site off its spot, to come back somewhere in its pool after its regrow time. */
  private removePooledSite(site: GatheringSite, pool: SitePoolState) {
    const { site: field, stateField } = GATHERING[site.skill];
    const id = siteId(site);
    this.sites.delete(id);
    this.state[stateField].delete(id);
    const tile = this.tiles[site.y]![site.x]!;
    delete tile[field];
    tile.blocks = groundBlocks(tile.ground);
    pool.comebackTicks.push(
      this.state.tick + gatheringSource(site.skill, site.kind).regrowTicks,
    );
  }

  /** `saved` is the account's last save; without one, this is a new account. */
  addPlayer(id: string, saved?: PlayerSave, username = "") {
    const {
      inventory,
      inventoryCounts = [],
      pinnedSkills = STARTING_PINNED_SKILLS,
      tools = [],
      bank = [],
      bankCounts = [],
      // A save from before the quests has none, so nobody starts with progress (#231).
      quests = {},
      ...fields
    } = this.loginSave(saved);
    const player = Object.assign(new Player(), fields, {
      username,
      maxHealth: maxHealthTotal(fields),
    });
    player.pinnedSkills = new ArraySchema(...pinnedSkills);
    player.tools = new ArraySchema(...tools);
    player.quests = new ArraySchema(...Object.keys(quests));
    player.questStages = new ArraySchema(
      ...Object.values(quests).map(({ stage }) => stage),
    );
    player.inventory = new ArraySchema(...inventory);
    // A filled slot with no count is a stack of 1: every existing save's food (spec §6).
    player.inventoryCounts = new ArraySchema(
      ...inventory.map((item, slot) =>
        item === EMPTY_SLOT ? 0 : inventoryCounts[slot] || 1,
      ),
    );
    // A save from before the bank has none, so it starts empty (village spec §6).
    player.bank = new ArraySchema(
      ...Array.from(
        { length: BANK_SLOTS },
        (_, slot) => bank[slot] ?? EMPTY_SLOT,
      ),
    );
    player.bankCounts = new ArraySchema(
      ...Array.from({ length: BANK_SLOTS }, (_, slot) => bankCounts[slot] ?? 0),
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
      quests: new Map(Object.entries(quests)),
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
        herblawXp: 0,
        hitpointsXp: STARTING_HITPOINTS_XP,
        health: STARTING_HEALTH,
        inventory: Array<string>(INVENTORY_SLOTS).fill(EMPTY_SLOT),
      };
    }
    const tile = this.tiles[saved.y]?.[saved.x];
    if (tile && !tile.blocks) return saved;
    // A pooled site may have come back on the spot they logged out on.
    const nearest = this.sites.has(siteId(saved))
      ? this.nearestPastSites(saved)
      : undefined;
    return { ...saved, ...(nearest ?? respawn) };
  }

  /** The fewest steps from `from` to a walkable tile, walking through sites as if they had run out: undefined if nothing else is in reach. */
  private nearestPastSites(from: Tile): Tile | undefined {
    const throughSites = this.tiles.map((row, y) =>
      row.map((tile, x) =>
        this.sites.has(siteId({ x, y })) ? { ...tile, blocks: false } : tile,
      ),
    );
    const seen = new Set([siteId(from)]);
    const queue = [from];
    // Breadth-first, so the first walkable tile found is the fewest steps away.
    for (const tile of queue) {
      if (!this.tiles[tile.y]![tile.x]!.blocks) return tile;
      for (const next of legalSteps(throughSites, tile)) {
        if (seen.has(siteId(next))) continue;
        seen.add(siteId(next));
        queue.push(next);
      }
    }
    return undefined;
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
      herblawXp,
      hitpointsXp,
      miningXp,
      smithingXp,
      woodcuttingXp,
      fishingXp,
      cookingXp,
      firemakingXp,
      craftingXp,
      fletchingXp,
      runecraftingXp,
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
      questPoints,
      quests,
      questStages,
      identifiesEssence,
    } = player;
    const stages = [...questStages];
    return {
      x,
      y,
      combatXp,
      defenseXp,
      herblawXp,
      hitpointsXp,
      miningXp,
      smithingXp,
      woodcuttingXp,
      fishingXp,
      cookingXp,
      firemakingXp,
      craftingXp,
      fletchingXp,
      runecraftingXp,
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
      questPoints,
      identifiesEssence,
      // Each quest's stage and repeat turn-ins done, beside the xp columns (#231).
      quests: Object.fromEntries(
        [...quests].map((quest, at) => [
          quest,
          {
            stage: stages[at]!,
            turns: this.unsyncedPlayers.get(id)?.quests.get(quest)?.turns ?? 0,
          },
        ]),
      ),
      pinnedSkills: [...player.pinnedSkills],
      inventory: [...player.inventory],
      inventoryCounts: [...player.inventoryCounts],
      tools: [...player.tools],
      bank: [...player.bank],
      bankCounts: [...player.bankCounts],
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
    this.windows.delete(id);
    this.stopFollowersOf(id);
    // A leaver has no inventory to fill (spec D8).
    for (const enemy of this.unsyncedEnemies.values())
      enemy.damagers.delete(id);
  }

  /** Lost connection but stays in the world: idle (D9), and still there to be hit. */
  dropPlayer(id: string) {
    this.clearAction(id);
    this.unsyncedPlayers.get(id)!.dropped = true;
    this.windows.delete(id);
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
   * Comes straight off the network, so anything but a recipe's product or an augmentation is
   * ignored, as is choosing an anvil recipe with no hammer. `at` names the fire to cook at
   * instead of the range, and is refused unless one burns there. Level and materials wait for
   * arrival (spec §4, #225).
   */
  queueMake(id: string, intent: { item: string; all: boolean; at?: Tile }) {
    const player = this.state.players.get(id);
    const { item, all, at } = intent ?? {};
    // A string first: an array of one would pass hasOwn by turning into its element.
    if (!player || player.dead || typeof item !== "string") return;
    if (!Object.hasOwn(RECIPES, item) && !Object.hasOwn(AUGMENTATIONS, item))
      return;
    const make = item as MakeItem;
    const { station } = makingOf(make);
    // `at` names the fire to cook at, which stands in for the range (#224).
    let fire: Tile | undefined;
    if (at) {
      const { x, y } = at as Partial<Tile>;
      if (
        station !== "range" ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        !this.state.fires.has(siteId({ x, y } as Tile))
      )
        return;
      fire = { x: x!, y: y! };
    } else if (!this.stations[station] || stationRefusal(station, player)) {
      return;
    }
    this.queuedActions.set(id, { make, all: all === true, at: fire });
  }

  /**
   * `slot` comes straight off the network, so anything but an inventory slot's index is
   * ignored. The log, the tinderbox and the tile all wait for the tick, since the player is
   * standing on the tile already (#224).
   */
  queueLight(id: string, slot: number) {
    if (!this.alive(id)) return;
    if (!isInventorySlot(slot)) return;
    this.queuedActions.set(id, { light: slot });
  }

  /**
   * Both come straight off the network, so a villager who isn't standing in this region is
   * ignored, as is a `then` their conversation doesn't offer.
   */
  queueVisit(id: string, villager: string, then?: string) {
    if (!this.alive(id) || !this.villagers.has(villager as VillagerId)) return;
    const visit = { villager: villager as VillagerId };
    if (then === undefined) this.queuedActions.set(id, visit);
    else if (offers(visit.villager, then))
      this.queuedActions.set(id, {
        ...visit,
        then: then as Exclude<DialogueAction, "quest">,
      });
  }

  /** `choice` comes straight off the network, so anything but the index of one of the current choices is ignored, as is a player no longer beside the villager. */
  choose(id: string, choice: number) {
    const talk = this.windowOf(id, "talk");
    if (!talk?.node || !Number.isInteger(choice)) return;
    const picked = nodesOf(talk.villager)[talk.node]!.choices![choice];
    if (!picked || !this.beside(id, talk.villager)) return;
    // A quest choice is the server's check: a turn-in it refuses keeps the node, which the box shows again from its first line (#231).
    if (picked.action === "quest") {
      if (!this.advanceQuest(id, talk.villager)) {
        this.moveTalk(id, talk.villager, talk.node);
        return;
      }
      this.moveTalk(id, talk.villager, picked.to);
      return;
    }
    this.moveTalk(id, talk.villager, picked.to);
    if (picked.action) this.dialogueActions[picked.action](id, talk.villager);
  }

  /** The player closed the conversation, so walking away later says nothing. */
  endTalk(id: string) {
    this.closeWindow(id, "talk");
  }

  /**
   * A conversation with no choices left stays open, with no node, until the box has shown its
   * last lines and sends endTalk, so walking away or a hit still closes the box.
   */
  private moveTalk(id: string, villager: VillagerId, node: string) {
    this.replaceWindow(id, "talk");
    this.events.push({ type: "talk", player: id, villager, node });
    this.windows.set(id, {
      kind: "talk",
      villager,
      node: choicesNodeOf(villager, node),
    });
  }

  /** Opens a store or bank window. */
  private openWindow(id: string, kind: "store" | "bank", villager: VillagerId) {
    this.replaceWindow(id, kind);
    this.windows.set(id, { kind, villager });
    this.events.push({ type: WINDOWS[kind].opened, player: id });
  }

  /** A window of another kind still open closes quietly, so the client shuts it (village spec §2). */
  private replaceWindow(id: string, kind: VillagerWindow) {
    const open = this.windows.get(id);
    if (open && open.kind !== kind)
      this.events.push({ type: WINDOWS[open.kind].closed, player: id });
  }

  /** The player's window, if it is of this kind. */
  private windowOf(id: string, kind: VillagerWindow) {
    const open = this.windows.get(id);
    return open?.kind === kind ? open : undefined;
  }

  /** The player closed it, so walking away later says nothing. */
  private closeWindow(id: string, kind: VillagerWindow) {
    if (this.windowOf(id, kind)) this.windows.delete(id);
  }

  /** The node this villager's conversation opens with: the chain's current quest's stage-appropriate one, or their own start (#231, #232). */
  private openingNode(id: string, villager: VillagerId) {
    return openingNodeOf(villager, this.unsyncedPlayers.get(id)!.quests);
  }

  /** Closes the player's window from the server's side, with the line saying why. */
  private shutWindow(id: string, line: string) {
    const open = this.windows.get(id);
    if (!open) return;
    this.windows.delete(id);
    this.events.push({ type: "told", player: id, line });
    this.events.push({ type: WINDOWS[open.kind].closed, player: id });
  }

  private beside(id: string, villager: VillagerId) {
    const player = this.state.players.get(id)!;
    return tilesNextTo(this.tiles, this.villagers.get(villager)!).some(
      ({ x, y }) => x === player.x && y === player.y,
    );
  }

  closeBank(id: string) {
    this.closeWindow(id, "bank");
  }

  /** The player, if their bank is open and no combat lock refuses it; the refusal is told. */
  private playerAtBank(id: string) {
    if (!this.windowOf(id, "bank") || !this.alive(id)) return undefined;
    const refusal = bankRefusal(this.lockRunning(id));
    if (refusal) this.events.push({ type: "told", player: id, line: refusal });
    return refusal ? undefined : this.state.players.get(id)!;
  }

  /**
   * Both come straight off the network, so anything but an inventory slot's index and a whole
   * number above 0 is ignored. Like equip it skips the queue and touches no action.
   */
  deposit(id: string, slot: number, amount: number) {
    if (!isInventorySlot(slot) || !isAmount(amount)) return;
    const player = this.playerAtBank(id);
    const line = player && this.depositSlot(id, player, slot, amount);
    if (line) this.events.push({ type: "told", player: id, line });
  }

  /** Whatever fits goes in, and one line says when anything didn't (village spec §6). */
  depositInventory(id: string) {
    const player = this.playerAtBank(id);
    if (!player) return;
    const refusals = Array.from({ length: INVENTORY_SLOTS }, (_, slot) =>
      this.depositSlot(id, player, slot, Infinity),
    );
    const line = refusals.find(Boolean);
    if (line) this.events.push({ type: "told", player: id, line });
  }

  /** Returns why the slot's item stays where it is, if it does. */
  private depositSlot(
    id: string,
    player: InstanceType<typeof Player>,
    slot: number,
    amount: number,
  ) {
    const item = player.inventory[slot]!;
    if (item === EMPTY_SLOT) return undefined;
    const refusal = depositRefusal(item, player.bank);
    if (refusal) return refusal;
    const to = bankSlotFor(item, player.bank);
    const count = Math.min(amount, player.inventoryCounts[slot]!);
    player.bank[to] = item;
    player.bankCounts[to]! += count;
    player.inventoryCounts[slot]! -= count;
    if (!player.inventoryCounts[slot]) player.inventory[slot] = EMPTY_SLOT;
    if (this.queuedDrops.get(id)?.slot === slot) this.queuedDrops.delete(id);
    return undefined;
  }

  /**
   * Both come straight off the network, as for deposit. Takes as many as fit, topping up the
   * inventory's stacks before filling free slots, and the rest stays in the bank (village spec §6).
   */
  withdraw(id: string, slot: number, amount: number) {
    if (!isBankSlot(slot) || !isAmount(amount)) return;
    const player = this.playerAtBank(id);
    const item = player?.bank[slot];
    if (!player || !item) return;
    const refusal = takeRefusal(item, player);
    if (refusal) {
      this.events.push({ type: "told", player: id, line: refusal });
      return;
    }
    const { inventory, inventoryCounts } = player;
    const count = Math.min(amount, player.bankCounts[slot]!);
    player.bankCounts[slot]! -=
      count - addItems(inventory, inventoryCounts, item, count);
    if (!player.bankCounts[slot]) player.bank[slot] = EMPTY_SLOT;
  }

  /** A drag in the bank, under the inventory's rules; both come straight off the network. */
  moveBankItem(id: string, from: number, to: number) {
    if (!isBankSlot(from) || !isBankSlot(to)) return;
    const player = this.windowOf(id, "bank") && this.state.players.get(id);
    if (player) moveStack(player.bank, player.bankCounts, from, to);
  }

  private giveTools(id: string, villager: VillagerId, given?: readonly Tool[]) {
    const player = this.state.players.get(id)!;
    const { name, tools = [] }: Villager = VILLAGERS[villager];
    const lacking = (given ?? tools).filter(
      (tool) => !player.tools.includes(tool),
    );
    if (!lacking.length) return;
    player.tools.push(...lacking);
    const line = `${name} gives you ${lacking.map(aTool).join(" and ")}.`;
    this.events.push({ type: "told", player: id, line });
  }

  /** Rewrites the player's synced quest arrays from their unsynced progress (#231). */
  private syncQuests(id: string) {
    const player = this.state.players.get(id)!;
    const quests = this.unsyncedPlayers.get(id)!.quests;
    player.quests = new ArraySchema(...quests.keys());
    player.questStages = new ArraySchema(
      ...[...quests.values()].map(({ stage }) => stage),
    );
  }

  /**
   * Runs the quest of this villager's chain that the player is on, for the choice picked:
   * starting it, or turning in the stage's or a repeat's items. False when what it asks for
   * isn't there yet, so the talk stays on the node (#231, #232).
   */
  private advanceQuest(id: string, villager: VillagerId) {
    const quest = currentQuestOf(
      villager,
      this.unsyncedPlayers.get(id)!.quests,
    );
    if (!quest) return false;
    const player = this.state.players.get(id)!;
    const progress = this.unsyncedPlayers.get(id)!.quests.get(quest.id);
    return progress
      ? this.advanceStage(id, player, quest, progress)
      : this.startQuest(id, player, quest);
  }

  /** Sets the first stage, and hands over the work's tools. Starting a quest never fails. */
  private startQuest(
    id: string,
    player: InstanceType<typeof Player>,
    quest: Quest,
  ) {
    this.unsyncedPlayers
      .get(id)!
      .quests.set(quest.id, { stage: quest.stages[0]!.id, turns: 0 });
    if (quest.gives) this.giveTools(id, quest.villager, quest.gives);
    this.syncQuests(id);
    return true;
  }

  /** Moves a started quest on one stage, taking its turn-in or a repeat's, and finishes it with its points. */
  private advanceStage(
    id: string,
    player: InstanceType<typeof Player>,
    quest: Quest,
    progress: { stage: string; turns: number },
  ) {
    if (progress.stage === QUEST_DONE) {
      const repeat = quest.repeat;
      if (!repeat || progress.turns >= repeat.turns) return false;
      if (!this.takeTurnIn(id, player, repeat.turnIn)) return false;
      progress.turns++;
      // Quest experience earns no Mastery share (glossary: Mastery).
      player[repeat.xpField] = addXp(player[repeat.xpField], repeat.xp);
      return true;
    }
    const stage = stageOf(quest, progress.stage)!;
    if (stage.turnIn && !this.takeTurnIn(id, player, stage.turnIn))
      return false;
    const next = quest.stages[quest.stages.indexOf(stage) + 1];
    if (next) progress.stage = next.id;
    else {
      progress.stage = QUEST_DONE;
      player.questPoints += quest.points;
      // Odo's teaching sets the flag at once, and every strange material the player holds,
      // bank included, turns with it (#232).
      if (quest.teaches === "essence") {
        player.identifiesEssence = true;
        identifyEssence(player);
      }
      this.events.push({
        type: "told",
        player: id,
        line: `You finish ${quest.title}. You earn ${quest.points} quest point${quest.points === 1 ? "" : "s"}.`,
      });
    }
    this.syncQuests(id);
    return true;
  }

  /** Takes a turn-in out of the inventory, or says what's missing. */
  private takeTurnIn(
    id: string,
    player: InstanceType<typeof Player>,
    { item, count }: QuestTurnIn,
  ) {
    if (countOf(item, player) < count) {
      // "copperOre" reads as "copper ore", like an item's name does.
      const name = item.replace(
        /[A-Z]/g,
        (letter) => ` ${letter.toLowerCase()}`,
      );
      this.events.push({
        type: "told",
        player: id,
        line: `You have no ${name} to hand over.`,
      });
      return false;
    }
    removeItems(player.inventory, player.inventoryCounts, item, count);
    return true;
  }

  closeStore(id: string) {
    this.closeWindow(id, "store");
  }

  /**
   * Settles both trays at once, sales first so their coins pay for the buys (village spec §5). It comes
   * straight off the network, so anything of the wrong shape, or from a player without the
   * store open, is ignored. Like a drag it skips the queue and touches no action.
   */
  deal(id: string, intent: Deal) {
    const player = this.state.players.get(id);
    if (!player || player.dead || !this.windowOf(id, "store")) return;
    const buy = dealLines(intent?.buy, SHELF_SLOTS);
    const sell = dealLines(intent?.sell, INVENTORY_SLOTS);
    if (!buy || !sell || (!buy.length && !sell.length)) return;
    const deal = { buy, sell };
    const tell = (line: string) =>
      this.events.push({ type: "told", player: id, line });
    const answer = (done: boolean) =>
      this.events.push({ type: "dealAnswered", player: id, done });
    const refusal = dealRefusal(deal, player, this.state);
    if (refusal) {
      tell(refusal);
      return answer(false);
    }
    const { inventory, inventoryCounts } = player;
    const { tick } = this.state;
    for (const { item, count } of sell) {
      removeItems(inventory, inventoryCounts, item, count);
      this.shelf.stock(item, count, tick);
    }
    const { pay, get } = dealTotals(deal);
    addItems(inventory, inventoryCounts, COINS, get);
    removeItems(inventory, inventoryCounts, COINS, pay);
    for (const { item, count } of buy) {
      this.shelf.take(item, count, tick);
      addItems(inventory, inventoryCounts, item, count);
    }
    // What waited on a slot meant what was there before.
    this.queuedDrops.delete(id);
    this.queuedEats.delete(id);
    tell(`Deal done: you paid ${pay} coins and got ${get}.`);
    answer(true);
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

  /** Both come straight off the network, so anything but a slot's index and a whole number above 0 is ignored. */
  queueDrop(id: string, slot: number, amount: number) {
    if (!this.alive(id)) return;
    if (!isInventorySlot(slot)) return;
    if (!isAmount(amount)) return;
    this.queuedDrops.set(id, { slot, amount });
  }

  /** A drag; both come straight off the network. Like equip it skips the queue and touches no action (village spec §4). */
  moveItem(id: string, from: number, to: number) {
    if (!this.alive(id)) return;
    if (!isInventorySlot(from) || !isInventorySlot(to)) return;
    const player = this.state.players.get(id)!;
    moveStack(player.inventory, player.inventoryCounts, from, to);
    // What waited on a slot meant what was there before.
    const drop = this.queuedDrops.get(id)?.slot;
    if (drop === from || drop === to) this.queuedDrops.delete(id);
    const eat = this.queuedEats.get(id);
    if (eat === from || eat === to) this.queuedEats.delete(id);
  }

  /**
   * Mixing a potion: `slot` comes straight off the network, so anything but a slot holding a
   * mixable plant is ignored. Like a move it skips the queue and touches no action, as
   * nothing waits on it (#222).
   */
  mix(id: string, slot: number) {
    if (!this.alive(id) || !isInventorySlot(slot)) return;
    const player = this.state.players.get(id)!;
    const potion = potionFromPlant(player.inventory[slot]!);
    if (!potion) return;
    const refusal = mixRefusal(potion, player);
    if (refusal) {
      this.events.push({ type: "told", player: id, line: refusal });
      return;
    }
    // One vial and one plant become one potion, wherever each was (#222).
    const { inventory, inventoryCounts } = player;
    removeItems(inventory, inventoryCounts, "vial", 1);
    removeItems(inventory, inventoryCounts, POTIONS[potion].plant, 1);
    addItems(inventory, inventoryCounts, potion, 1);
    this.earnXp(player, "herblawXp", POTIONS[potion].xp);
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
    const gear = gearOf(item);
    if (!gear) return;
    const refusal = gearRefusal(item, player);
    if (refusal) {
      this.events.push({ type: "told", player: id, line: refusal });
      return;
    }
    // Whatever was worn lands where this came from, so swapping always works (spec §4).
    this.placeGear(id, slot, player[gear.slot]);
    player[gear.slot] = item;
    this.fitHealth(id);
  }

  /** After gear changes or a Fortitude potion starts or ends: max health follows worn Fortitude and an active potion's, and health drops to it but never rises (spec §2, #222). */
  private fitHealth(id: string) {
    const player = this.state.players.get(id)!;
    player.maxHealth =
      maxHealthTotal(player) +
      (this.unsyncedPlayers.get(id)!.potion?.bonus ?? 0);
    player.health = Math.min(player.health, player.maxHealth);
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
    this.fitHealth(id);
  }

  /** Puts gear, or "", in a slot. A drop waiting on the slot meant what was there, not this. */
  private placeGear(id: string, slot: number, item: string) {
    const player = this.state.players.get(id)!;
    player.inventory[slot] = item;
    player.inventoryCounts[slot] = item ? 1 : 0;
    if (this.queuedDrops.get(id)?.slot === slot) this.queuedDrops.delete(id);
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

  /** A part drop is one ground item, and the rest stays in the slot. */
  private drop(id: string, slot: number, amount = Infinity) {
    const player = this.state.players.get(id)!;
    const item = player.inventory[slot]!;
    if (!item) return;
    const count = Math.min(amount, player.inventoryCounts[slot]!);
    const { username } = player;
    this.groundItems.spawn(player, item, count, username, this.state.tick);
    player.inventoryCounts[slot]! -= count;
    if (!player.inventoryCounts[slot]) player.inventory[slot] = EMPTY_SLOT;
  }

  private eat(id: string, slot: number) {
    const player = this.state.players.get(id)!;
    const unsynced = this.unsyncedPlayers.get(id)!;
    const parts = itemParts(player.inventory[slot]);
    const food = FOOD_HEALS.get(parts.base);
    const potion = potionOf(parts.base);
    if (
      (food === undefined && !potion) ||
      this.state.tick < unsynced.nextEatTick
    )
      return;
    unsynced.nextEatTick = this.state.tick + EAT_INTERVAL_TICKS;
    // From now if no swing is waiting, or a past timer would swallow the delay.
    unsynced.nextSwingTick =
      Math.max(unsynced.nextSwingTick, this.state.tick) + EAT_SWING_DELAY_TICKS;
    if (--player.inventoryCounts[slot]! === 0)
      player.inventory[slot] = EMPTY_SLOT;
    // Not at full health, or a swing later this tick could save it from being lost.
    if (food && player.health < player.maxHealth) {
      unsynced.healingPool.push(
        ...Array<number>(food.ticks).fill(food.perTick),
      );
    }
    // A Delicious fish heals on its own afterwards, and another one only refreshes it (#221).
    if (parts.quality === "delicious") {
      unsynced.delicious = {
        perTick: food!.perTick,
        nextHealTick: this.state.tick + DELICIOUS_BUFF_INTERVAL_TICKS,
        endTick: this.state.tick + DELICIOUS_BUFF_TICKS,
      };
      this.events.push({
        type: "delicious",
        player: id,
        ticks: DELICIOUS_BUFF_TICKS,
      });
    }
    // A potion's Virtue replaces the heal: two minutes of it, refreshed never stacked (#222).
    if (potion) {
      const { virtue } = POTIONS[potion];
      unsynced.potion = {
        virtue,
        endTick: this.state.tick + POTION_BUFF_TICKS,
        // A Fortitude potion's quarter is worked out once, on the normal max.
        bonus:
          virtue === "fortitude"
            ? Math.round(
                (maxHealthTotal(player) * FORTITUDE_POTION_PERCENT) / 100,
              )
            : 0,
      };
      this.fitHealth(id);
      this.events.push({
        type: "potion",
        player: id,
        virtue,
        ticks: POTION_BUFF_TICKS,
      });
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
    this.advanceFires();
    this.advanceMaking();
    this.advanceLighting();
    this.advanceVisits();
    this.advanceTakes();
    this.advancePlayerSwings();
    this.advanceEnemies();
    this.advancePlayerTimers();
    this.advanceSites();
    this.advanceEnemyReturns();
    this.groundItems.advance(this.state.tick);
    this.shelf.advance(this.state.tick);
  }

  private applyIntents() {
    for (const [id, intent] of this.queuedActions) {
      const unsynced = this.unsyncedPlayers.get(id)!;
      const player = this.state.players.get(id)!;
      // With no way there, the old action still ends, and nothing replaces it.
      const goNextTo = (action: UnsyncedAction) => {
        const path = pathNextTo(this.tiles, player, this.nextToOf(action)!);
        unsynced.path = path ?? [];
        unsynced.action = path && action;
      };
      if ("enemy" in intent) {
        unsynced.action = { kind: "fighting", enemy: intent.enemy };
      } else if ("make" in intent) {
        const action: UnsyncedAction = {
          kind: "smithing",
          item: intent.make,
          all: intent.all,
          at: intent.at,
        };
        // A fire the player is standing on or beside needs no walk (#224).
        if (intent.at && tilesApart(player, intent.at) <= 1) {
          unsynced.action = action;
          unsynced.path = [];
        } else {
          goNextTo(action);
        }
      } else if ("light" in intent) {
        const log = player.inventory[intent.light]!;
        const refusal = lightRefusal(log, this.lightTileAt(player), player);
        if (refusal)
          this.events.push({ type: "told", player: id, line: refusal });
        else {
          // The log is consumed at once, so a new click during the lighting loses it (#224).
          removeItems(player.inventory, player.inventoryCounts, log, 1);
          unsynced.action = {
            kind: "lighting",
            log: log as FireLog,
            doneTick: this.state.tick + LIGHTING_TICKS,
          };
          this.events.push({
            type: "make",
            player: id,
            station: "fire",
            ticks: LIGHTING_TICKS,
          });
        }
      } else if ("villager" in intent) {
        goNextTo({
          kind: "visiting",
          ...intent,
        });
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
        goNextTo({
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
    for (const [id, { slot, amount }] of this.queuedDrops)
      this.drop(id, slot, amount);
    this.queuedDrops.clear();
    for (const id of this.queuedLogouts) {
      const refusal = logoutRefusal(this.lockRunning(id));
      if (refusal)
        this.events.push({ type: "told", player: id, line: refusal });
      else this.loggedOut.push(id);
    }
    this.queuedLogouts.clear();
  }

  /** The tiles a walk for this action ends next to, for the actions whose target stays put. */
  private nextToOf(action?: UnsyncedAction): Tile | Tile[] | undefined {
    if (action?.kind === "smithing")
      return action.at ?? this.stations[makingOf(action.item).station];
    if (action?.kind === "visiting") return this.villagers.get(action.villager);
    if (action && "site" in action) return this.sites.get(action.site);
    return undefined;
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
      const next = unsynced.path[0];
      // A pooled site may have come back on the way since the path was found,
      // perhaps on the tile the walk ends on, so head for the target again.
      if (
        next &&
        !legalSteps(this.tiles, player).some(
          ({ x, y }) => x === next.x && y === next.y,
        )
      ) {
        const nextTo = this.nextToOf(unsynced.action);
        unsynced.path = nextTo
          ? (pathNextTo(this.tiles, player, nextTo) ?? [])
          : findPath(this.tiles, player, unsynced.path.at(-1)!);
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
      // A pooled site that ran out is gone from its spot.
      const site = this.sites.get(action.site);
      // A site that came back may have left no way to stand next to it.
      if (
        !site ||
        this.siteRefusal(site, player) ||
        !tilesNextTo(this.tiles, site).some(
          ({ x, y }) => x === player.x && y === player.y,
        )
      ) {
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
      const finds = success
        ? rollFinds(source, this.random).map((found) =>
            findItemOf(found, player.identifiesEssence),
          )
        : [];
      this.events.push(
        success
          ? { type: verb, player: id, success, count, finds }
          : { type: verb, player: id, success },
      );
      if (!success) continue;
      const { item, xp } = rollCatch(source, level, this.random);
      this.earnXp(player, xpField, xp);
      // Room is counted before either lands, so the second ore goes on the
      // ground, owned by the miner, when the first took the last of it.
      const room = this.roomFor(item, player);
      for (let i = 0; i < count; i++) {
        if (i < room) this.addToSlot(player, slotFor(item, player), item);
        else
          this.groundItems.spawn(
            player,
            item,
            1,
            player.username,
            this.state.tick,
          );
      }
      // Each find rolls on its own; one with no room goes to the ground, owned
      // by the miner, like the second ore.
      for (const found of finds) {
        if (this.roomFor(found, player) > 0)
          this.addToSlot(player, slotFor(found, player), found);
        else
          this.groundItems.spawn(
            player,
            found,
            1,
            player.username,
            this.state.tick,
          );
      }
      if (--site.synced[leftField]! === 0) {
        if (site.pool) this.removePooledSite(site, site.pool);
        else site.regrowTick = this.state.tick + source.regrowTicks;
      }
      unsynced.action = undefined;
    }
  }

  /** After the steps, so the first wait starts on the tick of arrival. */
  private advanceMaking() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const { action: making } = unsynced;
      if (making?.kind !== "smithing" || unsynced.path.length) continue;
      // A fire can burn out mid-job, ending the cooking on it (#224).
      if (making.at && !this.state.fires.has(siteId(making.at))) {
        unsynced.action = undefined;
        continue;
      }
      if (making.doneTick !== undefined) {
        if (this.state.tick < making.doneTick) continue;
        if (!this.finishItem(id, making) || !making.all) {
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
      const { station, ticks } = makingOf(making.item);
      making.doneTick = this.state.tick + ticks;
      this.events.push({ type: "make", player: id, station, ticks });
    }
  }

  /** Swaps materials for the item and experience, all at once or, with a line saying why, not at all. */
  private finishItem(id: string, { item, at }: { item: MakeItem; at?: Tile }) {
    const player = this.state.players.get(id)!;
    const told = (line: string) => {
      this.events.push({ type: "told", player: id, line });
      return false;
    };
    // Dropping during the wait is allowed, so they may have gone.
    const refusal = makeRefusal(item, player);
    if (refusal) return told(refusal);
    // An augmentation has no roll: its product is the cape's own gossamer variant (#217, #225).
    if (Object.hasOwn(AUGMENTATIONS, item))
      return this.finishAugment(id, player, item as AugmentationKind);
    const recipe = item as RecipeItem;
    // A burn consumes the fish: no experience, no item, and Make all goes on to the
    // next one (#221). It never rolls Delicious.
    if (RECIPES[recipe].station === "range") {
      const level = levelFor(player.cookingXp);
      // A fire burns more than the range, by the points of the log it burns (#224).
      const fire = at ? this.state.fires.get(siteId(at)) : undefined;
      const burn =
        burnPercent(recipe, level) + (fire ? FIRES[fire.log].burnPercent : 0);
      if (this.random() < burn / 100) {
        for (const [cost, count] of costsOf(recipe))
          removeItems(player.inventory, player.inventoryCounts, cost, count);
        // "berryPerch" reads as "berry perch", like an item's name does.
        const name = recipe.replace(
          /[A-Z]/g,
          (letter) => ` ${letter.toLowerCase()}`,
        );
        this.events.push({
          type: "told",
          player: id,
          line: `You burn the ${name}.`,
        });
        return true;
      }
    }
    // Rolled after the room check below, so a refused make rolls nothing.
    const roll =
      RECIPES[recipe].station === "range"
        ? () => cookedItem(recipe, levelFor(player.cookingXp), this.random)
        : // The improved chance is the making skill's, so a bow rolls on Fletching (#228).
          () =>
            madeItem(
              recipe,
              levelFor(player[RECIPES[recipe].xpField]),
              this.random,
            );
    return this.craftItem(id, player, recipe, roll);
  }

  /**
   * Swaps the reagent and the first cape held for its gossamer variant, which keeps the cape's
   * Quality and Virtue, on a copy so a full inventory can refuse first (#217, #225).
   */
  private finishAugment(
    id: string,
    player: InstanceType<typeof Player>,
    item: AugmentationKind,
  ) {
    const told = (line: string) => {
      this.events.push({ type: "told", player: id, line });
      return false;
    };
    const { reagent, xp, xpField } = AUGMENTATIONS[item];
    // The refusal has already found a cape to work on.
    const cape = capeIn(player)!;
    const made = gossamerItem(cape);
    const inventory = [...player.inventory];
    const inventoryCounts = [...player.inventoryCounts];
    removeItems(inventory, inventoryCounts, reagent, 1);
    removeItems(inventory, inventoryCounts, cape, 1);
    const slot = slotFor(made, { inventory, inventoryCounts });
    if (slot < 0) return told("Your inventory is full.");
    inventory[slot] = made;
    inventoryCounts[slot]!++;
    inventory.forEach((held, i) => {
      player.inventory[i] = held;
      player.inventoryCounts[i] = inventoryCounts[i]!;
    });
    this.earnXp(player, xpField, xp);
    this.events.push({ type: "made", player: id, item: made });
    return true;
  }

  /** Swaps the materials for what `roll` makes, on a copy so a full inventory can refuse first. */
  private craftItem(
    id: string,
    player: InstanceType<typeof Player>,
    item: RecipeItem,
    roll: () => string,
  ) {
    const told = (line: string) => {
      this.events.push({ type: "told", player: id, line });
      return false;
    };
    const inventory = [...player.inventory];
    const inventoryCounts = [...player.inventoryCounts];
    for (const [cost, count] of costsOf(item)) {
      let left = count;
      // A stand-in cost takes any tier of its kind, first held first, like an augmentation's cape (#228).
      const takes: string[] = cost === LOG ? [...LOGS] : [cost];
      inventory.forEach((held, slot) => {
        if (!takes.includes(held) || !left) return;
        const taken = Math.min(left, inventoryCounts[slot]!);
        left -= taken;
        inventoryCounts[slot]! -= taken;
        if (!inventoryCounts[slot]) inventory[slot] = EMPTY_SLOT;
      });
    }
    // On the copy, so the last ore in a full inventory leaves room for its bar. Gear never
    // stacks, so the plain item needs the same room as an improved one, and a refused make rolls nothing.
    const slot = slotFor(item, { inventory, inventoryCounts });
    if (slot < 0) return told("Your inventory is full.");
    const made = roll();
    // A batch tops up every stack of it with room before filling empty slots, and refuses whole if it doesn't all fit (#228).
    // At a rune's doubling level one essence makes two runes, and each rune pays its experience (#232).
    const times = doublesAt(item, levelFor(player[RECIPES[item].xpField]))
      ? 2
      : 1;
    if (addItems(inventory, inventoryCounts, made, yieldOf(item) * times))
      return told("Your inventory is full.");
    inventory.forEach((held, i) => {
      player.inventory[i] = held;
      player.inventoryCounts[i] = inventoryCounts[i]!;
    });
    for (const [field, gained] of xpOf(item))
      this.earnXp(player, field, gained * times);
    this.events.push({ type: "made", player: id, item: made });
    return true;
  }

  /**
   * What the player's tile is like for lighting a fire on it (#224). The tile kind gives the
   * ground and any prop; a fire of their own and an enemy standing there come from state.
   */
  private lightTileAt({ x, y }: Tile) {
    const kind = this.tiles[y]![x]!;
    return {
      fire: this.state.fires.has(siteId({ x, y })),
      ground: kind.ground,
      prop: kind.prop,
      enemy: [...this.state.enemies.values()].some(
        (enemy) => enemy.state !== "dead" && enemy.x === x && enemy.y === y,
      ),
    };
  }

  /** A fire of `log`'s tier on the player's own tile, and a station of kind "fire" while it burns (#224). */
  private placeFire({ x, y }: Tile, log: FireLog) {
    this.state.fires.set(
      siteId({ x, y }),
      Object.assign(new Fire(), {
        log,
        endTick: this.state.tick + FIRES[log].ticks,
      }),
    );
    (this.stations.fire ??= []).push({ x, y });
  }

  /** Fires despawn silently when their time is up, and stop being stations (#224). */
  private advanceFires() {
    for (const [id, fire] of this.state.fires) {
      if (this.state.tick < fire.endTick) continue;
      this.state.fires.delete(id);
      const [x, y] = id.split(",").map(Number) as [number, number];
      const tiles = this.stations.fire!;
      tiles.splice(
        tiles.findIndex((tile) => tile.x === x && tile.y === y),
        1,
      );
    }
  }

  /** When the lighting is over, the fire appears and pays its experience (#224). */
  private advanceLighting() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== "lighting" || this.state.tick < action.doneTick)
        continue;
      unsynced.action = undefined;
      const player = this.state.players.get(id)!;
      // A rival may have lit one here first; the log already burnt, so nothing is placed.
      if (this.lightTileAt(player).fire) continue;
      this.placeFire(player, action.log);
      this.earnXp(player, "firemakingXp", FIRES[action.log].xp);
    }
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
      const { item } = groundItem;
      const line = takeRefusal(item, player);
      if (line) {
        this.events.push({ type: "told", player: id, line });
        continue;
      }
      // In one go, as a pile of coins can run to millions.
      const { inventory, inventoryCounts } = player;
      const taken =
        groundItem.count -
        addItems(inventory, inventoryCounts, item, groundItem.count);
      this.groundItems.take(action.groundItem, taken);
      takenThisTick.add(action.groundItem);
    }
  }

  /** After the steps, so a conversation opens on the tick of arrival, and one walked away from ends on the tick of the step. */
  private advanceVisits() {
    for (const [id, unsynced] of this.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== "visiting" || unsynced.path.length) continue;
      unsynced.action = undefined;
      if (action.then) this.dialogueActions[action.then](id, action.villager);
      else
        this.moveTalk(
          id,
          action.villager,
          this.openingNode(id, action.villager),
        );
    }
    for (const [id, { villager }] of this.windows) {
      if (!this.beside(id, villager))
        this.shutWindow(id, `You walk away from ${VILLAGERS[villager].name}.`);
    }
  }

  private advanceSites() {
    for (const site of this.sites.values()) {
      if (this.state.tick !== site.regrowTick) continue;
      const { leftField } = GATHERING[site.skill];
      site.synced[leftField] = gatheringSource(site.skill, site.kind).holds;
      site.regrowTick = undefined;
    }
    // One with no free spot waits, and tries again next tick.
    for (const pool of this.pools)
      while (
        pool.comebackTicks[0]! <= this.state.tick &&
        this.placePooledSite(pool)
      )
        pool.comebackTicks.shift();
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
    const { chance, max, gear } = hitOf(player);
    const rolled = this.rollDamage(chance, max);
    // A Might potion adds to the hit like the sword bonus does, while its buff lasts (#222).
    const buffed =
      gear +
      (this.unsyncedPlayers.get(id)!.potion?.virtue === "might"
        ? MIGHT_POTION_HIT
        : 0);
    // Only on a hit, as 0 means a miss.
    const hit = rolled && rolled + buffed;
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
    this.fitHealth(id);
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
      const line = "You find an [Emberbone]. It is on the ground.";
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
    const { maxDamage, swingIntervalTicks } = ENEMIES[enemy.kind];
    unsynced.nextSwingTick = this.state.tick + swingIntervalTicks;
    this.lock(enemy.target);
    const avoidance = avoidanceOf(player);
    // Worn Avoidance and a potion's point add up per the Virtue rules (#222).
    const buffed =
      avoidance.skill +
      avoidance.gear +
      (this.unsyncedPlayers.get(enemy.target)!.potion?.virtue === "avoidance"
        ? AVOIDANCE_POTION_POINTS
        : 0);
    const rolled = this.rollDamage(
      enemyHitChance(enemy.kind, buffed),
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
    // A blocked swing still hits; only a miss leaves the window open.
    const open = this.windows.get(enemy.target);
    if (rolled && open) {
      const { name } = VILLAGERS[open.villager];
      this.shutWindow(
        enemy.target,
        `You're hit, and ${name} ${WINDOWS[open.kind].hit}.`,
      );
    }
    if (player.health === 0) this.die(enemy.target, player);
    else if (player.action === "") this.fightBack(enemy.target, player, id);
  }

  private rollBlock(player: InstanceType<typeof Player>) {
    const block = blockOf(player);
    return !!block && this.random() < block.shield + block.skill;
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
    unsynced.delicious = undefined;
    unsynced.potion = undefined;
    this.fitHealth(id);
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
      // A Delicious fish heals through a fight, where regeneration pauses (#221).
      const { delicious, potion } = unsynced;
      if (delicious) {
        if (this.state.tick >= delicious.nextHealTick) {
          delicious.nextHealTick += DELICIOUS_BUFF_INTERVAL_TICKS;
          const amount = Math.min(
            Math.round((delicious.perTick * DELICIOUS_BUFF_PERCENT) / 100),
            player.maxHealth - player.health,
          );
          player.health += amount;
          if (amount > 0)
            this.events.push({ type: "healed", player: id, amount });
        }
        if (this.state.tick >= delicious.endTick)
          unsynced.delicious = undefined;
      }
      // A potion's Virtue runs out like the Delicious buff's healing does (#222): the
      // unspent Fortitude bonus is lost, and health settles on the normal max.
      if (potion && this.state.tick >= potion.endTick) {
        unsynced.potion = undefined;
        this.fitHealth(id);
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
