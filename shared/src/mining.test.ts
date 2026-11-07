import { describe, expect, it } from "vitest";
import { attemptChance, gatherRefusal } from "./gathering.ts";
import { VEINS } from "./mining.ts";
import { xpForLevel } from "./skills.ts";

const MINER = {
  tools: ["pickaxe"],
  foragingXp: 0,
  miningXp: 0,
  inventory: ["", ""],
  inventoryCounts: [0, 0],
};

describe("VEINS", () => {
  it("holds each tier's numbers from spec §5", () => {
    expect(VEINS).toEqual({
      copper: {
        level: 1,
        holds: 3,
        regrowTicks: 400,
        xp: 10,
        item: "copperOre",
      },
      iron: { level: 10, holds: 3, regrowTicks: 500, xp: 30, item: "ironOre" },
      emberite: {
        level: 20,
        holds: 3,
        regrowTicks: 600,
        xp: 60,
        item: "emberiteOre",
      },
    });
  });
});

describe("attemptChance on veins", () => {
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
    expect(attemptChance(VEINS[tier].level, level)).toBeCloseTo(chance);
    expect(attemptChance(VEINS[tier].level, level)).toBeLessThanOrEqual(1);
  });
});

describe("gatherRefusal on veins", () => {
  it("lets a player with a pickaxe, the level and room mine", () => {
    expect(gatherRefusal("mining", "copper", 3, MINER)).toBeUndefined();
  });

  it("refuses a player with no pickaxe, pointing to the Blacksmith", () => {
    expect(
      gatherRefusal("mining", "copper", 3, { ...MINER, tools: ["hammer"] }),
    ).toBe("You need a pickaxe. The Blacksmith will give you one.");
  });

  it("refuses a Mining level below the tier's gate", () => {
    expect(
      gatherRefusal("mining", "iron", 3, { ...MINER, miningXp: xpForLevel(9) }),
    ).toBe("You need Mining 10 to mine this.");
    expect(
      gatherRefusal("mining", "iron", 3, {
        ...MINER,
        miningXp: xpForLevel(10),
      }),
    ).toBeUndefined();
  });

  it("refuses a run-out vein", () => {
    expect(gatherRefusal("mining", "copper", 0, MINER)).toBe(
      "This vein has run out.",
    );
  });

  it("refuses when there's no room for that ore, but not when a stack has room", () => {
    const full = { ...MINER, inventory: ["herb"], inventoryCounts: [20] };
    expect(gatherRefusal("mining", "copper", 3, full)).toBe(
      "Your inventory is full.",
    );
    expect(
      gatherRefusal("mining", "copper", 3, {
        ...MINER,
        inventory: ["copperOre"],
        inventoryCounts: [19],
      }),
    ).toBeUndefined();
  });
});
