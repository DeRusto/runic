import {
  INVENTORY_SLOTS,
  MAX_XP,
  parseRegion,
  pickIntervalTicks,
  xpForLevel,
} from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), a walk of 3 steps from standing next to the berry bush at (5,1).
const TILES = parseRegion(
  ["TTTTTTTT", "TR...bhT", "T......T", "TTTTTTTT"].join("\n"),
);
const BERRY = "5,1";
const HERB = "6,1";
const ARRIVAL_TICK = 5;
const FAIL = 0.99;
const SUCCEED = 0;

let sim: Simulation;
let roll: number;

beforeEach(() => {
  roll = SUCCEED;
  sim = new Simulation(TILES, () => roll);
  sim.addPlayer("a");
});

const player = (id = "a") => sim.state.players.get(id)!;
const picksLeft = (bush: string) => sim.state.bushes.get(bush)!.picksLeft;
const food = (id = "a") => [...player(id).inventory].filter(Boolean);

/** Puts a player beside the berry bush at (4,1) with the given Foraging experience. */
const addAt = (id: string, foragingXp: number, x = 4, y = 1) => {
  sim.addPlayer("template");
  const save = sim.saveOf("template")!;
  sim.removePlayer("template");
  sim.addPlayer(id, { ...save, x, y, foragingXp });
};

/** Runs ticks and returns the state tick of each pick attempt. */
const attemptTicks = (count: number) => {
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    sim.tick();
    for (const _ of sim.events.splice(0)) ticks.push(sim.state.tick);
  }
  return ticks;
};

const runTicks = (count: number) => {
  for (let i = 0; i < count; i++) sim.tick();
  sim.events.length = 0;
};

/** Picks once with a click, however long the wait for the next attempt is. */
const pick = (bush: string, id = "a") => {
  sim.queueForage(id, bush);
  runTicks(8);
};

test("clicking a bush walks next to it and attempts on the tick of arrival", () => {
  roll = FAIL;
  sim.queueForage("a", BERRY);
  expect(attemptTicks(ARRIVAL_TICK)).toEqual([ARRIVAL_TICK]);
  expect(player().x).toBe(4);
});

test("a diagonal next to the bush counts, so there is no step before the attempt", () => {
  addAt("b", 0, 4, 2);
  roll = FAIL;
  sim.queueForage("b", BERRY);
  expect(attemptTicks(1)).toEqual([1]);
  expect(player("b")).toMatchObject({ x: 4, y: 2 });
});

test("a success gives the XP and the food, uses a pick and ends the action", () => {
  sim.queueForage("a", BERRY);
  expect(attemptTicks(40)).toEqual([ARRIVAL_TICK]);
  expect(player().foragingXp).toBe(10);
  expect(player().inventory[0]).toBe("berry");
  expect(picksLeft(BERRY)).toBe(4);
});

test("a pick goes in the first empty slot", () => {
  const save = sim.saveOf("a")!;
  save.inventory[0] = "herb";
  save.x = 4;
  sim.addPlayer("b", save);
  sim.queueForage("b", BERRY);
  runTicks(1);
  expect([...player("b").inventory].slice(0, 3)).toEqual(["herb", "berry", ""]);
});

test("a failure gives nothing, keeps the bush, and tries again every 8 ticks", () => {
  roll = FAIL;
  sim.queueForage("a", BERRY);
  expect(attemptTicks(ARRIVAL_TICK + 16)).toEqual([
    ARRIVAL_TICK,
    ARRIVAL_TICK + 8,
    ARRIVAL_TICK + 16,
  ]);
  expect(player().foragingXp).toBe(0);
  expect(food()).toEqual([]);
  expect(picksLeft(BERRY)).toBe(5);
});

test("the attempt interval follows the Foraging level", () => {
  addAt("b", xpForLevel(15));
  roll = FAIL;
  sim.queueForage("b", BERRY);
  expect(attemptTicks(15)).toEqual([1, 8, 15]);
});

test("at Foraging 60 a new click can attempt every 4 ticks", () => {
  addAt("b", xpForLevel(60));
  const ticks: number[] = [];
  for (let i = 0; i < 5; i++) {
    sim.queueForage("b", BERRY);
    ticks.push(...attemptTicks(1));
  }
  expect(ticks).toEqual([1, 5]);
});

test("the roll is against 50% at the bush's own level", () => {
  addAt("b", 0);
  roll = 0.5;
  sim.queueForage("b", BERRY);
  runTicks(1);
  expect(player("b").foragingXp).toBe(0);

  addAt("c", 0);
  roll = 0.49;
  sim.queueForage("c", BERRY);
  runTicks(1);
  expect(player("c").foragingXp).toBe(10);
});

test("XP stops at the cap", () => {
  addAt("b", MAX_XP - 5);
  sim.queueForage("b", BERRY);
  runTicks(1);
  expect(player("b").foragingXp).toBe(MAX_XP);
});

test("a herb bush needs Foraging 10, gives 25 XP and a herb", () => {
  addAt("low", xpForLevel(10) - 1, 5, 2);
  sim.queueForage("low", HERB);
  expect(attemptTicks(20)).toEqual([]);

  addAt("b", xpForLevel(10), 5, 2);
  sim.queueForage("b", HERB);
  runTicks(1);
  expect(player("b").foragingXp).toBe(xpForLevel(10) + 25);
  expect(player("b").inventory[0]).toBe("herb");
});

test("a refused click doesn't replace the current walk", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  sim.queueForage("a", HERB);
  runTicks(1);
  expect(player()).toMatchObject({ x: 2, y: 1 });
});

test("a click with a full inventory is ignored", () => {
  const save = sim.saveOf("a")!;
  save.inventory = Array<string>(INVENTORY_SLOTS).fill("berry");
  save.x = 4;
  sim.addPlayer("b", save);
  sim.queueForage("b", BERRY);
  expect(attemptTicks(10)).toEqual([]);
});

test("a click on a run-out bush is ignored", () => {
  addAt("b", xpForLevel(99));
  for (let i = 0; i < 5; i++) pick(BERRY, "b");
  expect(picksLeft(BERRY)).toBe(0);
  sim.queueForage("b", BERRY);
  expect(attemptTicks(1)).toEqual([]);
});

test("a bush regrows in full 84 ticks after running out", () => {
  addAt("b", xpForLevel(99));
  sim.queueForage("b", BERRY);
  for (let i = 0; i < 4; i++) {
    runTicks(4);
    sim.queueForage("b", BERRY);
  }
  runTicks(1);
  expect(picksLeft(BERRY)).toBe(0);
  runTicks(83);
  expect(picksLeft(BERRY)).toBe(0);
  runTicks(1);
  expect(picksLeft(BERRY)).toBe(5);
});

test("a herb bush gives 3 picks and regrows in 150 ticks", () => {
  addAt("b", xpForLevel(99), 5, 2);
  sim.queueForage("b", HERB);
  for (let i = 0; i < 2; i++) {
    runTicks(4);
    sim.queueForage("b", HERB);
  }
  runTicks(1);
  expect(picksLeft(HERB)).toBe(0);
  runTicks(149);
  expect(picksLeft(HERB)).toBe(0);
  runTicks(1);
  expect(picksLeft(HERB)).toBe(3);
});

test("a partly picked bush doesn't regrow", () => {
  addAt("b", 0);
  sim.queueForage("b", BERRY);
  runTicks(500);
  expect(picksLeft(BERRY)).toBe(4);
});

test("picks are shared, and someone trying stops when the bush runs out", () => {
  addAt("b", xpForLevel(99));
  addAt("c", 0);
  for (let i = 0; i < 4; i++) pick(BERRY, "b");
  // A roll that only level 99 passes.
  roll = 0.9;
  sim.queueForage("c", BERRY);
  runTicks(1);
  expect(picksLeft(BERRY)).toBe(1);
  pick(BERRY, "b");
  expect(picksLeft(BERRY)).toBe(0);
  expect(attemptTicks(40)).toEqual([]);
  expect(food("c")).toEqual([]);
});

test("a newer click ends the trying", () => {
  roll = FAIL;
  sim.queueForage("a", BERRY);
  runTicks(ARRIVAL_TICK);
  sim.queueWalk("a", { x: 4, y: 2 });
  expect(attemptTicks(20)).toEqual([]);
});

test("re-clicking can't attempt faster than the interval", () => {
  addAt("b", 0);
  roll = FAIL;
  const ticks: number[] = [];
  for (let i = 0; i < 9; i++) {
    sim.queueForage("b", BERRY);
    ticks.push(...attemptTicks(1));
  }
  expect(ticks).toEqual([1, 9]);
});

test("clicking another bush can't attempt faster than the interval", () => {
  addAt("b", xpForLevel(10), 5, 2);
  roll = FAIL;
  sim.queueForage("b", BERRY);
  expect(attemptTicks(1)).toEqual([1]);

  sim.queueForage("b", HERB);
  const interval = pickIntervalTicks(10);
  expect(attemptTicks(interval)).toEqual([1 + interval]);
});

test("joining again can't attempt faster than the interval", () => {
  addAt("b", 0);
  const save = sim.saveOf("b")!;
  sim.removePlayer("b");
  sim.addPlayer("first", save, "Ann");
  roll = FAIL;
  sim.queueForage("first", BERRY);
  expect(attemptTicks(1)).toEqual([1]);

  sim.removePlayer("first");
  sim.addPlayer("second", save, "Ann");
  sim.queueForage("second", BERRY);
  expect(attemptTicks(8)).toEqual([9]);
});

test("someone else joining waits for no one's interval", () => {
  addAt("b", 0);
  const save = sim.saveOf("b")!;
  sim.removePlayer("b");
  sim.addPlayer("first", save, "Ann");
  roll = FAIL;
  sim.queueForage("first", BERRY);
  attemptTicks(1);

  sim.removePlayer("first");
  sim.addPlayer("second", save, "Ben");
  sim.queueForage("second", BERRY);
  expect(attemptTicks(1)).toEqual([2]);
});

test("a bush with no reachable tile next to it isn't attempted", () => {
  const walled = parseRegion(
    ["TTTTTTT", "TR.TbTT", "T..TTTT", "TTTTTTT"].join("\n"),
  );
  sim = new Simulation(walled, () => SUCCEED);
  sim.addPlayer("a");
  sim.queueForage("a", "4,1");
  expect(attemptTicks(20)).toEqual([]);
});

test.each([["constructor"], ["1,1"], [5], [null], [{}]])(
  "a bad bush id of %j is ignored",
  (bush) => {
    sim.queueForage("a", bush as string);
    runTicks(3);
    expect(player()).toMatchObject({ x: 1, y: 1 });
  },
);

describe("logging out", () => {
  test("food and Foraging experience survive", () => {
    addAt("b", 0);
    sim.queueForage("b", BERRY);
    runTicks(1);
    const save = sim.saveOf("b")!;
    const later = new Simulation(TILES, () => SUCCEED);
    later.addPlayer("b", save);
    const back = later.state.players.get("b")!;
    expect(back.foragingXp).toBe(10);
    expect(back.inventory[0]).toBe("berry");
  });
});
