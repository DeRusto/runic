import { expect, test } from "vitest";
import { nextOffering, offeringRefusal, shrinePrayerPoints } from "./prayer.ts";

test("the fast refill adds twenty points and caps at the Prayer level's maximum", () => {
  expect(shrinePrayerPoints(7, 450)).toBe(27);
  expect(shrinePrayerPoints(27, 450)).toBe(40);
});

test("the next offering skips other items and empty stacks, and pays by bone kind", () => {
  expect(
    nextOffering(["rope", "bones", "heavyBones", "bones"], [1, 0, 2, 1]),
  ).toEqual({ slot: 2, xp: 40 });
  expect(nextOffering(["bones"], [1])).toEqual({ slot: 0, xp: 15 });
  expect(offeringRefusal({ inventory: ["rope"], inventoryCounts: [1] })).toBe(
    "You have no bones to offer.",
  );
});
