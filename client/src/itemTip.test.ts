import { xpForLevel } from "@runic/shared";
import { describe, expect, test } from "vitest";
import { itemTip, recipeTip } from "./itemTip.ts";

const player = (defenseLevel: number, smithingLevel = 1) => ({
  combatXp: 0,
  defenseXp: xpForLevel(defenseLevel),
  miningXp: 0,
  smithingXp: xpForLevel(smithingLevel),
  cookingXp: 0,
  inventory: ["copperBar", ""],
  inventoryCounts: [5, 0],
});

describe("an item's tip (spec §5)", () => {
  test("a common piece gives its slot, gate and base stat", () => {
    expect(itemTip("bronzeShield")).toEqual({
      name: "Bronze shield",
      quality: "common",
      kind: "Shield, needs Defense 5",
      stats: ["Starts at a 15% chance to block a hit."],
      virtue: undefined,
      refusal: undefined,
    });
  });

  test("an improved piece adds its Virtue line", () => {
    expect(itemTip("copperChestplate:uncommon:fortitude")).toEqual({
      name: "Copper chestplate of Fortitude",
      quality: "uncommon",
      kind: "Body armour, needs Defense 1",
      stats: ["Takes 4% off each hit you take."],
      virtue: "Adds 20 to your max health.",
      refusal: undefined,
    });
  });

  test("a locked piece ends with its refusal", () => {
    expect(itemTip("steelHelmet", player(9)).refusal).toBe(
      "You need Defense 15 to equip this.",
    );
    expect(itemTip("steelHelmet", player(15)).refusal).toBeUndefined();
  });

  test("a material, a gem and a tool name only their kind", () => {
    expect(itemTip("copperOre")).toMatchObject({
      kind: "Material",
      stats: [],
    });
    expect(itemTip("heartflame").kind).toBe("Gem");
    expect(itemTip("pickaxe")).toMatchObject({ name: "Pickaxe", kind: "Tool" });
  });

  test("food gives its total healing and its ticks", () => {
    expect(itemTip("berry")).toMatchObject({
      kind: "Food, heals 100 over 4 ticks",
      stats: [],
    });
    expect(itemTip("cookedPike")).toMatchObject({
      kind: "Food, heals 2000 over 4 ticks",
      stats: [],
    });
  });

  test("a Delicious fish's name is coloured by it, and its line promises the extra healing (#221)", () => {
    expect(itemTip("cookedTrout:delicious")).toEqual({
      name: "Cooked trout",
      quality: "delicious",
      kind: "Food, heals 1200 over 4 ticks",
      stats: ["Delicious: an extra healing tick for 60 seconds."],
      virtue: undefined,
      refusal: undefined,
    });
  });

  test("a potion is one, and its line says what drinking it does for two minutes (#222)", () => {
    expect(itemTip("mightPotion")).toEqual({
      name: "Might potion",
      quality: "common",
      kind: "Potion",
      stats: ["Drink: +100 to your hit for 2 minutes."],
      virtue: undefined,
      refusal: undefined,
    });
    expect(itemTip("fortitudePotion").stats).toEqual([
      "Drink: +25% max health for 2 minutes.",
    ]);
    expect(itemTip("avoidancePotion").stats).toEqual([
      "Drink: +1 to your Avoidance for 2 minutes.",
    ]);
  });

  test("a potion plant and the vial stay materials (#222)", () => {
    expect(itemTip("dewpetal").kind).toBe("Material");
    expect(itemTip("vial").kind).toBe("Material");
  });
});

describe("a smithing recipe's tip (spec §5)", () => {
  test("gives what it makes, its materials and experience, then any refusal", () => {
    expect(recipeTip("copperSword", player(1))).toEqual({
      name: "Copper sword",
      quality: "common",
      kind: "Weapon, needs Combat 1",
      stats: [
        "Adds 100 to your minimum and maximum hit.",
        "3 Copper bar (have 5)",
        "18 Smithing experience",
      ],
      virtue: undefined,
      refusal: undefined,
    });
  });

  test("ends with the refusal when the player can't make it", () => {
    expect(recipeTip("ironSword", player(1)).refusal).toBe("Needs Smithing 10");
  });
});
