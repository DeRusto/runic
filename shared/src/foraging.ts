import { slotFor, type HasInventory } from "./items.ts";
import type { Tile } from "./region.ts";
import { levelFor } from "./skills.ts";

/** Spec §5. Picks and regrowth are per bush; `level` is the Foraging level needed. */
export const BUSHES = {
  berryBush: { level: 1, picks: 5, regrowTicks: 84, xp: 10, food: "berry" },
  herbBush: { level: 10, picks: 3, regrowTicks: 150, xp: 25, food: "herb" },
} as const;
export type BushKind = keyof typeof BUSHES;
/** What an item adds to the healing pool when eaten; anything else isn't food. */
export const FOOD_HEALS = new Map([
  ["berry", 2],
  ["herb", 5],
]);

/** A bush's key in state: its tile, since its kind and place come from the grid. */
export const bushId = ({ x, y }: Tile) => `${x},${y}`;

/** 50% at the level needed, plus 2 points per level above it, up to 100%. Mining shares it (spec §4). */
export const attemptChance = (levelNeeded: number, level: number) =>
  Math.min(0.5 + 0.02 * (level - levelNeeded), 1);

export const pickChance = (kind: BushKind, level: number) =>
  attemptChance(BUSHES[kind].level, level);

/** 8 ticks, one fewer per 15 levels, down to 4 at level 60. */
export const pickIntervalTicks = (level: number) =>
  8 - Math.min(Math.floor(level / 15), 4);

/** Why a click on this bush is refused, or undefined if it isn't. The client shows it, and the server ignores the click. */
export function bushRefusal(
  kind: BushKind,
  picksLeft: number,
  player: HasInventory & { foragingXp: number },
) {
  if (picksLeft === 0) return "This bush has run out.";
  const { level } = BUSHES[kind];
  if (levelFor(player.foragingXp) < level)
    return `You need Foraging ${level} to pick this.`;
  if (slotFor(BUSHES[kind].food, player) < 0) return "Your inventory is full.";
  return undefined;
}
