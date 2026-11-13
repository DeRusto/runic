import { expect, test } from "vitest";
import {
  ESSENCE_FIND_CHANCE,
  findItemOf,
  identifyEssence,
  RUNE_ESSENCE,
  RUNES,
  STRANGE_MATERIAL,
} from "./runecrafting.ts";

test("the essence find is tunable at 1 in 5 (#232)", () => {
  expect(ESSENCE_FIND_CHANCE).toBe(0.2);
});

test("a find is the strange material until the player identifies essence, then the essence itself", () => {
  expect(findItemOf(STRANGE_MATERIAL, false)).toBe(STRANGE_MATERIAL);
  expect(findItemOf(STRANGE_MATERIAL, true)).toBe(RUNE_ESSENCE);
  // Any other find is itself either way.
  expect(findItemOf("tin", false)).toBe("tin");
  expect(findItemOf("ashstone", true)).toBe("ashstone");
});

test("identifying turns every strange material held into rune essence, bank included, and moves nothing else", () => {
  const player = {
    inventory: [
      STRANGE_MATERIAL,
      "copperOre",
      STRANGE_MATERIAL,
      "",
      STRANGE_MATERIAL,
    ],
    inventoryCounts: [20, 5, 1, 0, 3],
    bank: [
      "",
      STRANGE_MATERIAL,
      "tin",
      STRANGE_MATERIAL,
      ...Array(90).fill(""),
    ],
    bankCounts: [0, 12, 4, 5, ...Array(90).fill(0)],
  };
  identifyEssence(player);
  expect(
    player.inventory.map((item, slot) => [item, player.inventoryCounts[slot]]),
  ).toEqual([
    [RUNE_ESSENCE, 20],
    ["copperOre", 5],
    [RUNE_ESSENCE, 1],
    ["", 0],
    [RUNE_ESSENCE, 3],
  ]);
  expect(player.bank.slice(0, 5)).toEqual([
    "",
    RUNE_ESSENCE,
    "tin",
    RUNE_ESSENCE,
    "",
  ]);
  expect(player.bankCounts.slice(0, 5)).toEqual([0, 12, 4, 5, 0]);
});

test("the four elemental runes are the whole rune list, gates lowest first", () => {
  expect(RUNES).toEqual(["airRune", "waterRune", "earthRune", "fireRune"]);
});
