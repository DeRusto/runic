import { ENEMIES, GROUND_ITEM_OWNER_TICKS, parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
import { newSave } from "./playerSave.ts";
import { Simulation } from "./simulation.ts";

test("a Gorger fights in melee with the middle field's stronger numbers", () => {
  expect(ENEMIES.gorger).toMatchObject({
    health: 1600,
    hitChance: 0.45,
    accuracy: 0,
    maxDamage: 350,
    style: "melee",
    noticeTiles: 3,
    leashTiles: 4,
    firstSwingDelayTicks: 4,
    swingIntervalTicks: 8,
    returnTicks: 200,
    wanderChance: 0.1,
    wanderTiles: 3,
  });
  expect(ENEMIES.gorger.reachTiles).toBeUndefined();
  expect(ENEMIES.gorger.bone).toBeUndefined();
});

test("a Gorger notices at three tiles and gives up when its target crosses the leash", () => {
  const sim = new Simulation(parseRegion("R...y......."), () => 0.99);
  sim.addPlayer("a", newSave({ x: 0, y: 0 }));
  const enemy = sim.state.enemies.get("0")!;
  sim.tick();
  expect(enemy).toMatchObject({ state: "idle", x: 4 });
  sim.queueWalk("a", { x: 1, y: 0 });
  for (let i = 0; i < 3; i++) sim.tick();
  expect(enemy).toMatchObject({ state: "fighting", target: "a" });
  expect(enemy.x).toBeLessThan(4);

  sim.queueWalk("a", { x: 10, y: 0 });
  for (let i = 0; i < 25; i++) sim.tick();
  expect(enemy).toMatchObject({
    state: "idle",
    x: 4,
    target: "",
    health: 1600,
  });
});

test("a Gorger ignores a nearby player it cannot reach", () => {
  const sim = new Simulation(parseRegion("RTy."), () => 0.99);
  sim.addPlayer("a", newSave({ x: 0, y: 0 }));
  sim.tick();
  expect(sim.state.enemies.get("0")).toMatchObject({ state: "idle", x: 2 });
});

test("each damager finds one bag pick on the Gorger's tile, private for a minute", () => {
  const rolls = [0, 0, 0.99, 0, 0, 0.99, 0, 0.99, 0.999];
  const sim = new Simulation(parseRegion("R.y.."), () => rolls.shift() ?? 0.99);
  sim.addPlayer("a", newSave({ x: 1, y: 0 }), "a");
  sim.addPlayer("b", newSave({ x: 3, y: 0 }), "b");
  sim.addPlayer("watcher", newSave({ x: 0, y: 0 }), "watcher");
  const gorger = sim.state.enemies.get("0")!;
  gorger.health = 200;
  sim.queueTarget("a", "0");
  sim.queueTarget("b", "0");
  sim.tick();
  expect(gorger.state).toBe("dead");
  const drops = [...sim.state.groundItems];
  expect(drops.map(([, drop]) => drop)).toEqual([
    expect.objectContaining({
      item: "spiderSilk",
      count: 2,
      owner: "a",
      x: 2,
      y: 0,
    }),
    expect.objectContaining({
      item: "bronzeSword",
      count: 1,
      owner: "b",
      x: 2,
      y: 0,
    }),
  ]);
  for (let i = 0; i < GROUND_ITEM_OWNER_TICKS - 1; i++) sim.tick();
  for (const [id, drop] of drops) {
    expect(sim.canSee(drop.owner, id)).toBe(true);
    expect(sim.canSee("watcher", id)).toBe(false);
    expect(sim.canSee(drop.owner === "a" ? "b" : "a", id)).toBe(false);
  }
  sim.tick();
  for (const [id] of drops) expect(sim.canSee("watcher", id)).toBe(true);
  sim.removePlayer("a");
  sim.removePlayer("b");
  sim.removePlayer("watcher");
  sim.tick();
  expect(gorger).toMatchObject({ state: "idle", health: 1600, x: 2, y: 0 });
});
