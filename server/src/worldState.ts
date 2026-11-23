import { schema, t } from "@colyseus/schema";
import {
  SKILLS,
  STARTING_STANCE,
  type FireLog,
  type PlayerAction,
  type Stance,
} from "@runic/shared";
import { Enemy } from "./enemies.ts";
import { GroundItem } from "./groundItems.ts";

const xpField = () => t.uint32().default(0);
/** One synced experience field per skill, so a new row in `SKILLS` needs no edit here. */
const XP_FIELDS = Object.fromEntries(
  SKILLS.map(([, field]) => [field, xpField()]),
) as Record<(typeof SKILLS)[number][1], ReturnType<typeof xpField>>;

export const Player = schema(
  {
    username: t.string(),
    x: t.uint8(),
    y: t.uint8(),
    ...XP_FIELDS,
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
    /** The shortcuts this player has rigged with a rope, which stay open for them for good (Agility spec §3). */
    riggedShortcuts: t.array("string"),
    /** Where melee experience goes (melee rework spec §3). */
    stance: t.string<Stance>().default(STARTING_STANCE),
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
    /** The arrows worn in the ammo slot, or "" (Ranged spec §2). */
    ammo: t.string().default(""),
    /** How many the weapon slot holds, 0 when empty: 1 for a sword or bow, a stack for throwing knives (Ranged spec §2). */
    weaponCount: t.uint8().default(0),
    /** How many arrows the ammo slot holds, 0 when empty (Ranged spec §2). */
    ammoCount: t.uint8().default(0),
    /** The id of the enemy this player is after, or "". */
    target: t.string().default(""),
    action: t.string<PlayerAction>().default(""),
    dead: t.boolean().default(false),
  },
  "Player",
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

export const SITE_SCHEMAS = {
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
