import { expect, test } from "vitest";
import { enemyHitChance } from "./stats.ts";
import { effectOf, refreshEffect } from "./spellEffects.ts";

test("air weakens by five or ten points for twenty ticks and keeps the enemy hit floor", () => {
  expect(effectOf("airDart")).toEqual({
    element: "air",
    strength: 5,
    durationTicks: 20,
  });
  expect(effectOf("airSurge")).toEqual({
    element: "air",
    strength: 10,
    durationTicks: 20,
  });
  expect(enemyHitChance("skeleton", 0, "magic", false, 5)).toBeCloseTo(0.4);
  expect(enemyHitChance("skeleton", 0, "magic", false, 10)).toBeCloseTo(0.35);
  expect(enemyHitChance("skeleton", 100, "magic", false, 10)).toBe(0.05);
});

test("a dart refreshes a running surge at full strength, then starts at dart strength once it expires", () => {
  const surge = refreshEffect(effectOf("airSurge")!, undefined, 1);
  expect(refreshEffect(effectOf("airDart")!, surge, 11)).toMatchObject({
    strength: 10,
    endTick: 31,
  });
  expect(refreshEffect(effectOf("airDart")!, surge, 21)).toMatchObject({
    strength: 5,
    endTick: 41,
  });
});

test("water delays the undelayed swing by four or eight ticks without stacking", () => {
  const water = refreshEffect(effectOf("waterSurge")!, undefined, 1, 5);
  expect(water.endTick).toBe(13);
  expect(refreshEffect(effectOf("waterDart")!, water, 11, 11).endTick).toBe(19);
  expect(refreshEffect(effectOf("waterDart")!, undefined, 1, 5).endTick).toBe(
    9,
  );
});

test("earth holds for six or twelve ticks and a surge replaces a dart", () => {
  const dart = refreshEffect(effectOf("earthDart")!, undefined, 1);
  expect(dart.endTick).toBe(7);
  const surge = refreshEffect(effectOf("earthSurge")!, dart, 2);
  expect(surge.endTick).toBe(14);
  expect(refreshEffect(effectOf("earthDart")!, surge, 11).endTick).toBe(23);
});
