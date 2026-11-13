import { describe, expect, test } from "vitest";
import { xpForLevel } from "./skills.ts";
import {
  avoidanceOf,
  blockOf,
  enemyHitChance,
  hitOf,
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
});

describe("an enemy's chance to hit", () => {
  test("is its base chance at no Avoidance, as before", () => {
    expect(enemyHitChance("spider", 0)).toBe(0.35);
    expect(enemyHitChance("skeleton", 0)).toBe(0.55);
  });

  test("loses one percentage point per Avoidance point", () => {
    expect(enemyHitChance("spider", 10)).toBeCloseTo(0.25);
  });

  test("never goes below 5%, so nothing is unhittable", () => {
    expect(enemyHitChance("spider", 34)).toBe(0.05);
    expect(enemyHitChance("skeleton", 99)).toBe(0.05);
  });
});

describe("a player's hit", () => {
  test("at Combat 11 with an Emberite sword: 45% to land, 100 to 200 from skill, 300 from gear", () => {
    expect(
      hitOf({ combatXp: xpForLevel(11), weapon: "emberiteSword" }),
    ).toEqual({ chance: 0.45, min: 100, max: 200, gear: 300 });
  });

  test("Might adds to the gear part, and every 20 Combat levels to the max", () => {
    expect(
      hitOf({
        combatXp: xpForLevel(20),
        weapon: "copperSword",
        body: "copperChestplate:rare:might",
      }),
    ).toMatchObject({ max: 300, gear: 106 });
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
