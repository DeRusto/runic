import { expect, test } from "vitest";
import { ENEMIES } from "./enemies.ts";

test("a Spider's numbers are the first slice's", () => {
  expect(ENEMIES.spider).toEqual({
    health: 8,
    hitChance: 0.35,
    hitChancePerDefenseLevel: -0.002,
    maxDamage: 2,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0.1,
    wanderTiles: 5,
  });
});
