import type { Tier } from "./region.ts";

/** Spec §5, by tier. `level` is the Mining level needed; `holds` is how many successful mines a vein holds. `xp` is per successful mine; `doubleChance` is the chance a success gives 2 ore. */
export const VEINS = {
  copper: {
    level: 1,
    holds: 3,
    regrowTicks: 400,
    xp: 6,
    doubleChance: 0.3,
    item: "copperOre",
  },
  iron: {
    level: 10,
    holds: 3,
    regrowTicks: 500,
    xp: 18,
    doubleChance: 0.25,
    item: "ironOre",
  },
  emberite: {
    level: 20,
    holds: 3,
    regrowTicks: 600,
    xp: 30,
    doubleChance: 0.2,
    item: "emberiteOre",
  },
} as const satisfies Record<Tier, unknown>;
