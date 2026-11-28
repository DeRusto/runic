import { describe, expect, test } from "vitest";
import { enemyHit, playerHit } from "./combat.ts";
import { magicHit, magicHitOf } from "./magic.ts";
import {
  drainPrayerPoints,
  isBoostPrayer,
  PRAYERS,
  prayerBoostOf,
  prayerRefusal,
  prayersAfterToggle,
  prayersInLevelOrder,
} from "./prayers.ts";
import { rangedHit, rangedHitOf } from "./ranged.ts";
import { hitOf } from "./stats.ts";
import { xpForLevel } from "./skills.ts";

const always = (value: number) => () => value;

const fighter = {
  agilityXp: 0,
  attackXp: 0,
  strengthXp: 0,
  rangedXp: 0,
  magicXp: 0,
  defenseXp: 0,
  blockingXp: 0,
  health: 1000,
};

test("the twelve prayers list in level order, the wards last", () => {
  expect(prayersInLevelOrder()).toEqual([
    "sureHand",
    "firmGrip",
    "lightStep",
    "trueAim",
    "stoneFist",
    "quickShadow",
    "farSight",
    "giantsWrath",
    "mistWalker",
    "wardOfArrows",
    "wardOfSteel",
    "wardOfRunes",
  ]);
  expect(PRAYERS.giantsWrath).toMatchObject({
    name: "Giant's Wrath",
    ladder: "might",
    level: 22,
    amount: 150,
    drain: 30,
  });
});

test("only the nine boost prayers can be turned on; the wards wait for their ticket", () => {
  expect(isBoostPrayer("sureHand")).toBe(true);
  expect(isBoostPrayer("mistWalker")).toBe(true);
  expect(isBoostPrayer("wardOfSteel")).toBe(false);
  expect(isBoostPrayer("toString")).toBe(false);
  expect(isBoostPrayer(3)).toBe(false);
});

describe("prayerRefusal", () => {
  const at = (level: number, prayerPoints = 10) => ({
    prayerXp: xpForLevel(level),
    prayerPoints,
  });

  test("a prayer above the player's level is refused with its level", () => {
    expect(prayerRefusal(at(3), "firmGrip")).toBe(
      "You need Prayer 4 for that.",
    );
    expect(prayerRefusal(at(4), "firmGrip")).toBeUndefined();
  });

  test("turning a prayer on with no points is refused", () => {
    expect(prayerRefusal(at(1, 0), "sureHand")).toBe(
      "You have no prayer points left. Pray at a shrine to refill them.",
    );
  });
});

describe("prayersAfterToggle", () => {
  test("a second step of a ladder turns the first off", () => {
    expect(prayersAfterToggle(["sureHand"], "trueAim")).toEqual(["trueAim"]);
    expect(prayersAfterToggle(["farSight"], "sureHand")).toEqual(["sureHand"]);
  });

  test("prayers from different ladders run together", () => {
    expect(prayersAfterToggle(["sureHand"], "firmGrip")).toEqual([
      "sureHand",
      "firmGrip",
    ]);
    expect(
      prayersAfterToggle(["sureHand", "firmGrip"], "lightStep"),
    ).toHaveLength(3);
  });

  test("toggling an active prayer turns it off", () => {
    expect(prayersAfterToggle(["sureHand", "firmGrip"], "sureHand")).toEqual([
      "firmGrip",
    ]);
  });
});

test("a ladder's boost is its active step's amount, 0 with none on", () => {
  const active = ["trueAim", "giantsWrath"];
  expect(prayerBoostOf(active, "accuracy")).toBe(6);
  expect(prayerBoostOf(active, "might")).toBe(150);
  expect(prayerBoostOf(active, "avoidance")).toBe(0);
});

describe("drainPrayerPoints", () => {
  test("drain adds up across prayers, per 200 ticks", () => {
    // Sure Hand and Stone Fist: 10 + 20 = 30 points per 200 ticks.
    let state = { points: 100, carried: 0 };
    for (let tick = 0; tick < 200; tick++)
      state = drainPrayerPoints(state, ["sureHand", "stoneFist"]);
    expect(state).toEqual({ points: 70, carried: 0 });
  });

  test("the fraction carries between ticks, so drain is exact over time", () => {
    // 10 points per 200 ticks is one point every 20 ticks.
    let state = { points: 10, carried: 0 };
    for (let tick = 0; tick < 19; tick++)
      state = drainPrayerPoints(state, ["sureHand"]);
    expect(state.points).toBe(10);
    state = drainPrayerPoints(state, ["sureHand"]);
    expect(state).toEqual({ points: 9, carried: 0 });
  });

  test("points never fall below 0", () => {
    expect(
      drainPrayerPoints({ points: 0, carried: 199 }, ["farSight"]).points,
    ).toBe(0);
  });

  test("with no prayer on, nothing drains", () => {
    expect(drainPrayerPoints({ points: 5, carried: 7 }, [])).toEqual({
      points: 5,
      carried: 7,
    });
  });
});

describe("the boosts in a fight", () => {
  const archer = { ...fighter, weapon: "birchBow", ammo: "copperArrow" };
  const mage = { ...fighter, weapon: "birchStaff", combatSpell: "airDart" };
  // Each attack rolls its land roll 5 points above its own chance to land, which misses
  // without a boost and lands with an Accuracy prayer's 10 points.
  test.each([
    [
      "melee",
      hitOf(fighter).chance,
      (roll: number, bonus: number) =>
        playerHit(fighter, "balanced", "melee", 0, 800, always(roll), bonus),
    ],
    [
      "ranged",
      rangedHitOf(archer).chance,
      (roll: number, bonus: number) =>
        rangedHit(archer, "ranged", 0, 800, always(roll), bonus),
    ],
    [
      "magic",
      magicHitOf(mage).chance,
      (roll: number, bonus: number) =>
        magicHit(mage, "magic", 0, 800, always(roll), bonus),
    ],
  ] as const)(
    "an Accuracy prayer adds its points to the chance to land with %s",
    (_style, chance, attack) => {
      expect(attack(chance + 0.05, 0).damage).toBe(0);
      expect(attack(chance + 0.05, 10).damage).toBeGreaterThan(0);
    },
  );

  test("an Avoidance prayer takes its points off the enemy's chance to hit, down to the floor", () => {
    // A spider lands at 0.35 against a fresh fighter; 10 points of Avoidance makes it 0.25.
    expect(enemyHit("spider", fighter, 0, always(0.3)).hit).toBe(true);
    expect(enemyHit("spider", fighter, 10, always(0.3)).hit).toBe(false);
    expect(enemyHit("spider", fighter, 1000, always(0.04)).hit).toBe(true);
  });
});
