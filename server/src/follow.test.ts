import { parseRegion, siteId } from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), so two new players start on the same tile.
const TILES = parseRegion(
  ["TTTTTTTT", "TR.....T", "T......T", "TTTTTTTT"].join("\n"),
);

let sim: Simulation;

beforeEach(() => {
  sim = new Simulation(TILES, () => 0);
  sim.addPlayer("a", undefined, "Ann");
  sim.addPlayer("b", undefined, "Bob");
});

const tile = (id: string) => {
  const { x, y } = sim.state.players.get(id)!;
  return { x, y };
};

const runTicks = (count: number) => {
  for (let i = 0; i < count; i++) sim.tick();
};

/** One legal step apart, which is never the same tile. */
const adjacent = (a: string, b: string) => {
  const [p, q] = [tile(a), tile(b)];
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)) === 1;
};

test("a follower steps off the target's tile and walks after them, stopping next to them", () => {
  sim.follow("a", "b");
  runTicks(1);
  expect(adjacent("a", "b")).toBe(true);
  sim.queueWalk("b", { x: 6, y: 1 });
  runTicks(14);
  expect(tile("b")).toEqual({ x: 6, y: 1 });
  expect(adjacent("a", "b")).toBe(true);
  expect(sim.following("a")).toBe("b");
});

test("a manual walk ends following", () => {
  sim.follow("a", "b");
  runTicks(1);
  sim.queueWalk("a", { x: 1, y: 2 });
  runTicks(1);
  expect(sim.following("a")).toBeUndefined();
  sim.queueWalk("b", { x: 6, y: 1 });
  runTicks(14);
  expect(tile("a")).toEqual({ x: 1, y: 2 });
});

test("/unfollow ends following, and the follower stays put", () => {
  sim.follow("a", "b");
  runTicks(1);
  const stopped = tile("a");
  sim.unfollow("a");
  sim.queueWalk("b", { x: 6, y: 1 });
  runTicks(14);
  expect(sim.following("a")).toBeUndefined();
  expect(tile("a")).toEqual(stopped);
});

test("following someone new switches target, and chains work", () => {
  sim.addPlayer("c", undefined, "Cat");
  sim.follow("a", "b");
  runTicks(1);
  sim.follow("a", "c");
  sim.follow("b", "c");
  runTicks(1);
  expect(sim.following("a")).toBe("c");
  expect(sim.following("b")).toBe("c");
});

test("the target leaving ends following", () => {
  sim.follow("a", "b");
  runTicks(1);
  sim.removePlayer("b");
  runTicks(4);
  expect(sim.following("a")).toBeUndefined();
});

test("a target who leaves before the tick is never followed", () => {
  sim.follow("a", "b");
  sim.removePlayer("b");
  runTicks(1);
  expect(sim.following("a")).toBeUndefined();
});

describe("death ends following", () => {
  // A Spider on (2,1), next to the respawn tile; every roll hits for the most.
  beforeEach(() => {
    sim = new Simulation(
      parseRegion(["TTTTTTT", "TRS...T", "T.....T", "TTTTTTT"].join("\n")),
      () => 0,
    );
    sim.addPlayer("a", undefined, "Ann");
    sim.addPlayer("b", undefined, "Bob");
    sim.follow("a", "b");
  });
  /** The Spider swings at `id`, at 1 health, on the tick following starts. */
  const killNextTick = (id: string) => {
    Object.assign(sim.state.enemies.get("0")!, {
      state: "fighting",
      target: id,
    });
    sim.state.players.get(id)!.health = 1;
  };

  test("the target's", () => {
    killNextTick("b");
    runTicks(1);
    expect(sim.state.players.get("b")!.dead).toBe(true);
    expect(sim.following("a")).toBeUndefined();
  });

  test("the follower's", () => {
    killNextTick("a");
    runTicks(1);
    expect(sim.state.players.get("a")!.dead).toBe(true);
    expect(sim.following("a")).toBeUndefined();
  });
});

test("a dead player can't follow", () => {
  sim.state.players.get("a")!.dead = true;
  sim.follow("a", "b");
  runTicks(1);
  expect(sim.following("a")).toBeUndefined();
});

test("a dead target can't be followed", () => {
  sim.state.players.get("b")!.dead = true;
  sim.follow("a", "b");
  runTicks(1);
  expect(sim.following("a")).toBeUndefined();
});

test("a follow counts from the moment it is queued, before its tick", () => {
  sim.follow("a", "b");
  expect(sim.following("a")).toBe("b");
  sim.unfollow("a");
  expect(sim.following("a")).toBeUndefined();
  runTicks(1);
  expect(sim.following("a")).toBeUndefined();
});

describe("a gather or a fight ends following", () => {
  // A berry bush on (6,2) and a Spider on (6,1), both well away from the respawn tile.
  beforeEach(() => {
    sim = new Simulation(
      parseRegion(["TTTTTTTT", "TR....ST", "T.....bT", "TTTTTTTT"].join("\n")),
      () => 0,
    );
    sim.addPlayer("a", undefined, "Ann");
    sim.addPlayer("b", undefined, "Bob");
    sim.follow("a", "b");
    runTicks(1);
  });

  test("a gather", () => {
    sim.queueGather("a", "foraging", siteId({ x: 6, y: 2 }));
    runTicks(1);
    expect(sim.following("a")).toBeUndefined();
  });

  test("a fight", () => {
    sim.queueTarget("a", "0");
    runTicks(1);
    expect(sim.following("a")).toBeUndefined();
  });
});
