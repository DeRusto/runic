import { parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
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
    expect(player("a")).toMatchObject({ x: 1, y: 1, agilityXp: 0 });
    sim.tick();
  }
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
  sim.queueCross("a", "balanceBeam");
  for (let tick = 0; tick < 4; tick++) sim.tick();
  expect(sim.events.some(({ type }) => type === "enemySwing")).toBe(false);
  expect(sim.state.players.get("a")!.health).toBe(1000);
  for (let tick = 0; tick < 10; tick++) sim.tick();
  expect(sim.events.some(({ type }) => type === "enemySwing")).toBe(true);
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
