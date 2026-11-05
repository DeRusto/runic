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

const EMPTY_INVENTORY = Array<string>(30).fill("");

test("a new account starts on the respawn tile with an empty inventory, Hitpoints 10 and 10 health", () => {
  expect(sim.saveOf("a")).toEqual({
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    health: 10,
    inventory: EMPTY_INVENTORY,
  });
});

const SAVED = {
  x: 2,
  y: 2,
  combatXp: 1,
  defenseXp: 2,
  foragingXp: 3,
  hitpointsXp: 4100,
  health: 7,
  inventory: ["berry", ...EMPTY_INVENTORY.slice(1)],
};

test("a returning player comes back exactly as saved", () => {
  sim.addPlayer("b", SAVED);
  expect(sim.saveOf("b")).toEqual(SAVED);
});

test.each([
  ["now blocks", { x: 0, y: 0 }],
  ["is off the grid", { x: 200, y: 200 }],
])(
  "a saved tile that %s becomes the respawn tile, and the rest is kept",
  (_, tile) => {
    sim.addPlayer("b", { ...SAVED, ...tile });
    expect(sim.saveOf("b")).toEqual({ ...SAVED, x: 1, y: 1 });
  },
);

test("max health is the Hitpoints level, whatever the health left", () => {
  sim.addPlayer("b", { ...SAVED, hitpointsXp: 7200, health: 3 });
  const player = sim.state.players.get("b")!;
  expect(player.maxHealth).toBe(13);
  expect(player.health).toBe(3);
  expect(sim.state.players.get("a")!.maxHealth).toBe(10);
});

test("a save has the tile the player walked to", () => {
  sim.queueWalk("a", { x: 2, y: 1 });
  runTicks(1);
  expect(sim.saveOf("a")).toMatchObject({ x: 2, y: 1 });
});

test("a player who is gone has no save", () => {
  sim.removePlayer("a");
  expect(sim.saveOf("a")).toBeUndefined();
});

test("a log out intent applies at the next tick, once", () => {
  sim.queueLogout("a");
  expect(sim.loggedOut).toEqual([]);
  runTicks(2);
  expect(sim.loggedOut).toEqual(["a"]);
});

test("a log out intent from someone no longer in the region is ignored", () => {
  sim.queueLogout("ghost");
  sim.queueLogout("a");
  sim.removePlayer("a");
  runTicks(1);
  expect(sim.loggedOut).toEqual([]);
});
