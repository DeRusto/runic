import { describe, expect, test, vi } from "vitest";
import {
  burnPercent,
  cookedItem,
  countOf,
  levelRefusal,
  madeItem,
  makeRefusal,
  RECIPES,
  stationRefusal,
} from "./making.ts";
import { xpForLevel } from "./skills.ts";

const holding = (
  held: [string, number][],
  smithingXp = 0,
  miningXp = 0,
  cookingXp = 0,
) => ({
  smithingXp,
  miningXp,
  cookingXp,
  inventory: held.map(([item]) => item),
  inventoryCounts: held.map(([, count]) => count),
});

test("the recipes are the rebalance spec §3's Making table, and #221's range after it", () => {
  expect(RECIPES).toEqual({
    copperBar: {
      station: "furnace",
      skill: "Mining",
      xpField: "miningXp",
      level: 1,
      costs: { copperOre: 1 },
      ticks: 6,
      xp: { miningXp: 2 },
    },
    bronzeBar: {
      station: "furnace",
      skill: "Mining",
      xpField: "miningXp",
      level: 5,
      costs: { copperOre: 1, tin: 1 },
      ticks: 6,
      xp: { miningXp: 4 },
    },
    ironBar: {
      station: "furnace",
      skill: "Mining",
      xpField: "miningXp",
      level: 10,
      costs: { ironOre: 1 },
      ticks: 6,
      xp: { miningXp: 6 },
    },
    steelBar: {
      station: "furnace",
      skill: "Mining",
      xpField: "miningXp",
      level: 15,
      costs: { ironOre: 1, coal: 1 },
      ticks: 6,
      xp: { miningXp: 9 },
    },
    emberiteBar: {
      station: "furnace",
      skill: "Mining",
      xpField: "miningXp",
      level: 20,
      costs: { emberiteOre: 1 },
      ticks: 6,
      xp: { miningXp: 12 },
    },
    copperSword: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 1,
      costs: { copperBar: 3 },
      ticks: 12,
      xp: { smithingXp: 18 },
    },
    copperShield: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 1,
      costs: { copperBar: 4 },
      ticks: 16,
      xp: { smithingXp: 24 },
    },
    copperHelmet: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 1,
      costs: { copperBar: 2 },
      ticks: 8,
      xp: { smithingXp: 12 },
    },
    copperChestplate: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 1,
      costs: { copperBar: 5 },
      ticks: 20,
      xp: { smithingXp: 30 },
    },
    copperLeggings: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 1,
      costs: { copperBar: 3 },
      ticks: 12,
      xp: { smithingXp: 18 },
    },
    bronzeSword: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 5,
      costs: { bronzeBar: 3 },
      ticks: 12,
      xp: { smithingXp: 36 },
    },
    bronzeShield: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 5,
      costs: { bronzeBar: 4 },
      ticks: 16,
      xp: { smithingXp: 48 },
    },
    bronzeHelmet: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 5,
      costs: { bronzeBar: 2 },
      ticks: 8,
      xp: { smithingXp: 24 },
    },
    bronzeChestplate: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 5,
      costs: { bronzeBar: 5 },
      ticks: 20,
      xp: { smithingXp: 60 },
    },
    bronzeLeggings: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 5,
      costs: { bronzeBar: 3 },
      ticks: 12,
      xp: { smithingXp: 36 },
    },
    ironSword: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 10,
      costs: { ironBar: 3 },
      ticks: 12,
      xp: { smithingXp: 54 },
    },
    ironShield: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 10,
      costs: { ironBar: 4 },
      ticks: 16,
      xp: { smithingXp: 72 },
    },
    ironHelmet: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 10,
      costs: { ironBar: 2 },
      ticks: 8,
      xp: { smithingXp: 36 },
    },
    ironChestplate: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 10,
      costs: { ironBar: 5 },
      ticks: 20,
      xp: { smithingXp: 90 },
    },
    ironLeggings: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 10,
      costs: { ironBar: 3 },
      ticks: 12,
      xp: { smithingXp: 54 },
    },
    steelSword: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 15,
      costs: { steelBar: 3 },
      ticks: 12,
      xp: { smithingXp: 81 },
    },
    steelShield: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 15,
      costs: { steelBar: 4 },
      ticks: 16,
      xp: { smithingXp: 108 },
    },
    steelHelmet: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 15,
      costs: { steelBar: 2 },
      ticks: 8,
      xp: { smithingXp: 54 },
    },
    steelChestplate: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 15,
      costs: { steelBar: 5 },
      ticks: 20,
      xp: { smithingXp: 135 },
    },
    steelLeggings: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 15,
      costs: { steelBar: 3 },
      ticks: 12,
      xp: { smithingXp: 81 },
    },
    emberiteSword: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 20,
      costs: { emberiteBar: 3, emberbone: 2 },
      ticks: 12,
      xp: { smithingXp: 108 },
    },
    emberiteShield: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 20,
      costs: { emberiteBar: 4, emberbone: 3 },
      ticks: 16,
      xp: { smithingXp: 144 },
    },
    emberiteHelmet: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 20,
      costs: { emberiteBar: 2, emberbone: 1 },
      ticks: 8,
      xp: { smithingXp: 72 },
    },
    emberiteChestplate: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 20,
      costs: { emberiteBar: 5, emberbone: 4 },
      ticks: 20,
      xp: { smithingXp: 180 },
    },
    emberiteLeggings: {
      station: "anvil",
      skill: "Smithing",
      xpField: "smithingXp",
      level: 20,
      costs: { emberiteBar: 3, emberbone: 2 },
      ticks: 12,
      xp: { smithingXp: 108 },
    },
    cookedPerch: {
      station: "range",
      skill: "Cooking",
      xpField: "cookingXp",
      level: 1,
      costs: { perch: 1 },
      ticks: 6,
      xp: { cookingXp: 12 },
    },
    berryPerch: {
      station: "range",
      skill: "Cooking",
      xpField: "cookingXp",
      level: 5,
      costs: { perch: 1, berry: 1 },
      ticks: 6,
      xp: { cookingXp: 18 },
    },
    herbPerch: {
      station: "range",
      skill: "Cooking",
      xpField: "cookingXp",
      level: 10,
      costs: { perch: 1, herb: 1 },
      ticks: 6,
      xp: { cookingXp: 24 },
    },
    cookedTrout: {
      station: "range",
      skill: "Cooking",
      xpField: "cookingXp",
      level: 10,
      costs: { trout: 1 },
      ticks: 6,
      xp: { cookingXp: 30 },
    },
    berryTrout: {
      station: "range",
      skill: "Cooking",
      xpField: "cookingXp",
      level: 15,
      costs: { trout: 1, berry: 1 },
      ticks: 6,
      xp: { cookingXp: 45 },
    },
    herbTrout: {
      station: "range",
      skill: "Cooking",
      xpField: "cookingXp",
      level: 20,
      costs: { trout: 1, herb: 1 },
      ticks: 6,
      xp: { cookingXp: 60 },
    },
    cookedPike: {
      station: "range",
      skill: "Cooking",
      xpField: "cookingXp",
      level: 20,
      costs: { pike: 1 },
      ticks: 6,
      xp: { cookingXp: 50 },
    },
    berryPike: {
      station: "range",
      skill: "Cooking",
      xpField: "cookingXp",
      level: 25,
      costs: { pike: 1, berry: 1 },
      ticks: 6,
      xp: { cookingXp: 75 },
    },
    herbPike: {
      station: "range",
      skill: "Cooking",
      xpField: "cookingXp",
      level: 30,
      costs: { pike: 1, herb: 1 },
      ticks: 6,
      xp: { cookingXp: 100 },
    },
  });
});

test("Emberite gear needs its Emberbones as well as its bars and level", () => {
  const level20 = xpForLevel(20);
  expect(
    makeRefusal("emberiteSword", holding([["emberiteBar", 3]], level20)),
  ).toBe("Not enough materials");
  expect(
    makeRefusal(
      "emberiteSword",
      holding(
        [
          ["emberiteBar", 3],
          ["emberbone", 2],
        ],
        xpForLevel(19),
      ),
    ),
  ).toBe("Needs Smithing 20");
  expect(
    makeRefusal(
      "emberiteShield",
      holding(
        [
          ["emberiteBar", 4],
          ["emberbone", 3],
        ],
        level20,
      ),
    ),
  ).toBeUndefined();
});

test("Bronze and Steel bars need their find as well as ore", () => {
  const level15 = xpForLevel(15);
  expect(
    makeRefusal("bronzeBar", holding([["copperOre", 1]], 0, level15)),
  ).toBe("Not enough materials");
  expect(
    makeRefusal(
      "bronzeBar",
      holding(
        [
          ["copperOre", 1],
          ["tin", 1],
        ],
        0,
        xpForLevel(4),
      ),
    ),
  ).toBe("Needs Mining 5");
  expect(
    makeRefusal(
      "steelBar",
      holding(
        [
          ["ironOre", 1],
          ["coal", 1],
        ],
        0,
        level15,
      ),
    ),
  ).toBeUndefined();
  expect(makeRefusal("steelBar", holding([["ironOre", 1]], 0, level15))).toBe(
    "Not enough materials",
  );
});

test("countOf adds up every stack of an item", () => {
  const player = holding([
    ["copperOre", 20],
    ["", 0],
    ["herb", 3],
    ["copperOre", 2],
  ]);
  expect(countOf("copperOre", player)).toBe(22);
  expect(countOf("ironOre", player)).toBe(0);
});

test("materials across stacks are enough to make an item", () => {
  const player = holding([
    ["copperBar", 1],
    ["copperBar", 2],
  ]);
  expect(makeRefusal("copperSword", player)).toBeUndefined();
});

test("too low a Smithing level is refused with the level, whatever is held", () => {
  const player = holding([["ironBar", 20]], xpForLevel(9));
  expect(makeRefusal("ironSword", player)).toBe("Needs Smithing 10");
  expect(
    makeRefusal("ironSword", { ...player, smithingXp: xpForLevel(10) }),
  ).toBeUndefined();
});

test("a furnace row is refused on Mining, whatever the Smithing level", () => {
  const player = holding([["ironOre", 1]], xpForLevel(50), xpForLevel(9));
  expect(makeRefusal("ironBar", player)).toBe("Needs Mining 10");
  expect(
    makeRefusal("ironBar", { ...player, miningXp: xpForLevel(10) }),
  ).toBeUndefined();
  expect(
    makeRefusal("ironBar", holding([["ironOre", 1]], 0, xpForLevel(10))),
  ).toBeUndefined();
});

test("the level refusal looks only at the level, never the materials", () => {
  expect(levelRefusal("steelSword", holding([], xpForLevel(14)))).toBe(
    "Needs Smithing 15",
  );
  expect(
    levelRefusal("steelSword", holding([], xpForLevel(15))),
  ).toBeUndefined();
  expect(levelRefusal("steelBar", holding([], xpForLevel(50)))).toBe(
    "Needs Mining 15",
  );
});

test("too few materials are refused", () => {
  const player = holding([["copperBar", 2]]);
  expect(makeRefusal("copperSword", player)).toBe("Not enough materials");
});

test("the anvil needs a hammer and the furnace and range need nothing", () => {
  expect(stationRefusal("anvil", { tools: ["pickaxe"] })).toBe(
    "You need a hammer. The Blacksmith will give you one.",
  );
  expect(stationRefusal("anvil", { tools: ["hammer"] })).toBeUndefined();
  expect(stationRefusal("furnace", { tools: [] })).toBeUndefined();
  expect(stationRefusal("range", { tools: [] })).toBeUndefined();
});

describe("cooking at the range (#221)", () => {
  test("the base fish are gated on Cooking at 1, 10 and 20, the dishes 5 above them, the herb dishes 10", () => {
    const player = holding([["perch", 1]]);
    expect(makeRefusal("cookedPerch", player)).toBeUndefined();
    expect(
      makeRefusal("cookedTrout", holding([["trout", 1]], 0, 0, xpForLevel(9))),
    ).toBe("Needs Cooking 10");
    expect(
      makeRefusal(
        "herbPike",
        holding(
          [
            ["pike", 1],
            ["herb", 1],
          ],
          0,
          0,
          xpForLevel(29),
        ),
      ),
    ).toBe("Needs Cooking 30");
    expect(
      makeRefusal("berryPike", holding([["pike", 1]], 0, 0, xpForLevel(25))),
    ).toBe("Not enough materials");
  });

  test("food rolls Delicious by the improved-item formula, at the fish's gate and 0.2% a level to its 20% cap", () => {
    expect(cookedItem("cookedPerch", 1, rolling(0.0399))).toBe(
      "cookedPerch:delicious",
    );
    expect(cookedItem("cookedPerch", 1, rolling(0.04))).toBe("cookedPerch");
    expect(cookedItem("cookedTrout", 20, rolling(0.0599))).toBe(
      "cookedTrout:delicious",
    );
    // Cooked perch's gate is 1, so the cap arrives: 40 + 2 × 98 over it.
    expect(cookedItem("cookedPerch", 99, rolling(0.1999))).toBe(
      "cookedPerch:delicious",
    );
    expect(cookedItem("cookedPerch", 99, rolling(0.2))).toBe("cookedPerch");
  });

  test("a burn is 25% at the fish's gate, a percent less per level, floored at 0", () => {
    expect(burnPercent("cookedPerch", 1)).toBe(25);
    expect(burnPercent("cookedPerch", 30)).toBe(0);
    expect(burnPercent("cookedTrout", 10)).toBe(25);
    expect(burnPercent("cookedTrout", 11)).toBe(24);
    expect(burnPercent("berryPike", 30)).toBe(20);
  });
});

/** A random source that returns `rolls` in order. */
const rolling =
  (...rolls: number[]) =>
  () =>
    rolls.shift()!;

describe("making improved gear (spec §2, §3)", () => {
  test("at the gate, 4% of pieces are improved", () => {
    expect(madeItem("ironSword", 10, rolling(0.0399, 0.5, 0))).toBe(
      "ironSword:uncommon:fortitude",
    );
    expect(madeItem("ironSword", 10, rolling(0.04))).toBe("ironSword");
  });

  test("each Smithing level above the gate adds 0.2%: Copper gear at 20 is 7.8%", () => {
    expect(madeItem("copperHelmet", 20, rolling(0.0779, 0.5, 0))).toBe(
      "copperHelmet:uncommon:fortitude",
    );
    expect(madeItem("copperHelmet", 20, rolling(0.078))).toBe("copperHelmet");
  });

  test("the chance stops at 20%", () => {
    expect(madeItem("copperSword", 99, rolling(0.1999, 0.5, 0))).toBe(
      "copperSword:uncommon:fortitude",
    );
    expect(madeItem("copperSword", 99, rolling(0.2))).toBe("copperSword");
  });

  test("one improved piece in five is rare", () => {
    expect(madeItem("copperShield", 1, rolling(0, 0.1999, 0))).toBe(
      "copperShield:rare:fortitude",
    );
    expect(madeItem("copperShield", 1, rolling(0, 0.2, 0))).toBe(
      "copperShield:uncommon:fortitude",
    );
  });

  test("each Virtue is a third of improved pieces, whatever the slot", () => {
    expect(madeItem("copperLeggings", 1, rolling(0, 0.5, 0.3333))).toBe(
      "copperLeggings:uncommon:fortitude",
    );
    expect(madeItem("copperLeggings", 1, rolling(0, 0.5, 0.3334))).toBe(
      "copperLeggings:uncommon:might",
    );
    expect(madeItem("copperLeggings", 1, rolling(0, 0.5, 0.6667))).toBe(
      "copperLeggings:uncommon:avoidance",
    );
    expect(madeItem("copperLeggings", 1, rolling(0, 0.5, 0.9999))).toBe(
      "copperLeggings:uncommon:avoidance",
    );
  });

  test("bars are never improved, and roll nothing", () => {
    const random = vi.fn(() => 0);
    expect(madeItem("copperBar", 1, random)).toBe("copperBar");
    expect(random).not.toHaveBeenCalled();
  });
});
