import { expect, test } from "vitest";
import { ENEMIES } from "./enemies.ts";

test("a Spider's numbers are the first slice's", () => {
  expect(ENEMIES.spider).toEqual({
    health: 800,
    hitChance: 0.35,
    accuracy: 0,
    style: "melee",
    maxDamage: 200,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0.1,
    wanderTiles: 5,
    leashTiles: 4,
    // #272: 1 or 2 spider silk every kill.
    loot: [
      {
        category: "material",
        chance: 1,
        items: [{ item: "spiderSilk", count: [1, 2] }],
      },
    ],
  });
});

test("#238's three hide creatures stand and pay their hide; only the Tarn Ox is docile", () => {
  for (const [kind, health, hide] of [
    ["tarnOx", 200, "tarnHide"],
    ["bristleback", 500, "bristleHide"],
    ["cinderhorn", 1000, "cinderHide"],
  ] as const) {
    expect(ENEMIES[kind]).toMatchObject({
      health,
      wanderChance: 0,
      loot: [{ category: "material", chance: 1, items: [{ item: hide }] }],
    });
    expect(ENEMIES[kind].noticeTiles).toBeUndefined();
  }
  expect(ENEMIES.tarnOx).toMatchObject({ hitChance: 0, docile: true });
});

test("a Bristleback and a Cinderhorn bite back, seldom and as little as a hit can", () => {
  expect(ENEMIES.bristleback).toMatchObject({
    hitChance: 0.2,
    maxDamage: 100,
    leashTiles: 2,
  });
  expect(ENEMIES.cinderhorn).toMatchObject({
    hitChance: 0.25,
    maxDamage: 150,
    leashTiles: 2,
  });
  expect(ENEMIES.bristleback.docile).toBeUndefined();
  expect(ENEMIES.cinderhorn.docile).toBeUndefined();
});

test("a Skeleton's numbers are spec §5's, and otherwise a Spider's", () => {
  expect(ENEMIES.skeleton).toEqual({
    health: 2400,
    hitChance: 0.55,
    accuracy: 0,
    style: "melee",
    maxDamage: 500,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 200,
    wanderChance: 0.1,
    wanderTiles: 3,
    noticeTiles: 3,
    leashTiles: 4,
    bone: { item: "bones", chance: 2 / 3 },
    loot: [
      { category: "material", chance: 0.25, items: [{ item: "emberbone" }] },
    ],
  });
});
