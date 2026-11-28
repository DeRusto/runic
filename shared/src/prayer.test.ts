import { expect, test } from "vitest";
import { burialXp, maxPrayerPoints, regeneratePrayerPoints } from "./prayer.ts";

test("Prayer gives ten points per level", () => {
  expect(maxPrayerPoints(0)).toBe(10);
  expect(maxPrayerPoints(49)).toBe(10);
  expect(maxPrayerPoints(50)).toBe(20);
  expect(maxPrayerPoints(480200)).toBe(990);
});

test("Prayer restores one point on each twentieth tick up to the maximum", () => {
  expect(regeneratePrayerPoints(8, 0, 19)).toBe(8);
  expect(regeneratePrayerPoints(8, 0, 20)).toBe(9);
  expect(regeneratePrayerPoints(9, 0, 40)).toBe(10);
  expect(regeneratePrayerPoints(10, 0, 60)).toBe(10);
});

test("burying bones pays five experience, heavy bones thirteen, and other items cannot be buried", () => {
  expect(burialXp("bones")).toBe(5);
  expect(burialXp("heavyBones")).toBe(13);
  expect(burialXp("emberbone")).toBeUndefined();
  expect(burialXp("__proto__")).toBeUndefined();
  expect(burialXp(undefined)).toBeUndefined();
});
