import { attemptChance, bushId } from "./foraging.ts";
import { slotFor, type HasInventory } from "./items.ts";
import type { Tier } from "./region.ts";
import { levelFor } from "./skills.ts";

/** Spec §5, by tier. `level` is the Mining level needed; `ores` is how many a vein holds. */
export const VEINS = {
  copper: { level: 1, ores: 3, regrowTicks: 400, xp: 10, ore: "copperOre" },
  iron: { level: 10, ores: 3, regrowTicks: 500, xp: 30, ore: "ironOre" },
  emberite: {
    level: 20,
    ores: 3,
    regrowTicks: 600,
    xp: 60,
    ore: "emberiteOre",
  },
} as const satisfies Record<Tier, unknown>;

/** A vein's key in state: its tile, as with a bush. */
export const veinId = bushId;

export const mineChance = (tier: Tier, level: number) =>
  attemptChance(VEINS[tier].level, level);

/** Why a click on this vein is refused, or undefined if it isn't. The client shows it, and the server ignores the click. */
export function veinRefusal(
  tier: Tier,
  oreLeft: number,
  player: HasInventory & { tools: Iterable<string>; miningXp: number },
) {
  if (![...player.tools].includes("pickaxe"))
    return "You need a pickaxe. The Blacksmith will give you one.";
  const { level, ore } = VEINS[tier];
  if (levelFor(player.miningXp) < level)
    return `You need Mining ${level} to mine this.`;
  if (oreLeft === 0) return "This vein has run out.";
  if (slotFor(ore, player) < 0) return "Your inventory is full.";
  return undefined;
}
