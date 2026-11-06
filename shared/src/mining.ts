import type { Tier } from "./region.ts";

/** Spec §5, by tier. `level` is the Mining level needed; `holds` is how many ores a vein holds. */
export const VEINS = {
  copper: { level: 1, holds: 3, regrowTicks: 400, xp: 10, item: "copperOre" },
  iron: { level: 10, holds: 3, regrowTicks: 500, xp: 30, item: "ironOre" },
  emberite: {
    level: 20,
    holds: 3,
    regrowTicks: 600,
    xp: 60,
    item: "emberiteOre",
  },
} as const satisfies Record<Tier, unknown>;
