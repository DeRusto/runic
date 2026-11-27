import { describe, expect, test, vi } from "vitest";
import {
  inReach,
  OUT_OF_ARROWS_LINE,
  rangedAttackRefusal,
  rangedHit,
  rangedWeaponOf,
} from "./ranged.ts";
import type { RangedStance } from "./stances.ts";
import type { Style } from "./triangle.ts";
import { MAX_XP } from "./skills.ts";

/** Hands out these rolls in order, then fails the test if asked for more. */
const rolls = (...values: number[]) =>
  vi.fn(() => {
    if (!values.length) throw new Error("rolled too often");
    return values.shift()!;
  });

/** A fresh archer with a birch bow (+5 Accuracy) and copper arrows (+100 hit). */
const archer = {
  agilityXp: 0,
  rangedXp: 0,
  attackXp: 0,
  strengthXp: 0,
  weapon: "birchBow",
  ammo: "copperArrow",
};

describe("the combat triangle on a shot (#271)", () => {
  test("a ranged player lands 10 points less often on a melee enemy and 10 more on a magic one, with a bow and with knives", () => {
    // 45% with the birch bow, 40% with knives, against a ranged target.
    for (const [weapon, base] of [
      ["birchBow", 0.45],
      ["copperThrowingKnife", 0.4],
    ] as const) {
      const shot = (target: Style, roll: number) =>
        rangedHit({ ...archer, weapon }, target, 0, 800, rolls(roll, 0, 0.99))
          .damage;
      expect(shot("melee", base - 0.1 - 0.0001)).toBeGreaterThan(0);
      expect(shot("melee", base - 0.1 + 0.0001)).toBe(0);
      expect(shot("magic", base + 0.1 - 0.0001)).toBeGreaterThan(0);
      expect(shot("magic", base + 0.1 + 0.0001)).toBe(0);
    }
  });

  test("never changes a landed shot's damage", () => {
    for (const target of ["melee", "ranged", "magic"] as const)
      expect(rangedHit(archer, target, 0, 900, rolls(0, 0.999, 0.99))).toEqual(
        rangedHit(archer, "ranged", 0, 900, rolls(0, 0.999, 0.99)),
      );
  });
});

describe("rangedHit", () => {
  test("a miss rolls once and pays nothing", () => {
    expect(rangedHit(archer, "ranged", 0, 800, rolls(0.99))).toEqual({
      damage: 0,
      critical: false,
      xp: [
        ["rangedXp", 0],
        ["defenseXp", 0],
        ["hitpointsXp", 0],
      ],
    });
  });

  test("the chance to land is 40% plus the bow's Accuracy at Ranged 1, and 0.5 points per Ranged level above it", () => {
    // 45% at Ranged 1 with the birch bow's +5.
    expect(
      rangedHit(archer, "ranged", 0, 800, rolls(0.4499, 0, 0.99)).damage,
    ).toBe(200);
    expect(rangedHit(archer, "ranged", 0, 800, rolls(0.45)).damage).toBe(0);
    // 94% at Ranged 99.
    const trained = { ...archer, rangedXp: MAX_XP };
    expect(
      rangedHit(trained, "ranged", 0, 800, rolls(0.9399, 0, 0.99)).damage,
    ).toBe(200);
    // Attack doesn't help a shot land.
    const fighter = { ...archer, attackXp: MAX_XP };
    expect(rangedHit(fighter, "ranged", 0, 800, rolls(0.5)).damage).toBe(0);
  });

  test("a ring's Accuracy adds to the bow's", () => {
    const ringed = { ...archer, ring: "copperRing" };
    expect(
      rangedHit(ringed, "ranged", 0, 800, rolls(0.4999, 0, 0.99)).damage,
    ).toBe(200);
    expect(rangedHit(ringed, "ranged", 0, 800, rolls(0.5)).damage).toBe(0);
  });

  test("the max hit is 200 plus 100 per 20 Ranged levels, before the arrow's hit bonus", () => {
    expect(
      rangedHit(archer, "ranged", 0, 900, rolls(0, 0.999, 0.99)).damage,
    ).toBe(300);
    const trained = { ...archer, rangedXp: MAX_XP };
    expect(
      rangedHit(trained, "ranged", 0, 900, rolls(0, 0.999, 0.99)).damage,
    ).toBe(700);
    // Strength doesn't raise it.
    const striker = { ...archer, strengthXp: MAX_XP };
    expect(
      rangedHit(striker, "ranged", 0, 900, rolls(0, 0.999, 0.99)).damage,
    ).toBe(300);
  });

  test("the arrow's hit bonus and Might add to a landed shot", () => {
    const emberite = { ...archer, ammo: "emberiteArrow" };
    expect(
      rangedHit(emberite, "ranged", 0, 900, rolls(0, 0, 0.99)).damage,
    ).toBe(400);
    expect(
      rangedHit(archer, "ranged", 100, 900, rolls(0, 0, 0.99)).damage,
    ).toBe(300);
  });

  test("worn Might adds to a landed shot, as it does to a swing", () => {
    // A rare iron piece carries Might 3 × tier 3 × 2 = 18.
    const mighty = { ...archer, head: "ironHelmet:rare:might" };
    expect(rangedHit(mighty, "ranged", 0, 900, rolls(0, 0, 0.99)).damage).toBe(
      218,
    );
  });

  test("Agility's crit chance applies at 1.5 times", () => {
    expect(
      rangedHit(archer, "ranged", 0, 900, rolls(0, 0, 0.0999)),
    ).toMatchObject({
      damage: 300,
      critical: true,
    });
    const agile = { ...archer, agilityXp: MAX_XP };
    expect(
      rangedHit(agile, "ranged", 0, 900, rolls(0, 0, 0.1979)),
    ).toMatchObject({
      critical: true,
    });
  });

  test("a hit pays 6 Ranged experience per 100 damage, rounded once, and Hitpoints the same; overkill pays none", () => {
    expect(rangedHit(archer, "ranged", 0, 900, rolls(0, 0.5, 0.99))).toEqual({
      damage: 250,
      critical: false,
      xp: [
        ["rangedXp", 15],
        ["defenseXp", 0],
        ["hitpointsXp", 15],
      ],
    });
    expect(rangedHit(archer, "ranged", 0, 50, rolls(0, 0, 0.99))).toEqual({
      damage: 50,
      critical: false,
      xp: [
        ["rangedXp", 3],
        ["defenseXp", 0],
        ["hitpointsXp", 3],
      ],
    });
  });
});

describe("rangedWeaponOf", () => {
  test("a bow reaches 6 tiles and fires every 8 ticks; a sword and bare hands are melee", () => {
    expect(rangedWeaponOf({ weapon: "birchBow" })).toEqual({
      reachTiles: 6,
      intervalTicks: 8,
      thrown: false,
    });
    expect(rangedWeaponOf({ weapon: "charwoodBow" })).toEqual({
      reachTiles: 6,
      intervalTicks: 8,
      thrown: false,
    });
    expect(rangedWeaponOf({ weapon: "copperSword" })).toBeUndefined();
    expect(rangedWeaponOf({ weapon: "" })).toBeUndefined();
  });
});

describe("throwing knives", () => {
  /** A fresh thrower with copper knives in hand and, to show they play no part, emberite arrows worn. */
  const thrower = {
    ...archer,
    weapon: "copperThrowingKnife",
    weaponCount: 20,
    ammo: "emberiteArrow",
  };

  test("a stack of knives reaches 4 tiles and throws every 6 ticks, at any tier", () => {
    for (const weapon of [
      "copperThrowingKnife",
      "bronzeThrowingKnife",
      "ironThrowingKnife",
      "steelThrowingKnife",
      "emberiteThrowingKnife",
    ])
      expect(rangedWeaponOf({ weapon })).toEqual({
        reachTiles: 4,
        intervalTicks: 6,
        thrown: true,
      });
  });

  test("a throw lands at 40% at Ranged 1, as knives add no Accuracy", () => {
    expect(
      rangedHit(thrower, "ranged", 0, 800, rolls(0.3999, 0, 0.99)).damage,
    ).toBe(200);
    expect(rangedHit(thrower, "ranged", 0, 800, rolls(0.4)).damage).toBe(0);
  });

  test("the knife's own hit bonus adds to a throw, and the arrows in the ammo slot add nothing", () => {
    expect(rangedHit(thrower, "ranged", 0, 900, rolls(0, 0, 0.99)).damage).toBe(
      200,
    );
    const steel = { ...thrower, weapon: "steelThrowingKnife" };
    expect(rangedHit(steel, "ranged", 0, 900, rolls(0, 0, 0.99)).damage).toBe(
      350,
    );
  });

  test("a throw trains Ranged and Hitpoints", () => {
    expect(
      rangedHit(thrower, "ranged", 0, 900, rolls(0, 0.5, 0.99)).xp,
    ).toEqual([
      ["rangedXp", 15],
      ["defenseXp", 0],
      ["hitpointsXp", 15],
    ]);
  });

  test("a stack of knives can always attack, with or without arrows", () => {
    expect(
      rangedAttackRefusal({ weapon: "ironThrowingKnife" }),
    ).toBeUndefined();
    expect(rangedAttackRefusal({ weapon: "birchBow" })).toBe(
      OUT_OF_ARROWS_LINE,
    );
  });
});

describe("Ranged stances", () => {
  test("Rapid takes 2 ticks off the interval and Longrange adds 2 tiles of reach, with a bow and with knives", () => {
    const of = (weapon: string, rangedStance: RangedStance) =>
      rangedWeaponOf({ weapon, rangedStance });
    for (const weapon of ["birchBow", "oakBow", "charwoodBow"]) {
      expect(of(weapon, "steady")).toMatchObject({
        reachTiles: 6,
        intervalTicks: 8,
      });
      expect(of(weapon, "rapid")).toMatchObject({
        reachTiles: 6,
        intervalTicks: 6,
      });
      expect(of(weapon, "longrange")).toMatchObject({
        reachTiles: 8,
        intervalTicks: 8,
      });
    }
    for (const weapon of ["copperThrowingKnife", "emberiteThrowingKnife"]) {
      expect(of(weapon, "steady")).toMatchObject({
        reachTiles: 4,
        intervalTicks: 6,
      });
      expect(of(weapon, "rapid")).toMatchObject({
        reachTiles: 4,
        intervalTicks: 4,
      });
      expect(of(weapon, "longrange")).toMatchObject({
        reachTiles: 6,
        intervalTicks: 6,
      });
    }
    expect(of("copperSword", "rapid")).toBeUndefined();
  });

  test("Steady and Rapid send a hit's experience to Ranged, with a bow and with knives", () => {
    for (const weapon of ["birchBow", "copperThrowingKnife"])
      for (const rangedStance of ["steady", "rapid"] as const)
        expect(
          rangedHit(
            { ...archer, weapon, rangedStance },
            "ranged",
            0,
            900,
            rolls(0, 0.5, 0.99),
          ).xp,
        ).toEqual([
          ["rangedXp", 15],
          ["defenseXp", 0],
          ["hitpointsXp", 15],
        ]);
  });

  test("Longrange splits a hit's experience between Ranged and Defense, with a bow and with knives, and Hitpoints gets the whole", () => {
    for (const weapon of ["birchBow", "copperThrowingKnife"])
      expect(
        rangedHit(
          { ...archer, weapon, rangedStance: "longrange" },
          "ranged",
          0,
          900,
          rolls(0, 0.5, 0.99),
        ).xp,
      ).toEqual([
        ["rangedXp", 8],
        ["defenseXp", 7],
        ["hitpointsXp", 15],
      ]);
  });
});

describe("inReach", () => {
  test("counts a diagonal step as one tile", () => {
    const from = { x: 0, y: 0 };
    expect(inReach(from, { x: 6, y: 6 }, 6)).toBe(true);
    expect(inReach(from, { x: 6, y: 0 }, 6)).toBe(true);
    expect(inReach(from, { x: 7, y: 3 }, 6)).toBe(false);
  });
});
