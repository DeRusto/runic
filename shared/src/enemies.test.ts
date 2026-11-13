import { expect, test } from "vitest";
import { ENEMIES } from "./enemies.ts";

test("a Spider's numbers are the first slice's", () => {
  expect(ENEMIES.spider).toEqual({
    health: 800,
    hitChance: 0.35,
    accuracy: 0,
    maxDamage: 200,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0.1,
    wanderTiles: 5,
    leashTiles: 4,
    loot: [],
  });
});

test("#238's three docile creatures stand, never swing, and pay their hide", () => {
  for (const [kind, health, hide] of [
    ["tarnOx", 200, "tarnHide"],
    ["bristleback", 500, "bristleHide"],
    ["cinderhorn", 1000, "cinderHide"],
  ] as const) {
    expect(ENEMIES[kind]).toMatchObject({
      health,
      hitChance: 0,
      maxDamage: 0,
      wanderChance: 0,
      docile: true,
      loot: [{ category: "material", chance: 1, items: [{ item: hide }] }],
    });
  }
});

test("a Skeleton's numbers are spec §5's, and otherwise a Spider's", () => {
  expect(ENEMIES.skeleton).toEqual({
    health: 2400,
    hitChance: 0.55,
    accuracy: 0,
    maxDamage: 500,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 200,
    wanderChance: 0.1,
    wanderTiles: 3,
    noticeTiles: 3,
    leashTiles: 4,
    loot: [
      { category: "material", chance: 0.25, items: [{ item: "emberbone" }] },
    ],
  });
});
