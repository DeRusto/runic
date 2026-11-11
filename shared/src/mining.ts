import type { Tier } from "./region.ts";

/** Spec §3, by tier. `level` is the Mining level needed; `holds` is how many successful mines a vein holds. `xp` is per successful mine; `doubleChance` is the chance a success gives 2 ore; `finds` are the materials a success can give along with its ore, each rolling on its own. */
export const VEINS = {
  copper: {
    level: 1,
    holds: 3,
    regrowTicks: 400,
    xp: 6,
    doubleChance: 0.3,
    item: "copperOre",
    finds: [{ chance: 1 / 3, item: "tin" }],
  },
  iron: {
    level: 10,
    holds: 3,
    regrowTicks: 500,
    xp: 18,
    doubleChance: 0.25,
    item: "ironOre",
    finds: [
      { chance: 1 / 6, item: "tin" },
      { chance: 1 / 2, item: "coal" },
    ],
  },
  emberite: {
    level: 20,
    holds: 3,
    regrowTicks: 600,
    xp: 30,
    doubleChance: 0.2,
    item: "emberiteOre",
    finds: [
      {
        chance: 1 / 20,
        split: [
          { item: "ashstone", share: 0.7 },
          { item: "cinderglass", share: 0.25 },
          { item: "heartflame", share: 0.05 },
        ],
      },
    ],
  },
} as const satisfies Record<Tier, unknown>;
