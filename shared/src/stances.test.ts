import { expect, test } from "vitest";
import { isStance, meleeXpOf, STANCES, STARTING_STANCE } from "./stances.ts";

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
