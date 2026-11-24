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
    ["bristleback", 1400, "bristleHide"],
    ["cinderhorn", 2600, "cinderHide"],
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

test("a Bristleback and a Cinderhorn fight back at their hide band's strength (#297)", () => {
  expect(ENEMIES.bristleback).toMatchObject({
    health: 1400,
    hitChance: 0.4,
    maxDamage: 300,
    wanderChance: 0,
    leashTiles: 2,
  });
  expect(ENEMIES.cinderhorn).toMatchObject({
    health: 2600,
    hitChance: 0.5,
    maxDamage: 450,
    wanderChance: 0,
    leashTiles: 2,
  });
  expect(ENEMIES.bristleback.noticeTiles).toBeUndefined();
  expect(ENEMIES.cinderhorn.noticeTiles).toBeUndefined();
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
