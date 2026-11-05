import { expect, test } from "vitest";
import { levelFor, levelProgress, MAX_XP, xpForLevel } from "./skills.ts";

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
