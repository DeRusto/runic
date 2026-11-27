import { describe, expect, test } from "vitest";
import {
  isRangedStance,
  isStance,
  meleeXpOf,
  RANGED_STANCES,
  rangedXpOf,
  STANCES,
  STARTING_RANGED_STANCE,
  STARTING_STANCE,
  type RangedStance,
} from "./stances.ts";

test("there are three stances, and a new player starts Balanced", () => {
  expect(Object.keys(STANCES)).toEqual(["balanced", "precise", "forceful"]);
  expect(STARTING_STANCE).toBe("balanced");
});

test("Balanced splits a hit's melee experience evenly, Attack taking an odd point", () => {
  expect(meleeXpOf("balanced", 6)).toEqual({ attackXp: 3, strengthXp: 3 });
  expect(meleeXpOf("balanced", 9)).toEqual({ attackXp: 5, strengthXp: 4 });
  expect(meleeXpOf("balanced", 0)).toEqual({ attackXp: 0, strengthXp: 0 });
});

test("Precise trains only Attack and Forceful only Strength", () => {
  expect(meleeXpOf("precise", 9)).toEqual({ attackXp: 9, strengthXp: 0 });
  expect(meleeXpOf("forceful", 9)).toEqual({ attackXp: 0, strengthXp: 9 });
});

test("only a stance's own id is a stance", () => {
  expect(isStance("forceful")).toBe(true);
  expect(isStance("Forceful")).toBe(false);
  expect(isStance("toString")).toBe(false);
  expect(isStance(1)).toBe(false);
  expect(isStance(undefined)).toBe(false);
});

describe("Ranged stances", () => {
  test("there are three, and every player starts Steady", () => {
    expect(Object.keys(RANGED_STANCES)).toEqual([
      "steady",
      "rapid",
      "longrange",
    ]);
    expect(STARTING_RANGED_STANCE).toBe("steady");
  });

  test("Steady and Rapid send all of a shot's experience to Ranged", () => {
    expect(rangedXpOf("steady", 9)).toEqual({ rangedXp: 9, defenseXp: 0 });
    expect(rangedXpOf("rapid", 9)).toEqual({ rangedXp: 9, defenseXp: 0 });
  });

  test("Longrange splits it evenly between Ranged and Defense, Ranged taking an odd point", () => {
    expect(rangedXpOf("longrange", 6)).toEqual({ rangedXp: 3, defenseXp: 3 });
    expect(rangedXpOf("longrange", 9)).toEqual({ rangedXp: 5, defenseXp: 4 });
    expect(rangedXpOf("longrange", 0)).toEqual({ rangedXp: 0, defenseXp: 0 });
  });

  test("the split never adds or loses a point", () => {
    for (const stance of Object.keys(RANGED_STANCES) as RangedStance[])
      for (let xp = 0; xp <= 200; xp++) {
        const { rangedXp, defenseXp } = rangedXpOf(stance, xp);
        expect(rangedXp + defenseXp).toBe(xp);
      }
  });

  test("only a Ranged stance's own id is a Ranged stance, and melee's are not", () => {
    expect(isRangedStance("longrange")).toBe(true);
    expect(isRangedStance("Longrange")).toBe(false);
    expect(isRangedStance("balanced")).toBe(false);
    expect(isRangedStance("toString")).toBe(false);
    expect(isRangedStance(2)).toBe(false);
    expect(isStance("steady")).toBe(false);
  });
});
