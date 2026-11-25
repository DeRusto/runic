import { expect, test } from "vitest";
import { rollLoot } from "./combat.ts";
import { ENEMIES } from "./enemies.ts";

const bag = [
  ["spiderSilk", 24, 1, 2],
  ["feather", 24, 3, 6],
  ["bones", 12, 1, 1],
  ["coins", 12, 5, 20],
  ["tarnHide", 6, 1, 1],
  ["bristleHide", 6, 1, 1],
  ["copperArrow", 6, 5, 10],
  ["bronzeArrow", 6, 5, 10],
  ["cinderHide", 1, 1, 1],
  ["emberbone", 1, 1, 1],
  ["copperSword", 1, 1, 1],
  ["bronzeSword", 1, 1, 1],
] as const;

test("every Gorger bag item has its share of the roll and its full count range", () => {
  const { loot, bone } = ENEMIES.gorger;
  expect(loot).toHaveLength(1);
  expect(loot[0]!.chance).toBe(1);
  let start = 0;
  for (const [item, weight, min, max] of bag) {
    for (const [pick, quantity, count] of [
      [(start + 0.01) / 100, 0, min],
      [(start + weight - 0.01) / 100, 0.999, max],
    ] as const) {
      const rolls = [pick, quantity];
      expect(rollLoot(loot, ["a"], () => rolls.shift() ?? 0, bone)).toEqual([
        { player: "a", item, count },
      ]);
    }
    start += weight;
  }
});
