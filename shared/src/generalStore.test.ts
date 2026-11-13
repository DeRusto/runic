import { describe, expect, test } from "vitest";
import { EMPTY_SLOT, INVENTORY_SLOTS } from "./index.ts";
import { COINS, ITEMS } from "./items.ts";
import {
  dealRefusal,
  dealTotals,
  storePaysFor,
  valueOf,
  type Deal,
} from "./generalStore.ts";

describe("value", () => {
  test("a raw item has its hand-set value, the cheapest sellable one 3", () => {
    expect(valueOf("berry")).toBe(3);
    expect(valueOf("copperOre")).toBe(3);
    expect(valueOf("ironOre")).toBe(8);
  });

  test("a bar is worth its ores, and gear its bars", () => {
    expect(valueOf("bronzeBar")).toBe(6);
    expect(valueOf("steelBar")).toBe(12);
    expect(valueOf("bronzeChestplate")).toBe(30);
  });

  test("the crafted utilities are worth their materials (#225)", () => {
    expect(valueOf("spiderSilk")).toBe(10);
    expect(valueOf("rope")).toBe(20);
    expect(valueOf("torch")).toBe(23); // Two silk's rope plus a birch log.
    expect(valueOf("vial")).toBe(3); // The store's value stays the low-level one.
  });

  test("a cape has a hand-set value by tier, and a gossamer cloak is its cape plus the silk (#217)", () => {
    expect(valueOf("copperMightCape")).toBe(20);
    expect(valueOf("emberiteFortitudeCape")).toBe(90);
    expect(valueOf("copperMightCape:gossamer")).toBe(30);
    expect(valueOf("copperMightCape:uncommon:fortitude:gossamer")).toBe(50);
    expect(valueOf("bronzeFortitudeCape:gossamer")).toBe(45);
  });

  test("uncommon is worth twice its common version, and rare four times", () => {
    expect(valueOf("ironSword")).toBe(24);
    expect(valueOf("ironSword:uncommon:might")).toBe(48);
    expect(valueOf("ironSword:rare:fortitude")).toBe(96);
  });

  test("every item but coins has a value, and an item with none is an error, not trash", () => {
    for (const item of Object.keys(ITEMS))
      if (item !== COINS) expect(valueOf(item)).toBeGreaterThan(0);
    expect(valueOf(COINS)).toBe(0);
    expect(() => valueOf("mysteryOre")).toThrow("mysteryOre");
  });

  test("the store pays 40% of value rounded down, never under 1 coin, and nothing for trash", () => {
    expect(storePaysFor(valueOf("ironSword"))).toBe(9);
    expect(storePaysFor(valueOf("berry"))).toBe(1);
    expect(storePaysFor(1)).toBe(1);
    expect(storePaysFor(0)).toBe(0);
  });
});

/** An inventory from `[item, count]` pairs, the rest empty. */
const inventoryOf = (...held: [string, number][]) => ({
  inventory: [
    ...held.map(([item]) => item),
    ...Array<string>(INVENTORY_SLOTS - held.length).fill(EMPTY_SLOT),
  ],
  inventoryCounts: [
    ...held.map(([, count]) => count),
    ...Array<number>(INVENTORY_SLOTS - held.length).fill(0),
  ],
});
const SHELF = { shelf: ["berry", "copperOre"], shelfCounts: [20, 5] };
const deal = (deal: Partial<Deal>): Deal => ({ buy: [], sell: [], ...deal });

describe("a deal", () => {
  test("adds up what the player pays and gets, a sale of several paying the one-item price times the count", () => {
    expect(
      dealTotals(
        deal({
          buy: [{ item: "berry", count: 2 }],
          sell: [{ item: "ironSword", count: 3 }],
        }),
      ),
    ).toEqual({ pay: 6, get: 27 });
  });

  test("can buy with the coins its own sales bring", () => {
    const player = inventoryOf(["copperOre", 5]);
    const sellAndBuy = deal({
      sell: [{ item: "copperOre", count: 5 }],
      buy: [{ item: "berry", count: 1 }],
    });
    expect(dealRefusal(sellAndBuy, player, SHELF)).toBeUndefined();
  });

  test("is refused for want of coins, saying how many more", () => {
    const player = inventoryOf([COINS, 4]);
    expect(
      dealRefusal(deal({ buy: [{ item: "berry", count: 2 }] }), player, SHELF),
    ).toBe("You need 2 more coins.");
    expect(
      dealRefusal(
        deal({ buy: [{ item: "berry", count: 2 }] }),
        inventoryOf([COINS, 5]),
        SHELF,
      ),
    ).toBe("You need 1 more coin.");
  });

  test("is refused when what it buys won't fit", () => {
    const full = inventoryOf(
      [COINS, 100],
      ...Array<[string, number]>(INVENTORY_SLOTS - 1).fill(["tin", 20]),
    );
    expect(
      dealRefusal(deal({ buy: [{ item: "berry", count: 1 }] }), full, SHELF),
    ).toBe("You don't have room for all that.");
  });

  test("is refused for coins on the sell tray, or more than the player holds", () => {
    const player = inventoryOf([COINS, 10], ["tin", 2]);
    expect(
      dealRefusal(deal({ sell: [{ item: COINS, count: 1 }] }), player, SHELF),
    ).toBe("The store doesn't buy coins.");
    expect(
      dealRefusal(deal({ sell: [{ item: "tin", count: 3 }] }), player, SHELF),
    ).toBe("You don't have that many to sell.");
  });

  test("is refused when the shelf no longer has what it buys", () => {
    const player = inventoryOf([COINS, 100]);
    expect(
      dealRefusal(
        deal({ buy: [{ item: "copperOre", count: 6 }] }),
        player,
        SHELF,
      ),
    ).toBe("The store doesn't have that many left.");
  });
});
