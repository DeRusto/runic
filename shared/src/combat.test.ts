import { describe, expect, test, vi } from "vitest";
import { enemyHit, playerHit, rollLoot } from "./combat.ts";
import { ENEMIES } from "./enemies.ts";
import { BLOCKING_XP_PER_BLOCK } from "./index.ts";
import { MAX_XP } from "./skills.ts";
import type { Style } from "./triangle.ts";

/** Hands out these rolls in order, then fails the test if asked for more. */
const rolls = (...values: number[]) =>
  vi.fn(() => {
    if (!values.length) throw new Error("rolled too often");
    return values.shift()!;
  });

const fresh = {
  agilityXp: 0,
  attackXp: 0,
  strengthXp: 0,
  defenseXp: 0,
  blockingXp: 0,
  health: 1000,
};

describe("playerHit", () => {
  test.each([
    [0, 0.1],
    [MAX_XP, 0.198],
  ])(
    "Agility experience %i gives a critical chance of %f",
    (agilityXp, threshold) => {
      const swing = (roll: number) =>
        playerHit(
          { ...fresh, agilityXp },
          "balanced",
          "melee",
          0,
          800,
          rolls(0, 0, roll),
        );
      expect(swing(threshold - 0.00001)).toMatchObject({
        damage: 150,
        critical: true,
      });
      expect(swing(threshold)).toMatchObject({ damage: 100, critical: false });
    },
  );

  test("a miss rolls once and does nothing", () => {
    expect(playerHit(fresh, "balanced", "melee", 0, 800, rolls(0.99))).toEqual({
      damage: 0,
      critical: false,
      xp: [
        ["attackXp", 0],
        ["strengthXp", 0],
        ["hitpointsXp", 0],
      ],
    });
  });

  test("a hit rolls its damage and then a critical, and a Might potion adds to it (#222)", () => {
    expect(
      playerHit(fresh, "balanced", "melee", 0, 800, rolls(0, 0, 0.99)).damage,
    ).toBe(100);
    expect(
      playerHit(fresh, "balanced", "melee", 100, 800, rolls(0, 0, 0.99)).damage,
    ).toBe(200);
    expect(
      playerHit(fresh, "balanced", "melee", 0, 800, rolls(0, 0, 0)),
    ).toMatchObject({
      damage: 150,
      critical: true,
    });
  });

  test("damage and its experience stop at the enemy's health", () => {
    expect(
      playerHit(fresh, "balanced", "melee", 0, 50, rolls(0, 0, 0.99)),
    ).toEqual({
      damage: 50,
      critical: false,
      xp: [
        ["attackXp", 2],
        ["strengthXp", 1],
        ["hitpointsXp", 3],
      ],
    });
  });

  test("the stance decides where the melee experience goes; Hitpoints gets its share either way", () => {
    expect(
      playerHit(fresh, "precise", "melee", 0, 800, rolls(0, 0, 0.99)).xp,
    ).toEqual([
      ["attackXp", 6],
      ["strengthXp", 0],
      ["hitpointsXp", 6],
    ]);
    expect(
      playerHit(fresh, "forceful", "melee", 0, 800, rolls(0, 0, 0.99)).xp,
    ).toEqual([
      ["attackXp", 0],
      ["strengthXp", 6],
      ["hitpointsXp", 6],
    ]);
  });

  test("Attack raises the chance to land: a roll that misses at Attack 1 lands at Attack 99", () => {
    // 40% at Attack 1, 89% at Attack 99.
    expect(
      playerHit(fresh, "balanced", "melee", 0, 800, rolls(0.5)).damage,
    ).toBe(0);
    const attacker = { ...fresh, attackXp: MAX_XP };
    expect(
      playerHit(attacker, "balanced", "melee", 0, 800, rolls(0.5, 0, 0.99))
        .damage,
    ).toBe(100);
    // Strength doesn't help it land.
    const striker = { ...fresh, strengthXp: MAX_XP };
    expect(
      playerHit(striker, "balanced", "melee", 0, 800, rolls(0.5)).damage,
    ).toBe(0);
  });

  test("Strength raises the max hit: the top damage roll deals 200 at Strength 1 and 600 at Strength 99", () => {
    expect(
      playerHit(fresh, "balanced", "melee", 0, 800, rolls(0, 0.999, 0.99))
        .damage,
    ).toBe(200);
    const striker = { ...fresh, strengthXp: MAX_XP };
    expect(
      playerHit(striker, "balanced", "melee", 0, 800, rolls(0, 0.999, 0.99))
        .damage,
    ).toBe(600);
    // Attack doesn't raise it.
    const attacker = { ...fresh, attackXp: MAX_XP };
    expect(
      playerHit(attacker, "balanced", "melee", 0, 800, rolls(0, 0.999, 0.99))
        .damage,
    ).toBe(200);
  });
});

describe("enemyHit", () => {
  test("a miss rolls once, still pays Defense, and leaves a window open", () => {
    expect(enemyHit("spider", fresh, 0, rolls(0.99))).toEqual({
      damage: 0,
      blocked: false,
      hit: false,
      xp: [["defenseXp", 6]],
    });
  });

  test("an Avoidance potion's points come off the enemy's chance to hit (#222)", () => {
    // A Spider hits 35% of the time; one point takes it to 34%.
    expect(enemyHit("spider", fresh, 0, rolls(0.345, 0)).hit).toBe(true);
    expect(enemyHit("spider", fresh, 1, rolls(0.345)).hit).toBe(false);
  });

  test("a hit with no shield takes no block roll and is capped at the player's health", () => {
    expect(
      enemyHit("spider", { ...fresh, health: 40 }, 0, rolls(0, 0.99)),
    ).toEqual({
      damage: 40,
      blocked: false,
      hit: true,
      xp: [["defenseXp", 8]],
    });
  });

  test("a blocked hit lands nothing and pays Blocking first", () => {
    const shielded = { ...fresh, shield: "copperShield" };
    expect(enemyHit("spider", shielded, 0, rolls(0, 0.5, 0))).toEqual({
      damage: 0,
      blocked: true,
      hit: true,
      xp: [
        ["blockingXp", BLOCKING_XP_PER_BLOCK],
        ["defenseXp", 6],
      ],
    });
  });
});

describe("the combat triangle (#271)", () => {
  test("a melee swing lands as often on a melee target, 10 points more often on a ranged one and 10 less on a magic one", () => {
    // 40% at Attack 1: 50% on a ranged target, 30% on a magic one.
    const swing = (target: Style, roll: number) =>
      playerHit(fresh, "balanced", target, 0, 800, rolls(roll, 0, 0.99)).damage;
    expect(swing("melee", 0.3999)).toBe(100);
    expect(swing("melee", 0.4001)).toBe(0);
    expect(swing("ranged", 0.4999)).toBe(100);
    expect(swing("ranged", 0.5001)).toBe(0);
    expect(swing("magic", 0.2999)).toBe(100);
    expect(swing("magic", 0.3001)).toBe(0);
  });

  test("a melee enemy hits a player with a bow or knives 10 points more often, and one with a sword or bare hands as before", () => {
    // A Spider hits 35% of the time, 45% against a ranged player.
    for (const weapon of ["birchBow", "copperThrowingKnife"]) {
      const archer = { ...fresh, weapon };
      expect(enemyHit("spider", archer, 0, rolls(0.4499, 0.99)).hit).toBe(true);
      expect(enemyHit("spider", archer, 0, rolls(0.45)).hit).toBe(false);
    }
    for (const melee of [fresh, { ...fresh, weapon: "copperSword" }]) {
      expect(enemyHit("spider", melee, 0, rolls(0.3499, 0.99)).hit).toBe(true);
      expect(enemyHit("spider", melee, 0, rolls(0.35)).hit).toBe(false);
    }
  });

  test("leaves damage and armour alone: the same rolls deal the same damage at every pairing", () => {
    const armoured = { ...fresh, body: "emberiteChestplate" };
    const damageOf = (weapon: string) =>
      enemyHit("spider", { ...armoured, weapon }, 0, rolls(0, 0.999)).damage;
    expect(damageOf("birchBow")).toBe(damageOf("copperSword"));
    expect(damageOf("birchBow")).toBeLessThan(200);
    for (const target of ["melee", "ranged", "magic"] as const)
      expect(
        playerHit(fresh, "balanced", target, 0, 800, rolls(0, 0.999, 0.99)),
      ).toEqual(
        playerHit(fresh, "balanced", "melee", 0, 800, rolls(0, 0.999, 0.99)),
      );
  });

  test("an enemy keeps its 5% floor against a ranged player", () => {
    // 35% + 10 points - 44.5 points of Avoidance would be under 1%.
    const archer = { ...fresh, weapon: "birchBow", defenseXp: MAX_XP };
    expect(enemyHit("spider", archer, 20, rolls(0.0499, 0.99)).hit).toBe(true);
    expect(enemyHit("spider", archer, 20, rolls(0.05)).hit).toBe(false);
  });
});

describe("rollLoot", () => {
  test("certain loot takes no roll: every damager gets a docile creature's hide (#238)", () => {
    const random = rolls();
    expect(rollLoot(ENEMIES.tarnOx.loot, ["a", "b"], random)).toEqual([
      { player: "a", item: "tarnHide", count: 1 },
      { player: "b", item: "tarnHide", count: 1 },
    ]);
  });

  test("each damager rolls a Skeleton's Emberbone chance on their own (spec §4)", () => {
    expect(
      rollLoot(ENEMIES.skeleton.loot, ["a", "b", "c"], rolls(0.1, 0.5, 0.2)),
    ).toEqual([
      { player: "a", item: "emberbone", count: 1 },
      { player: "c", item: "emberbone", count: 1 },
    ]);
  });

  test("a table rolls each category's picks, then picks by weight, then a count from its range", () => {
    const loot = [
      {
        category: "gear",
        chance: 0.5,
        picks: 2,
        items: [
          { item: "copperSword", weight: 3 },
          { item: "copperShield", weight: 1 },
        ],
      },
      {
        category: "material",
        chance: 1,
        items: [{ item: "coins", count: [10, 25] }],
      },
      { category: "quest", chance: 0.05, items: [{ item: "emberbone" }] },
    ] as const;
    // Gear: a hit picking 0.8 of 4 (the shield), then a miss. Coins: 0 of 16 steps.
    // Quest: a miss.
    expect(rollLoot(loot, ["a"], rolls(0.1, 0.8, 0.9, 0, 0.5))).toEqual([
      { player: "a", item: "copperShield", count: 1 },
      { player: "a", item: "coins", count: 10 },
    ]);
  });
});
