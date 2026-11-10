import { BUSHES } from "./foraging.ts";
import { takeRefusal, type HasInventory, type ItemId } from "./items.ts";
import { VEINS } from "./mining.ts";
import type { Tile } from "./region.ts";
import { levelFor } from "./skills.ts";

/** The forage intent's message type; its payload is the clicked bush's id in state. */
export const FORAGE_INTENT = "forage";
/** The mine intent's message type; its payload is the clicked vein's id in state. */
export const MINE_INTENT = "mine";

/** One row of `BUSHES` or `VEINS`: `level` is the skill level needed, and `holds` is how many a site has before it runs out. `doubleChance` is the chance a success gives 2 of the item; unset means always 1. */
type GatheringSource = {
  level: number;
  holds: number;
  regrowTicks: number;
  xp: number;
  doubleChance?: number;
  item: ItemId;
};

/** How many a success gives when it doubles. */
export const DOUBLE_YIELD = 2;

/** Everything that tells the gathering skills apart. Each key is also the skill's synced `PlayerAction`. */
export const GATHERING = {
  foraging: {
    skill: "Foraging",
    xpField: "foragingXp",
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
    intent: FORAGE_INTENT,
    clip: "PickUp",
    success: "Picked!",
    successDouble: undefined,
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
  },
} as const;

export type GatheringSkill = keyof typeof GATHERING;
type GatheringRow = (typeof GATHERING)[GatheringSkill];
export type GatheringVerb = GatheringRow["verb"];
export type GatheringLeftField = GatheringRow["leftField"];

/** In the order a tick advances them. */
export const GATHERING_SKILLS = Object.keys(GATHERING) as GatheringSkill[];

export const gatheringSource = (skill: GatheringSkill, kind: string) =>
  (GATHERING[skill].sources as Record<string, GatheringSource>)[kind]!;

/** A bush's or vein's key in state: its tile, since its kind and place come from the grid. */
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
  player: HasInventory & { tools: Iterable<string> } & Record<
      GatheringRow["xpField"],
      number
    >,
) {
  const row = GATHERING[skill];
  const { level, item } = gatheringSource(skill, kind);
  const runOut = left === 0 ? `This ${row.site} has run out.` : undefined;
  if (runOut && row.runOutFirst) return runOut;
  if (row.tool && ![...player.tools].includes(row.tool))
    return `You need a ${row.tool}. The Blacksmith will give you one.`;
  if (levelFor(player[row.xpField]) < level)
    return `You need ${row.skill} ${level} to ${row.verb} this.`;
  return runOut ?? takeRefusal(item, player);
}
