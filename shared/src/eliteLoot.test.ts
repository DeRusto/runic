import { expect, test } from "vitest";
import { rollLoot } from "./combat.ts";

test("elite loot rolls gear and material independently twice, quest once and bones for every damager", () => {
  const table = [
    { category: "gear", chance: 0.5, items: [{ item: "copperSword" }] },
    { category: "material", chance: 0.5, items: [{ item: "spiderSilk" }] },
    { category: "quest", chance: 0.5, items: [{ item: "boneSigil" }] },
  ] as const;
  const rolls = [0.9, 0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.1, 0.9, 0.1];
  const random = () => rolls.shift() ?? 0.99;
  expect(
    rollLoot(table, ["a", "b"], random, { item: "bones", chance: 0 }, true),
  ).toEqual([
    { player: "a", item: "copperSword", count: 1 },
    { player: "a", item: "spiderSilk", count: 1 },
    { player: "a", item: "spiderSilk", count: 1 },
    { player: "a", item: "bones", count: 1 },
    { player: "b", item: "spiderSilk", count: 1 },
    { player: "b", item: "boneSigil", count: 1 },
    { player: "b", item: "bones", count: 1 },
  ]);
});
