import { ENEMIES, enemyHitChance, parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
import { newSave } from "./playerSave.ts";
import { Simulation } from "./simulation.ts";

test("a Cairn warden fights in melee and offsets fifteen points of Avoidance", () => {
  expect(ENEMIES.cairnWarden).toMatchObject({
    health: 4500,
    hitChance: 0.65,
    accuracy: 15,
    maxDamage: 800,
    style: "melee",
    noticeTiles: 4,
    leashTiles: 5,
    bone: { item: "heavyBones", chance: 2 / 3 },
    loot: [],
  });
  expect(enemyHitChance("cairnWarden", 20, "melee")).toBeCloseTo(0.6);
});

test("a Cairn warden notices at four tiles and gives up beyond five", () => {
  const sim = new Simulation(parseRegion("R....u......."), () => 0.99);
  sim.addPlayer("a", newSave({ x: 0, y: 0 }));
  const warden = sim.state.enemies.get("0")!;
  sim.tick();
  expect(warden).toMatchObject({ state: "idle", x: 5 });
  sim.queueWalk("a", { x: 1, y: 0 });
  for (let i = 0; i < 3; i++) sim.tick();
  expect(warden).toMatchObject({ state: "fighting", target: "a" });
  expect(warden.x).toBeLessThan(5);

  sim.queueWalk("a", { x: 11, y: 0 });
  for (let i = 0; i < 25; i++) sim.tick();
  expect(warden).toMatchObject({ state: "idle", x: 5, health: 4500 });
});

test("a Cairn warden leaves an unreachable player alone", () => {
  const sim = new Simulation(parseRegion("R%u"), () => 0.99);
  sim.addPlayer("a", newSave({ x: 0, y: 0 }));
  sim.tick();
  expect(sim.state.enemies.get("0")).toMatchObject({ state: "idle", x: 2 });
});

test.each([
  ["a", 0.66, 2 / 3],
  ["b", 2 / 3, 0.66],
] as const)(
  "only damager %s finds heavy bones when only their roll succeeds",
  (owner, firstRoll, secondRoll) => {
    const rolls = [0, 0, 0.99, 0, 0, 0.99, firstRoll, secondRoll];
    const sim = new Simulation(
      parseRegion("R.u.."),
      () => rolls.shift() ?? 0.99,
    );
    sim.addPlayer("a", newSave({ x: 1, y: 0 }), "a");
    sim.addPlayer("b", newSave({ x: 3, y: 0 }), "b");
    sim.addPlayer("watcher", newSave({ x: 0, y: 0 }), "watcher");
    const warden = sim.state.enemies.get("0")!;
    warden.health = 200;
    sim.queueTarget("a", "0");
    sim.queueTarget("b", "0");
    sim.tick();
    expect(warden.state).toBe("dead");
    expect([...sim.state.groundItems.values()]).toEqual([
      expect.objectContaining({
        item: "heavyBones",
        count: 1,
        owner,
        x: 2,
        y: 0,
      }),
    ]);
  },
);

test("the warden's Accuracy lets it land a swing above its base hit chance", () => {
  const rolls = [0.79, 0.9999];
  const sim = new Simulation(parseRegion("Ru."), () => rolls.shift() ?? 0.99);
  sim.addPlayer("a", newSave({ x: 0, y: 0 }));
  for (let i = 0; i < 4; i++) {
    sim.tick();
    expect(sim.events).not.toContainEqual(
      expect.objectContaining({ type: "enemySwing" }),
    );
  }
  sim.tick();
  expect(sim.events).toContainEqual(
    expect.objectContaining({
      type: "enemySwing",
      enemy: "0",
      player: "a",
      damage: 800,
    }),
  );
  expect(sim.state.players.get("a")!.health).toBe(200);
});
