import { expect, test } from "vitest";
import {
  combatLevel,
  levelFor,
  levelProgress,
  MAX_XP,
  SKILL_REGISTRY,
  SKILLS,
  totalLevel,
  xpForLevel,
} from "./skills.ts";

test("total experience for a level is 50·(L−1)²", () => {
  expect(xpForLevel(1)).toBe(0);
  expect(xpForLevel(2)).toBe(50);
  expect(xpForLevel(10)).toBe(4050);
  expect(xpForLevel(99)).toBe(480200);
  expect(MAX_XP).toBe(480200);
});

test("level comes from experience, changing exactly on each threshold", () => {
  expect(levelFor(0)).toBe(1);
  expect(levelFor(49)).toBe(1);
  expect(levelFor(50)).toBe(2);
  expect(levelFor(4049)).toBe(9);
  expect(levelFor(4050)).toBe(10);
});

test("every level from 1 to 99 starts at its own threshold", () => {
  for (let level = 1; level <= 99; level++) {
    expect(levelFor(xpForLevel(level))).toBe(level);
    if (level > 1) expect(levelFor(xpForLevel(level) - 1)).toBe(level - 1);
  }
});

test("level stops at 99", () => {
  expect(levelFor(480199)).toBe(98);
  expect(levelFor(480200)).toBe(99);
  expect(levelFor(9999999)).toBe(99);
});

test("progress is how far through the current level", () => {
  expect(levelProgress(0)).toBe(0);
  expect(levelProgress(25)).toBe(0.5);
  // level 2 runs from 50 to 200
  expect(levelProgress(50)).toBe(0);
  expect(levelProgress(125)).toBe(0.5);
  expect(levelProgress(480200)).toBe(1);
});

test("the registry holds 23 different skills, without Combat, which splits", () => {
  const names = SKILL_REGISTRY.map(([skill]) => skill);
  expect(new Set(names).size).toBe(23);
  expect(names).not.toContain("Combat");
  expect(names).not.toContain("Foraging");
  expect(names).toContain("Herblaw");
});

test("only the skills that can be trained reach the sheet, the bar and pinning", () => {
  expect(SKILLS.map(([skill]) => skill)).toEqual([
    "Combat",
    "Defense",
    "Herblaw",
    "Hitpoints",
    "Mining",
    "Smithing",
    "Woodcutting",
    "Fishing",
    "Cooking",
    "Firemaking",
    "Blocking",
    "Mastery",
  ]);
});

test("a new player's total level is Hitpoints 10 and 22 skills at 1", () => {
  expect(totalLevel({ hitpointsXp: 4050 })).toBe(32);
});

test("total level counts experience held, Herblaw's too, but not Combat's", () => {
  expect(
    totalLevel({
      hitpointsXp: 4050,
      miningXp: 50,
      herblawXp: xpForLevel(10),
      combatXp: MAX_XP,
    }),
  ).toBe(42);
});

test("total level tops out at 2,277", () => {
  const maxed = Object.fromEntries(
    SKILL_REGISTRY.map(([, field]) => [field, MAX_XP]),
  );
  expect(totalLevel(maxed)).toBe(2277);
});

const FRESH = { hitpointsXp: xpForLevel(10) };

test("a fresh player is combat level 3", () => {
  expect(combatLevel(FRESH)).toBe(3);
});

test("a player maxed in everything trainable is 138 by hand", () => {
  // 0.25 × (99 + 99 + 99 + 0) + 0.325 × (99 + 99) = 74.25 + 64.35
  expect(
    combatLevel({
      combatXp: MAX_XP,
      defenseXp: MAX_XP,
      blockingXp: MAX_XP,
      hitpointsXp: MAX_XP,
    }),
  ).toBe(138);
});

test("a player maxed in all of it is 150 by hand", () => {
  // 0.25 × (99 + 99 + 99 + 49) + 0.325 × (99 + 99) = 86.5 + 64.35
  const maxed = Object.fromEntries(
    SKILL_REGISTRY.map(([, field]) => [field, MAX_XP]),
  );
  expect(combatLevel(maxed)).toBe(150);
});

test("Combat counts twice, for Attack and for Strength", () => {
  // 3 + 0.325 × (2 + 2) = 4.3
  expect(combatLevel({ ...FRESH, combatXp: xpForLevel(2) })).toBe(4);
});

test("Defense, Blocking and Hitpoints each count a quarter", () => {
  // 0.25 × 15 + 0.65 = 4.4
  expect(combatLevel({ ...FRESH, defenseXp: xpForLevel(4) })).toBe(4);
  expect(combatLevel({ ...FRESH, blockingXp: xpForLevel(4) })).toBe(4);
  expect(combatLevel({ hitpointsXp: xpForLevel(13) })).toBe(4);
  // 0.25 × 14 + 0.65 = 4.15, then 3.9 one level short
  expect(combatLevel({ ...FRESH, defenseXp: xpForLevel(3) })).toBe(4);
  expect(combatLevel({ ...FRESH, defenseXp: xpForLevel(2) })).toBe(3);
});

test("Mastery and Herblaw don't count", () => {
  expect(combatLevel({ ...FRESH, masteryXp: MAX_XP, herblawXp: MAX_XP })).toBe(
    3,
  );
});

test("the best style is the one that counts, and Prayer counts half", () => {
  // 3 + 0.325 × 148 = 51.1
  expect(combatLevel({ ...FRESH, rangedXp: MAX_XP })).toBe(51);
  expect(combatLevel({ ...FRESH, magicXp: MAX_XP })).toBe(51);
  // 0.25 × (12 + 49) + 0.65 = 15.9
  expect(combatLevel({ ...FRESH, prayerXp: MAX_XP })).toBe(15);
});

test("real Attack and Strength replace Combat once they exist", () => {
  // 3 + 0.325 × (99 + 1) = 35.5, and Combat would have made it 67
  expect(
    combatLevel({
      ...FRESH,
      combatXp: MAX_XP,
      attackXp: MAX_XP,
      strengthXp: 0,
    }),
  ).toBe(35);
});
