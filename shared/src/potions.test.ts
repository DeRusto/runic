import { AVOIDANCE_TENTHS_PER_POINT } from "./gear.ts";
import { BUSHES } from "./herblaw.ts";
import { INVENTORY_SLOTS, EMPTY_SLOT, xpForLevel } from "./index.ts";
import {
  AVOIDANCE_POTION_POINTS,
  FORTITUDE_POTION_PERCENT,
  mixRefusal,
  MIGHT_POTION_HIT,
  potionFromPlant,
  potionOf,
  POTIONS,
  POTION_BUFF_TICKS,
} from "./potions.ts";
import { describe, expect, it, test } from "vitest";

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

/** A player with Herblaw `level` and these stacks. */
const mixer = (level: number, ...stacks: [string, number][]) => ({
  herblawXp: xpForLevel(level),
  ...holding(...stacks),
});

describe("POTIONS", () => {
  it.each([
    ["mightPotion", "might", "dewpetal", 5],
    ["fortitudePotion", "fortitude", "nightbloom", 15],
    ["avoidancePotion", "avoidance", "emberbloom", 20],
  ] as const)(
    "%s carries %s, mixed from %s at Herblaw %i",
    (potion, virtue, plant, level) => {
      expect(POTIONS[potion]).toEqual({ virtue, plant, level });
      expect(POTIONS[potion].level).toBe(BUSHES[`${plant}Bush`].level);
      expect(potionFromPlant(plant)).toBe(potion);
      expect(potionOf(potion)).toBe(potion);
    },
  );

  it("leaves the base herb out: the range cooks it, nothing mixes it (#222)", () => {
    expect(potionFromPlant("herb")).toBeUndefined();
    expect(potionOf("herb")).toBeUndefined();
  });

  test("the buff runs two minutes, and its sizes are whole points of their units (#222)", () => {
    expect(POTION_BUFF_TICKS).toBe(400);
    expect(MIGHT_POTION_HIT).toBe(100);
    expect(FORTITUDE_POTION_PERCENT).toBe(25);
    // A whole point: 10 tenths of gear.ts's Avoidance scale.
    expect(AVOIDANCE_POTION_POINTS * AVOIDANCE_TENTHS_PER_POINT).toBe(10);
  });
});

describe("mixRefusal", () => {
  test("a plant's pick gate gates it, as the making panel reads the level", () => {
    const player = mixer(4, ["vial", 1], ["dewpetal", 1]);
    expect(mixRefusal("mightPotion", player)).toBe("Needs Herblaw 5");
    expect(
      mixRefusal("mightPotion", { ...player, herblawXp: xpForLevel(5) }),
    ).toBeUndefined();
  });

  test("the vial or the plant missing is not enough materials", () => {
    const player = { herblawXp: xpForLevel(5), ...holding(["dewpetal", 1]) };
    expect(mixRefusal("mightPotion", player)).toBe("Not enough materials");
    expect(
      mixRefusal("mightPotion", {
        herblawXp: xpForLevel(5),
        ...holding(["vial", 1]),
      }),
    ).toBe("Not enough materials");
  });

  test("a full inventory refuses unless the mixing frees a slot", () => {
    const full = Array.from(
      { length: INVENTORY_SLOTS - 2 },
      () => ["berry", 20] as [string, number],
    );
    // Stacks of both costs keep their slots, so no room opens for the potion.
    const noRoom = {
      herblawXp: xpForLevel(5),
      ...holding(...full, ["vial", 2], ["dewpetal", 2]),
    };
    expect(mixRefusal("mightPotion", noRoom)).toBe("Your inventory is full.");
    // A lone plant frees its slot, so the potion takes it.
    const frees = [...full];
    frees[0] = ["dewpetal", 1];
    const player = {
      herblawXp: xpForLevel(5),
      ...holding(...frees, ["vial", 1]),
    };
    expect(mixRefusal("mightPotion", player)).toBeUndefined();
  });

  test("a lone vial can also free the last slot", () => {
    const stacks = Array.from(
      { length: INVENTORY_SLOTS - 1 },
      () => ["berry", 20] as [string, number],
    );
    stacks[0] = ["vial", 1];
    const player = {
      herblawXp: xpForLevel(15),
      ...holding(...stacks, ["nightbloom", 2]),
    };
    expect(mixRefusal("fortitudePotion", player)).toBeUndefined();
  });
});
