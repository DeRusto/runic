import { FISHING_SPOTS } from "./fishing.ts";
import { BUSHES } from "./herblaw.ts";
import { takeRefusal, type HasInventory, type ItemId } from "./items.ts";
import { toolRefusal } from "./dialogue.ts";
import { VEINS } from "./mining.ts";
import type { Tile } from "./region.ts";
import { levelFor } from "./skills.ts";
import { TREES } from "./woodcutting.ts";

/** The pick intent's message type; its payload is the clicked bush's id in state. */
export const PICK_INTENT = "pick";
/** The mine intent's message type; its payload is the clicked vein's id in state. */
export const MINE_INTENT = "mine";
/** The chop intent's message type; its payload is the clicked tree's id in state. */
export const CHOP_INTENT = "chop";
/** The fish intent's message type; its payload is the clicked fishing spot's id in state. */
export const FISH_INTENT = "fish";

/** One find a site can give on a successful gather: `chance` it rolls, and the one item it gives — `item`, or one of `split` by share. Each find rolls on its own, so one success can give several. */
export type FindRoll =
  | { chance: number; item: ItemId }
  | { chance: number; split: { item: ItemId; share: number }[] };

/** A better item a success can give instead of the source's own, from `level` on, on a `chance` roll, with its own experience. */
export type CatchRoll = {
  level: number;
  chance: number;
  item: ItemId;
  xp: number;
};

/** One row of `BUSHES`, `VEINS`, `TREES` or `FISHING_SPOTS`: `level` is the skill level needed, and `holds` is how many a site has before it runs out. `doubleChance` is the chance a success gives 2 of the item; unset means always 1. `finds` are the finds a success can give; unset means none. `catches`, best first, can replace `item` and `xp`; unset means never. */
export type GatheringSource = {
  level: number;
  holds: number;
  regrowTicks: number;
  xp: number;
  doubleChance?: number;
  finds?: FindRoll[];
  catches?: readonly CatchRoll[];
  item: ItemId;
};

/** How many a success gives when it doubles. */
export const DOUBLE_YIELD = 2;

/** Everything that tells the gathering skills apart. Each key is also the skill's synced `PlayerAction`. */
export const GATHERING = {
  herblaw: {
    skill: "Herblaw",
    xpField: "herblawXp",
    tool: undefined,
    /** A run-out site is refused before the player's own lacks are. */
    runOutFirst: true,
    sources: BUSHES,
    /** The site's name, and its field on a `TileKind`. */
    site: "bush",
    /** Also the type of the event each attempt sends. */
    verb: "pick",
    /** The field of `WorldState` holding the sites, and each one's count of what's left. */
    stateField: "bushes",
    leftField: "picksLeft",
    intent: PICK_INTENT,
    clip: "PickUp",
    success: "Picked!",
    successDouble: undefined,
    /** Whether the site sits on water, fished from the land beside it, rather than on open ground. */
    onWater: false,
  },
  mining: {
    skill: "Mining",
    xpField: "miningXp",
    tool: "pickaxe",
    runOutFirst: false,
    sources: VEINS,
    site: "vein",
    verb: "mine",
    stateField: "veins",
    leftField: "minesLeft",
    intent: MINE_INTENT,
    clip: "Pickaxing",
    success: "Mined!",
    successDouble: "Mined 2!",
    onWater: false,
  },
  woodcutting: {
    skill: "Woodcutting",
    xpField: "woodcuttingXp",
    tool: "axe",
    runOutFirst: false,
    sources: TREES,
    site: "tree",
    verb: "chop",
    stateField: "trees",
    leftField: "chopsLeft",
    intent: CHOP_INTENT,
    clip: "Chopping",
    success: "Chopped!",
    successDouble: undefined,
    onWater: false,
  },
  fishing: {
    skill: "Fishing",
    xpField: "fishingXp",
    tool: "rod",
    runOutFirst: false,
    sources: FISHING_SPOTS,
    site: "fishingSpot",
    verb: "fish",
    stateField: "fishingSpots",
    leftField: "catchesLeft",
    intent: FISH_INTENT,
    clip: "Fishing_Cast",
    success: "Caught!",
    successDouble: undefined,
    onWater: true,
  },
} as const;

export type GatheringSkill = keyof typeof GATHERING;
type GatheringRow = (typeof GATHERING)[GatheringSkill];
export type GatheringVerb = GatheringRow["verb"];
/** The intents that start gathering, one per skill; each payload is the site id. */
export type GatheringIntent = GatheringRow["intent"];
export type GatheringLeftField = GatheringRow["leftField"];

/** What one successful gather found: each of the source's finds rolls on its own, and a split find gives exactly one of its items, by share. */
export function rollFinds(
  source: GatheringSource,
  random: () => number,
): ItemId[] {
  const found: ItemId[] = [];
  for (const roll of source.finds ?? []) {
    if (random() >= roll.chance) continue;
    if ("item" in roll) {
      found.push(roll.item);
      continue;
    }
    let pick = random();
    // The shares sum to 1, so a draw can only run past the last on rounding;
    // start on the last item so that case still gives one.
    let gave = roll.split[roll.split.length - 1]?.item;
    for (const { item, share } of roll.split) {
      pick -= share;
      if (pick < 0) {
        gave = item;
        break;
      }
    }
    if (gave !== undefined) found.push(gave);
  }
  return found;
}

/** What one success gives and its experience: the first of the source's catches the player's level allows whose roll comes up, or else its own item. */
export function rollCatch(
  source: GatheringSource,
  level: number,
  random: () => number,
): { item: ItemId; xp: number } {
  for (const roll of source.catches ?? [])
    if (level >= roll.level && random() < roll.chance) return roll;
  return source;
}

/** In the order a tick advances them. */
export const GATHERING_SKILLS = Object.keys(GATHERING) as GatheringSkill[];

export const gatheringSource = (skill: GatheringSkill, kind: string) =>
  (GATHERING[skill].sources as Record<string, GatheringSource>)[kind]!;

/** A site's key in state: its tile, since its kind and place come from the grid. */
export const siteId = ({ x, y }: Tile) => `${x},${y}`;

/** 50% at the level needed, plus 2 points per level above it, up to 100% (spec §4). */
export const attemptChance = (levelNeeded: number, level: number) =>
  Math.min(0.5 + 0.02 * (level - levelNeeded), 1);

/** 8 ticks, one fewer per 15 levels, down to 4 at level 60. */
export const pickIntervalTicks = (level: number) =>
  8 - Math.min(Math.floor(level / 15), 4);

/** Why a click on this site is refused, or undefined if it isn't. The client shows it, and the server ignores the click. */
export function gatherRefusal(
  skill: GatheringSkill,
  kind: string,
  left: number,
  player: HasInventory & { tools: Iterable<string> } & Partial<
      Record<GatheringRow["xpField"], number>
    >,
) {
  const row = GATHERING[skill];
  const { level, item } = gatheringSource(skill, kind);
  const runOut = left === 0 ? `This ${row.site} has run out.` : undefined;
  if (runOut && row.runOutFirst) return runOut;
  const noTool = row.tool && toolRefusal(row.tool, player);
  if (noTool) return noTool;
  if (levelFor(player[row.xpField] ?? 0) < level)
    return `You need ${row.skill} ${level} to ${row.verb} this.`;
  return runOut ?? takeRefusal(item, player);
}
