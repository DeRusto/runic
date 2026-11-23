import {
  INVENTORY_SLOTS,
  parseRegion,
  respawnTile,
  SHORTCUTS,
  xpForLevel,
  type Tile,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import { findPath } from "./pathfinding.ts";
import { Simulation } from "./simulation.ts";
import { loadWorldRegion } from "./worldRegion.ts";

test("two players share a crossing and clicks are discarded until both land", () => {
  const tiles = parseRegion("TTTTTT\nTR...T\nT....T\nTTTTTT");
  tiles[1]![1] = { ...tiles[1]![1]!, obstacle: "balanceBeam" };
  const sim = new Simulation(tiles, () => 0);
  sim.addPlayer("a");
  sim.addPlayer("b");
  const player = (id: string) => sim.state.players.get(id)!;
  for (const id of ["a", "b"]) sim.queueCross(id, "balanceBeam");
  sim.tick();
  expect(sim.isBusy("a")).toBe(true);
  for (let tick = 0; tick < 4; tick++) {
    sim.queueWalk("a", { x: 2, y: 2 });
    sim.queueLogout("a");
    sim.setStance("a", "precise");
    sim.pinSkill("a", { skill: "Attack", pinned: false });
    expect(player("a")).toMatchObject({ x: 1, y: 1, agilityXp: 0 });
    sim.tick();
  }
  expect(player("a").stance).toBe("balanced");
  expect(player("a").pinnedSkills).toContain("Attack");
  sim.setStance("a", "forceful");
  expect(player("a").stance).toBe("forceful");
  expect(sim.loggedOut).toEqual([]);
  for (const id of ["a", "b"]) {
    expect(sim.isBusy(id)).toBe(false);
    expect(player(id)).toMatchObject({
      x: 3,
      y: 1,
      agilityXp: 30,
      masteryXp: 2,
      masteryHundredths: 10,
    });
  }
  sim.tick();
  expect(player("a")).toMatchObject({ x: 3, y: 1, agilityXp: 30 });
});

test("enemies can hit a player only after the obstacle landing", () => {
  const tiles = parseRegion("TTTTTT\nTR...T\nTK...T\nTTTTTT");
  tiles[1]![1] = { ...tiles[1]![1]!, obstacle: "balanceBeam" };
  const sim = new Simulation(tiles, () => 0);
  sim.addPlayer("a");
  const enemySwung = () =>
    sim.events.some(
      (event) => event.type === "enemySwing" && event.player === "a",
    );
  for (let tick = 0; tick < 10; tick++) sim.tick();
  expect(enemySwung()).toBe(true);

  sim.events.length = 0;
  sim.queueCross("a", "balanceBeam");
  for (let tick = 0; tick < 4; tick++) {
    sim.tick();
    expect(sim.isBusy("a")).toBe(true);
    expect(enemySwung()).toBe(false);
  }
  sim.tick();
  expect(sim.isBusy("a")).toBe(false);
  for (let tick = 0; tick < 10; tick++) sim.tick();
  expect(enemySwung()).toBe(true);
});

test("an out-of-order crossing still earns experience and resets the lap", () => {
  const tiles = parseRegion("TTTTTT\nTR...T\nT....T\nT....T\nT....T\nTTTTTT");
  tiles[1]![1] = { ...tiles[1]![1]!, obstacle: "balanceBeam" };
  tiles[1]![4] = { ...tiles[1]![4]!, obstacle: "hurdle" };
  tiles[4]![4] = { ...tiles[4]![4]!, obstacle: "steppingStones" };
  tiles[4]![1] = { ...tiles[4]![1]!, obstacle: "crawlRail" };
  const sim = new Simulation(tiles, () => 0);
  sim.addPlayer("a");
  const cross = (obstacle: string) => {
    sim.queueCross("a", obstacle);
    for (let tick = 0; tick < 10; tick++) sim.tick();
  };
  const player = sim.state.players.get("a")!;
  cross("balanceBeam");
  cross("steppingStones");
  cross("hurdle");
  cross("steppingStones");
  cross("crawlRail");
  expect(player.agilityXp).toBe(155);
  cross("balanceBeam");
  cross("hurdle");
  cross("steppingStones");
  cross("crawlRail");
  expect(player).toMatchObject({
    agilityXp: 355,
    masteryXp: 24,
    masteryHundredths: 85,
  });
});

test("a new player can walk from the village and complete the Southfield lap", () => {
  const { tiles, pools } = loadWorldRegion();
  const sim = new Simulation(tiles, () => 0.5, pools);
  sim.addPlayer("a");

  for (const obstacle of [
    "balanceBeam",
    "hurdle",
    "steppingStones",
    "crawlRail",
  ]) {
    sim.queueCross("a", obstacle);
    for (let tick = 0; tick < 60; tick++) sim.tick();
  }

  expect(sim.saveOf("a")).toMatchObject({
    x: 36,
    y: 46,
    agilityXp: 200,
    masteryXp: 14,
  });
});

test("invalid and absent obstacles leave the current crossing intent in place", () => {
  const tiles = parseRegion("TTTTTT\nTR...T\nT....T\nTTTTTT");
  tiles[1]![1] = { ...tiles[1]![1]!, obstacle: "balanceBeam" };
  const sim = new Simulation(tiles, () => 0);
  sim.addPlayer("a");

  sim.queueCross("a", "balanceBeam");
  for (const payload of [7, "unknown", "hurdle"]) sim.queueCross("a", payload);
  for (let tick = 0; tick < 5; tick++) sim.tick();

  expect(sim.saveOf("a")).toMatchObject({ x: 3, y: 1, agilityXp: 30 });
});

describe("the region's shortcuts", () => {
  const { tiles, pools } = loadWorldRegion();
  const respawn = respawnTile(tiles);
  /** Each shortcut's placed start and far end, read off the map. */
  const ends = (kind: string) => {
    const found: { start?: Tile; far?: Tile } = {};
    tiles.forEach((row, y) =>
      row.forEach((tile, x) => {
        if (tile.obstacle === kind) found.start = { x, y };
        if (tile.obstacleEnd === kind) found.far = { x, y };
      }),
    );
    return found as { start: Tile; far: Tile };
  };
  const reaches = (from: Tile, to: Tile) => {
    const end = findPath(tiles, from, to).at(-1) ?? from;
    return end.x === to.x && end.y === to.y;
  };

  test.each(SHORTCUTS.map((kind) => [kind]))(
    "%s is placed with its start reachable from the respawn tile",
    (kind) => {
      const { start, far } = ends(kind);
      expect(start).toBeDefined();
      expect(far).toBeDefined();
      expect(reaches(respawn, start)).toBe(true);
    },
  );

  test.each(["brambleSwing", "ruinLedge", "cragLine"])(
    "%s opens a pocket nobody can walk into",
    (kind) => {
      expect(reaches(respawn, ends(kind).far)).toBe(false);
    },
  );

  test.each(["ridgeStile", "charredFence"])(
    "%s cuts a walk of more than 40 steps short",
    (kind) => {
      const { start, far } = ends(kind);
      expect(reaches(start, far)).toBe(true);
      expect(findPath(tiles, start, far).length).toBeGreaterThan(40);
    },
  );

  test("a player can cross into a rigged pocket and back out", () => {
    const sim = new Simulation(tiles, () => 0.99, pools);
    const { start, far } = ends("cragLine");
    sim.addPlayer("a", {
      ...start,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      agilityXp: xpForLevel(60),
      health: 1000,
      inventory: ["rope", ...Array<string>(INVENTORY_SLOTS - 1).fill("")],
      inventoryCounts: [1],
    });
    sim.queueCross("a", "cragLine");
    for (let tick = 0; tick < 10; tick++) sim.tick();
    expect(sim.saveOf("a")).toMatchObject({
      ...far,
      riggedShortcuts: ["cragLine"],
    });
    sim.queueCross("a", "cragLine");
    for (let tick = 0; tick < 10; tick++) sim.tick();
    expect(sim.saveOf("a")).toMatchObject(start);
  });
});

test.each([
  [
    { x: 9, y: 32 },
    { x: 9, y: 35 },
  ],
  [
    { x: 121, y: 31 },
    { x: 119, y: 31 },
  ],
])(
  "a level-1 save from before the shortcuts on %o, now in a pocket, loads at %o outside it",
  (saved, loaded) => {
    const { tiles, pools } = loadWorldRegion();
    const sim = new Simulation(tiles, () => 0.5, pools);
    sim.addPlayer("a", {
      ...saved,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health: 1000,
      inventory: Array<string>(INVENTORY_SLOTS).fill(""),
    });
    expect(sim.saveOf("a")).toMatchObject(loaded);
  },
);
