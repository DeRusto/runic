import { describe, expect, test } from "vitest";
import { EMPTY_SLOT, INVENTORY_SLOTS } from "./index.ts";
import { ITEMS, slotFor } from "./items.ts";

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
    expect(ITEMS.ironSword.stack).toBe(1);
    expect(ITEMS.emberiteShield.stack).toBe(1);
  });

  test("every tier has its ore, bar, sword and shield", () => {
    // Food 2, Emberbone 1, then four per tier.
    expect(Object.keys(ITEMS)).toHaveLength(15);
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
