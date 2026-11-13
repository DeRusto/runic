import { groundBlocks, type GroundKind, type PropKind } from "./region.ts";
import { levelFor } from "./skills.ts";
import { toolRefusal } from "./tools.ts";

/** #224's fires, one row per log. `level` is the Firemaking level needed, `ticks` how long the fire burns (#223: birch 3 minutes, oak 5, charwood 8), `xp` what lighting one pays, and `burnPercent` the points added to a cooked recipe's burn chance. */
export const FIRES = {
  birchLog: { level: 1, ticks: 600, xp: 10, burnPercent: 10 },
  oakLog: { level: 10, ticks: 1000, xp: 25, burnPercent: 5 },
  charwoodLog: { level: 20, ticks: 1600, xp: 40, burnPercent: 0 },
} as const;
export type FireLog = keyof typeof FIRES;

/** The fire this log lights, or undefined if the log lights none. */
export const fireOf = (log: string) =>
  (FIRES as Partial<Record<string, (typeof FIRES)[FireLog]>>)[log];

/** What the tile a fire would burn on is like, for `lightRefusal`: whether one is already there, its ground, and what stands on it. */
export type LightTile = {
  fire: boolean;
  ground: GroundKind;
  prop?: PropKind;
  /** Whether an enemy is standing on the tile. */
  enemy: boolean;
};

/**
 * Why a fire can't be lit from `log` on the player's own tile, or undefined if it can. The
 * client shows it, and the server ignores the click (#224). The log comes from the clicked
 * slot, so its tier picks the gate.
 */
export function lightRefusal(
  log: string | undefined,
  tile: LightTile,
  player: { firemakingXp: number; tools: Iterable<string> },
) {
  const noTool = toolRefusal("tinderbox", player);
  if (noTool) return noTool;
  const fire = log !== undefined ? fireOf(log) : undefined;
  if (!fire) return "Not enough materials";
  if (levelFor(player.firemakingXp) < fire.level)
    return `Needs Firemaking ${fire.level}`;
  if (tile.fire) return "There is already a fire here.";
  if (groundBlocks(tile.ground) || tile.prop || tile.enemy)
    return "You can't light a fire here.";
  return undefined;
}
