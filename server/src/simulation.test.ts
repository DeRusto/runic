import { parseRegion } from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1); a wall splits off the tile at (5,1).
const TILES = parseRegion(
  ["TTTTTTT", "TR..T.T", "T...T.T", "TTTTTTT"].join("\n"),
);

let sim: Simulation;

beforeEach(() => {
  sim = new Simulation(TILES, () => 0);
  sim.addPlayer("a");
});

const tile = (id = "a") => {
  const { x, y } = sim.state.players.get(id)!;
  return { x, y };
};

const runTicks = (count: number) => {
  for (let i = 0; i < count; i++) sim.tick();
};

test("a new player stands on the respawn tile", () => {
  expect(tile()).toEqual({ x: 1, y: 1 });
});

test("a tick counts itself", () => {
  runTicks(3);
  expect(sim.state.tick).toBe(3);
});

test("a walk intent does nothing until the next tick, which takes the first step", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  expect(tile()).toEqual({ x: 1, y: 1 });
  runTicks(1);
  expect(tile()).toEqual({ x: 2, y: 1 });
});

test("a player walks one tile every 2 ticks and stops on arrival", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  const tiles = Array.from({ length: 6 }, () => {
    sim.tick();
    return tile().x;
  });
  expect(tiles).toEqual([2, 2, 3, 3, 3, 3]);
});

test("a newer click replaces the current walk", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  runTicks(2);
  sim.queueWalk("a", { x: 1, y: 2 });
  runTicks(5);
  expect(tile()).toEqual({ x: 1, y: 2 });
});

test("of two clicks in one tick, the later wins", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  sim.queueWalk("a", { x: 1, y: 2 });
  runTicks(1);
  expect(tile()).toEqual({ x: 1, y: 2 });
});

test("clicking every tick can't walk faster than a tile every 2 ticks", () => {
  for (const x of [3, 1, 3, 1]) {
    sim.queueWalk("a", { x, y: 1 });
    runTicks(1);
  }
  // Steps land only on the 1st and 3rd of these 4 ticks, both heading for x = 3.
  expect(tile()).toEqual({ x: 3, y: 1 });
});

test("a click on an unreachable tile walks to the nearest reachable one", () => {
  sim.queueWalk("a", { x: 5, y: 1 });
  runTicks(10);
  expect(tile()).toEqual({ x: 3, y: 1 });
});

test.each([
  ["off the grid", { x: 7, y: 1 }],
  ["negative", { x: -1, y: 1 }],
  ["fractional", { x: 1.5, y: 1 }],
  ["inherited keys", { x: "length", y: 0 }],
  ["inherited keys on the row", { x: "name", y: "constructor" }],
  ["no coordinates", {}],
  ["null", null],
  ["not an object", "walk"],
])(
  "an invalid walk intent is ignored and keeps the current walk: %s",
  (_, bad) => {
    sim.queueWalk("a", { x: 3, y: 1 });
    sim.queueWalk("a", bad as never);
    runTicks(10);
    expect(tile()).toEqual({ x: 3, y: 1 });
  },
);

test("an intent from someone not in the region is ignored", () => {
  sim.queueWalk("ghost", { x: 3, y: 1 });
  runTicks(2);
  expect(sim.state.players.has("ghost")).toBe(false);
});

test("players walk independently and can share a tile", () => {
  sim.addPlayer("b");
  sim.queueWalk("a", { x: 2, y: 1 });
  sim.queueWalk("b", { x: 2, y: 2 });
  runTicks(1);
  expect(tile("a")).toEqual({ x: 2, y: 1 });
  expect(tile("b")).toEqual({ x: 2, y: 2 });
  sim.queueWalk("b", { x: 2, y: 1 });
  runTicks(2);
  expect(tile("b")).toEqual({ x: 2, y: 1 });
});

test("a player who leaves mid-walk is gone, along with their queued intent", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  sim.removePlayer("a");
  runTicks(4);
  expect(sim.state.players.has("a")).toBe(false);
});
