import { describe, expect, test } from "vitest";
import { EMPTY_SLOT, INVENTORY_SLOTS } from "./index.ts";
import { itemParts, ITEMS, slotFor, takeRefusal } from "./items.ts";

/** A whole inventory from the first slots given, as [item, count] pairs. */
function holding(...stacks: [string, number][]) {
  const inventory = Array<string>(INVENTORY_SLOTS).fill(EMPTY_SLOT);
  const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
  stacks.forEach(([item, count], i) => {
    inventory[i] = item;
    inventoryCounts[i] = count;
  });
  return { inventory, inventoryCounts };
}

describe("ITEMS", () => {
  test("berry and herb keep their ids, because existing saves hold them", () => {
    expect(ITEMS.berry.stack).toBe(20);
    expect(ITEMS.herb.stack).toBe(20);
  });

  test("materials stack to 20 and gear takes a whole slot", () => {
    expect(ITEMS.copperOre.stack).toBe(20);
    expect(ITEMS.emberiteBar.stack).toBe(20);
    expect(ITEMS.emberbone.stack).toBe(20);
    expect(ITEMS.tin.stack).toBe(20);
    expect(ITEMS.coal.stack).toBe(20);
    expect(ITEMS.ashstone.stack).toBe(20);
    expect(ITEMS.cinderglass.stack).toBe(20);
    expect(ITEMS.heartflame.stack).toBe(20);
    expect(ITEMS.ironSword.stack).toBe(1);
    expect(ITEMS.emberiteShield.stack).toBe(1);
  });

  test("every tier has its bar, sword, shield, helmet, chestplate and leggings, and its ore if it has veins", () => {
    // Food 2, Emberbone 1, finds 5, six per tier, three ores and coins.
    expect(Object.keys(ITEMS)).toHaveLength(42);
  });
});

describe("slotFor", () => {
  test("an empty inventory takes the first slot", () => {
    expect(slotFor("berry", holding())).toBe(0);
  });

  test("a new item tops up the first stack of that item with room", () => {
    expect(
      slotFor("berry", holding(["herb", 3], ["berry", 20], ["berry", 4])),
    ).toBe(2);
  });

  test("with no stack with room, it takes the first empty slot", () => {
    expect(slotFor("berry", holding(["berry", 20], ["herb", 1]))).toBe(2);
  });

  test("each item stacks separately", () => {
    expect(slotFor("herb", holding(["berry", 1]))).toBe(1);
  });

  test("gear never tops up, even with one already held", () => {
    expect(slotFor("copperSword", holding(["copperSword", 1]))).toBe(1);
  });

  test("full means no room in a matching stack and no empty slot", () => {
    const full = Array.from(
      { length: INVENTORY_SLOTS },
      () => ["berry", 20] as [string, number],
    );
    expect(slotFor("berry", holding(...full))).toBe(-1);
    expect(slotFor("herb", holding(...full))).toBe(-1);
  });

  test("a full inventory with room in a matching stack isn't full for that item", () => {
    const stacks = Array.from(
      { length: INVENTORY_SLOTS },
      () => ["berry", 20] as [string, number],
    );
    stacks[7] = ["herb", 19];
    expect(slotFor("herb", holding(...stacks))).toBe(7);
    expect(slotFor("berry", holding(...stacks))).toBe(-1);
  });
});

describe("takeRefusal", () => {
  test("a ground item is refused only when not even one of it fits", () => {
    const stacks = Array.from(
      { length: INVENTORY_SLOTS },
      () => ["berry", 20] as [string, number],
    );
    expect(takeRefusal("berry", holding(...stacks))).toBe(
      "Your inventory is full.",
    );
    stacks[3] = ["berry", 19];
    expect(takeRefusal("berry", holding(...stacks))).toBeUndefined();
  });
});

describe("an item id's parts (ADR 0004)", () => {
  test("a plain id is a common item with no Virtue", () => {
    expect(itemParts("copperChestplate")).toEqual({
      base: "copperChestplate",
      quality: "common",
      virtue: undefined,
    });
  });

  test("a compound id splits into its base id, Quality and Virtue", () => {
    expect(itemParts("emberiteSword:rare:might")).toEqual({
      base: "emberiteSword",
      quality: "rare",
      virtue: "might",
    });
  });

  test("an improved piece stacks to 1, like its common form", () => {
    const item = "copperSword:uncommon:fortitude";
    expect(slotFor(item, holding([item, 1]))).toBe(1);
  });
});
