import { describe, expect, test } from "vitest";
import { xpForLevel } from "./skills.ts";
import {
  avoidanceOf,
  blockOf,
  enemyHitChance,
  hitOf,
  landChanceOf,
  maxHealthOf,
} from "./stats.ts";

test("max health is the Hitpoints level × 100 from skill, and worn Fortitude from gear", () => {
  expect(
    maxHealthOf({
      hitpointsXp: xpForLevel(10),
      body: "copperChestplate:rare:fortitude",
    }),
  ).toEqual({ skill: 1000, gear: 40 });
});

describe("Avoidance", () => {
  test("Defense gives a quarter point per level above 1, and gear its Avoidance in points", () => {
    expect(
      avoidanceOf({
        defenseXp: xpForLevel(12),
        head: "copperHelmet:uncommon:avoidance",
      }),
    ).toEqual({ skill: 2.75, gear: 0.1 });
  });

  test("a fresh player with no gear has none", () => {
    expect(avoidanceOf({ defenseXp: 0 })).toEqual({ skill: 0, gear: 0 });
  });

  test("a worn gossamer cloak adds its 0.2 points on top of its cape's (#217)", () => {
    // The uncommon cape's own Avoidance Virtue is 0.1 point at Copper, and the cloak adds 0.2.
    expect(
      avoidanceOf({
        defenseXp: 0,
        cape: "copperAvoidanceCape:uncommon:avoidance:gossamer",
      }).gear,
    ).toBe(0.3);
    expect(
      avoidanceOf({ defenseXp: 0, cape: "copperAvoidanceCape:gossamer" }).gear,
    ).toBe(0.2);
    expect(
      avoidanceOf({ defenseXp: 0, cape: "copperAvoidanceCape" }).gear,
    ).toBe(0);
  });

  test("a worn amulet's Avoidance is its own stat, in tenths (#238)", () => {
    expect(avoidanceOf({ defenseXp: 0, neck: "copperAmulet" }).gear).toBe(0.5);
    expect(
      avoidanceOf({
        defenseXp: xpForLevel(12),
        neck: "emberiteAmulet",
      }),
    ).toEqual({ skill: 2.75, gear: 1.6 });
  });
});

describe("an enemy's chance to hit", () => {
  test("is its base chance at no Avoidance, as before", () => {
    expect(enemyHitChance("spider", 0, "melee")).toBe(0.35);
    expect(enemyHitChance("skeleton", 0, "melee")).toBe(0.55);
  });

  test("loses one percentage point per Avoidance point", () => {
    expect(enemyHitChance("spider", 10, "melee")).toBeCloseTo(0.25);
  });

  test("never goes below 5%, so nothing is unhittable", () => {
    expect(enemyHitChance("spider", 34, "melee")).toBe(0.05);
    expect(enemyHitChance("skeleton", 99, "melee")).toBe(0.05);
  });
});

describe("the combat triangle on a chance to hit (#271)", () => {
  test("a melee enemy hits a ranged player 10 points more often", () => {
    expect(enemyHitChance("spider", 0, "ranged")).toBeCloseTo(0.45);
  });

  test("a ranged enemy loses 10 points against melee and keeps its chance against ranged", () => {
    expect(enemyHitChance("skeletonMage", 0, "melee")).toBeCloseTo(0.6);
    expect(enemyHitChance("skeletonMage", 0, "ranged")).toBeCloseTo(0.7);
  });

  test("keeps an enemy's 5% floor and never goes past a whole chance", () => {
    expect(enemyHitChance("spider", 54, "ranged")).toBe(0.05);
    expect(enemyHitChance("skeleton", 99, "ranged")).toBe(0.05);
    // No Avoidance is below 0 today; this pins the top of the scale.
    expect(enemyHitChance("skeletonMage", -100, "ranged")).toBe(1);
  });

  test("a player's chance to land stays between none and a whole chance", () => {
    expect(landChanceOf(0.5, "ranged", "melee")).toBeCloseTo(0.4);
    expect(landChanceOf(0.5, "melee", "ranged")).toBeCloseTo(0.6);
    expect(landChanceOf(0.5, "melee", "melee")).toBe(0.5);
    // Ranged 99 with a charwood bow and an emberite ring is past 100% already.
    expect(landChanceOf(1.2, "ranged", "magic")).toBe(1);
    expect(landChanceOf(0.05, "ranged", "melee")).toBe(0);
  });
});

describe("a player's hit", () => {
  test("at Attack 11 and Strength 1 with an Emberite sword: 45% to land, 100 to 200 from skill, 300 from gear", () => {
    expect(
      hitOf({
        attackXp: xpForLevel(11),
        strengthXp: 0,
        weapon: "emberiteSword",
      }),
    ).toEqual({ chance: 0.45, min: 100, max: 200, gear: 300 });
  });

  test("Attack alone raises the chance to land and leaves the max hit", () => {
    expect(hitOf({ attackXp: xpForLevel(99), strengthXp: 0 })).toEqual({
      chance: 0.89,
      min: 100,
      max: 200,
      gear: 0,
    });
  });

  test("Strength alone raises the max hit, 100 each 20 levels, and leaves the chance to land", () => {
    expect(hitOf({ attackXp: 0, strengthXp: xpForLevel(19) })).toMatchObject({
      chance: 0.4,
      max: 200,
    });
    expect(hitOf({ attackXp: 0, strengthXp: xpForLevel(20) })).toMatchObject({
      chance: 0.4,
      max: 300,
    });
    expect(hitOf({ attackXp: 0, strengthXp: xpForLevel(99) })).toMatchObject({
      chance: 0.4,
      max: 600,
    });
  });

  test("Might adds to the gear part", () => {
    expect(
      hitOf({
        attackXp: 0,
        strengthXp: xpForLevel(20),
        weapon: "copperSword",
        body: "copperChestplate:rare:might",
      }),
    ).toMatchObject({ max: 300, gear: 106 });
  });

  test("a worn ring's Accuracy adds a percentage point a point (#238)", () => {
    const attack11 = { attackXp: xpForLevel(11), strengthXp: 0 };
    expect(hitOf({ ...attack11, ring: "copperRing" }).chance).toBe(0.5);
    expect(hitOf({ ...attack11, ring: "emberiteRing" }).chance).toBe(0.61);
  });
});

describe("block chance", () => {
  test("is the shield's base plus 0.2 points per Blocking level above 1", () => {
    const block = blockOf({
      blockingXp: xpForLevel(11),
      shield: "copperShield",
    });
    expect(block?.shield).toBe(0.1);
    expect(block?.skill).toBeCloseTo(0.02);
  });

  test("is undefined with no shield", () => {
    expect(blockOf({ blockingXp: xpForLevel(50) })).toBeUndefined();
  });
});
