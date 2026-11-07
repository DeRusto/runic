import { expect, test } from "vitest";
import { countOf, makeRefusal, RECIPES, stationRefusal } from "./making.ts";
import { xpForLevel } from "./skills.ts";

const holding = (held: [string, number][], smithingXp = 0) => ({
  smithingXp,
  inventory: held.map(([item]) => item),
  inventoryCounts: held.map(([, count]) => count),
});

test("the recipes are spec §5's table", () => {
  expect(RECIPES).toEqual({
    copperBar: {
      station: "furnace",
      level: 1,
      costs: { copperOre: 1 },
      ticks: 6,
      xp: { smithingXp: 4, miningXp: 4 },
    },
    ironBar: {
      station: "furnace",
      level: 10,
      costs: { ironOre: 1 },
      ticks: 6,
      xp: { smithingXp: 12, miningXp: 12 },
    },
    emberiteBar: {
      station: "furnace",
      level: 20,
      costs: { emberiteOre: 1 },
      ticks: 6,
      xp: { smithingXp: 24, miningXp: 24 },
    },
    copperSword: {
      station: "anvil",
      level: 1,
      costs: { copperBar: 3 },
      ticks: 12,
      xp: { smithingXp: 18 },
    },
    copperShield: {
      station: "anvil",
      level: 1,
      costs: { copperBar: 4 },
      ticks: 16,
      xp: { smithingXp: 24 },
    },
    ironSword: {
      station: "anvil",
      level: 10,
      costs: { ironBar: 3 },
      ticks: 12,
      xp: { smithingXp: 54 },
    },
    ironShield: {
      station: "anvil",
      level: 10,
      costs: { ironBar: 4 },
      ticks: 16,
      xp: { smithingXp: 72 },
    },
    emberiteSword: {
      station: "anvil",
      level: 20,
      costs: { emberiteBar: 3, emberbone: 2 },
      ticks: 12,
      xp: { smithingXp: 108 },
    },
    emberiteShield: {
      station: "anvil",
      level: 20,
      costs: { emberiteBar: 4, emberbone: 3 },
      ticks: 16,
      xp: { smithingXp: 144 },
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

test("too few materials are refused", () => {
  const player = holding([["copperBar", 2]]);
  expect(makeRefusal("copperSword", player)).toBe("Not enough materials");
});

test("the anvil needs a hammer and the furnace needs nothing", () => {
  expect(stationRefusal("anvil", { tools: ["pickaxe"] })).toBe(
    "You need a hammer. The Blacksmith will give you one.",
  );
  expect(stationRefusal("anvil", { tools: ["hammer"] })).toBeUndefined();
  expect(stationRefusal("furnace", { tools: [] })).toBeUndefined();
});
