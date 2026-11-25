import { ENEMIES, parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
import { newSave } from "./playerSave.ts";
import { Simulation } from "./simulation.ts";

test("the Fenwing has the stats of an early melee fight", () => {
  expect(ENEMIES.fenwing).toMatchObject({
    health: 500,
    hitChance: 0.3,
    accuracy: 0,
    maxDamage: 150,
    style: "melee",
    leashTiles: 3,
  });
  expect(ENEMIES.fenwing.reachTiles).toBeUndefined();
});

test("a Fenwing lets a player pass, then strikes back in melee when hit", () => {
  let roll = 0.99;
  const sim = new Simulation(parseRegion("R...j.."), () => roll);
  sim.addPlayer("a", newSave({ x: 0, y: 0 }));
  const enemy = sim.state.enemies.get("0")!;
  sim.queueWalk("a", { x: 3, y: 0 });
  for (let i = 0; i < 10; i++) sim.tick();
  expect(enemy).toMatchObject({ state: "idle", health: 500 });
  expect(sim.state.players.get("a")).toMatchObject({ x: 3, health: 1000 });

  roll = 0.2;
  sim.queueTarget("a", "0");
  sim.tick();
  expect(enemy.health).toBeLessThan(500);
  expect(enemy).toMatchObject({ state: "fighting", target: "a", x: 4 });
  for (let i = 0; i < 3; i++) {
    sim.tick();
    expect(sim.events).not.toContainEqual(
      expect.objectContaining({ type: "enemySwing" }),
    );
  }
  sim.tick();
  expect(sim.events).toContainEqual(
    expect.objectContaining({ type: "enemySwing", enemy: "0", player: "a" }),
  );
});
