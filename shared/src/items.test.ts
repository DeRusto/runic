import { describe, expect, test } from "vitest";
import { EMPTY_SLOT, INVENTORY_SLOTS, RUNES } from "./index.ts";
import {
  itemName,
  itemParts,
  itemTag,
  ITEMS,
  slotFor,
  takeRefusal,
} from "./items.ts";

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

  test("the potion plants, the vial and the potions all stack to 20 (#222)", () => {
    expect(ITEMS.dewpetal.stack).toBe(20);
    expect(ITEMS.nightbloom.stack).toBe(20);
    expect(ITEMS.emberbloom.stack).toBe(20);
    expect(ITEMS.vial.stack).toBe(20);
    expect(ITEMS.mightPotion.stack).toBe(20);
    expect(ITEMS.fortitudePotion.stack).toBe(20);
    expect(ITEMS.avoidancePotion.stack).toBe(20);
  });

  test("every tier has its bar, sword, shield, helmet, chestplate, leggings, cape, gloves, boots, amulet and ring, and its ore if it has veins", () => {
    // Food 10, Emberbone 1, finds 5, #232's essence two and the four runes, seven per tier
    // (the capes three), three ores, three logs, three raw fish, the three plants, the vial,
    // the three potions, the silk, the rope and torch, the three hides (#238), and coins
    // (#217, #222, #225), plus Fletching's twenty: a shaft, a feather, five arrowheads, five
    // arrows, five knives, three bows (#228).
    expect(Object.keys(ITEMS)).toHaveLength(131);
  });

  test("the hides stack to 20, and a hands, feet, neck or ring piece takes a whole slot (#238)", () => {
    expect(ITEMS.tarnHide.stack).toBe(20);
    expect(ITEMS.bristleHide.stack).toBe(20);
    expect(ITEMS.cinderHide.stack).toBe(20);
    expect(ITEMS.copperGloves.stack).toBe(1);
    expect(ITEMS.emberiteBoots.stack).toBe(1);
    expect(ITEMS.steelAmulet.stack).toBe(1);
    expect(ITEMS.bronzeRing.stack).toBe(1);
  });

  test("the essence find and the runes stack to 20 (#232)", () => {
    expect(ITEMS.strangeMaterial.stack).toBe(20);
    expect(ITEMS.runeEssence.stack).toBe(20);
    for (const rune of RUNES) expect(ITEMS[rune].stack).toBe(20);
  });

  test("the silk, the rope and the torch stack to 20, and a cape takes a whole slot (#225)", () => {
    expect(ITEMS.spiderSilk.stack).toBe(20);
    expect(ITEMS.rope.stack).toBe(20);
    expect(ITEMS.torch.stack).toBe(20);
    expect(ITEMS.copperMightCape.stack).toBe(1);
    expect(ITEMS.emberiteAvoidanceCape.stack).toBe(1);
  });

  test("Fletching's shafts, arrowheads, arrows and throwing knives stack to 20, and a bow takes a whole slot (#228)", () => {
    expect(ITEMS.arrowShaft.stack).toBe(20);
    expect(ITEMS.feather.stack).toBe(20);
    expect(ITEMS.copperArrowhead.stack).toBe(20);
    expect(ITEMS.emberiteArrowhead.stack).toBe(20);
    expect(ITEMS.copperArrow.stack).toBe(20);
    expect(ITEMS.emberiteArrow.stack).toBe(20);
    expect(ITEMS.copperThrowingKnife.stack).toBe(20);
    expect(ITEMS.emberiteThrowingKnife.stack).toBe(20);
    expect(ITEMS.birchBow.stack).toBe(1);
    expect(ITEMS.charwoodBow.stack).toBe(1);
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

  test("a Delicious food's suffix is a Quality with no Virtue (#221)", () => {
    expect(itemParts("cookedPerch:delicious")).toEqual({
      base: "cookedPerch",
      quality: "delicious",
      virtue: undefined,
    });
    expect(itemParts("cookedPerch:delicious").base).toBe("cookedPerch");
  });

  test("an improved piece stacks to 1, like its common form", () => {
    const item = "copperSword:uncommon:fortitude";
    expect(slotFor(item, holding([item, 1]))).toBe(1);
  });
});

describe("an item's name", () => {
  test.each([
    ["berry", "Berry"],
    ["emberbone", "Emberbone"],
    ["copperOre", "Copper ore"],
    ["emberiteShield", "Emberite shield"],
    ["arrowShaft", "Arrow shaft"],
    ["copperThrowingKnife", "Copper throwing knife"],
    ["copperChestplate:uncommon:fortitude", "Copper chestplate of Fortitude"],
    ["ironSword:rare:might", "Iron sword of Might"],
  ])("%s reads as %s", (id, name) => {
    expect(itemName(id)).toBe(name);
  });

  test("a gossamer cloak leads with its variant, and keeps its cape's (#217, #225)", () => {
    expect(itemName("copperMightCape:gossamer")).toBe(
      "Gossamer copper might cape",
    );
    expect(itemName("copperMightCape:uncommon:might:gossamer")).toBe(
      "Gossamer copper might cape of Might",
    );
  });
});

test("the chat names an item by its name in square brackets", () => {
  expect(itemTag("copperOre")).toBe("[Copper ore]");
  expect(itemTag("ironSword:rare:might")).toBe("[Iron sword of Might]");
});
