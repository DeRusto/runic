import { describe, expect, it } from "vitest";
import { mineChance, veinRefusal, VEINS } from "./mining.ts";
import { xpForLevel } from "./skills.ts";

const MINER = {
  tools: ["pickaxe"],
  miningXp: 0,
  inventory: ["", ""],
  inventoryCounts: [0, 0],
};

describe("VEINS", () => {
  it("holds each tier's numbers from spec §5", () => {
    expect(VEINS).toEqual({
      copper: { level: 1, ores: 3, regrowTicks: 400, xp: 10, ore: "copperOre" },
      iron: { level: 10, ores: 3, regrowTicks: 500, xp: 30, ore: "ironOre" },
      emberite: {
        level: 20,
        ores: 3,
        regrowTicks: 600,
        xp: 60,
        ore: "emberiteOre",
      },
    });
  });
});

describe("mineChance", () => {
  it.each([
    ["copper", 1, 0.5],
    ["copper", 2, 0.52],
    ["copper", 26, 1],
    ["copper", 99, 1],
    ["iron", 10, 0.5],
    ["iron", 11, 0.52],
    ["emberite", 20, 0.5],
    ["emberite", 45, 1],
  ] as const)("%s at level %i is %f", (tier, level, chance) => {
    expect(mineChance(tier, level)).toBeCloseTo(chance);
    expect(mineChance(tier, level)).toBeLessThanOrEqual(1);
  });
});

describe("veinRefusal", () => {
  it("lets a player with a pickaxe, the level and room mine", () => {
    expect(veinRefusal("copper", 3, MINER)).toBeUndefined();
  });

  it("refuses a player with no pickaxe, pointing to the Blacksmith", () => {
    expect(veinRefusal("copper", 3, { ...MINER, tools: ["hammer"] })).toBe(
      "You need a pickaxe. The Blacksmith will give you one.",
    );
  });

  it("refuses a Mining level below the tier's gate", () => {
    expect(veinRefusal("iron", 3, { ...MINER, miningXp: xpForLevel(9) })).toBe(
      "You need Mining 10 to mine this.",
    );
    expect(
      veinRefusal("iron", 3, { ...MINER, miningXp: xpForLevel(10) }),
    ).toBeUndefined();
  });

  it("refuses a run-out vein", () => {
    expect(veinRefusal("copper", 0, MINER)).toBe("This vein has run out.");
  });

  it("refuses when there's no room for that ore, but not when a stack has room", () => {
    const full = { ...MINER, inventory: ["herb"], inventoryCounts: [20] };
    expect(veinRefusal("copper", 3, full)).toBe("Your inventory is full.");
    expect(
      veinRefusal("copper", 3, {
        ...MINER,
        inventory: ["copperOre"],
        inventoryCounts: [19],
      }),
    ).toBeUndefined();
  });
});
