import { parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
import { newSave } from "./playerSave.ts";
import { Simulation } from "./simulation.ts";

test("Prayer starts full and restores one missing point every twenty ticks after login", () => {
  const sim = new Simulation(parseRegion("TTTTT\nTR..T\nTTTTT"), () => 0);
  sim.addPlayer("new");
  const fresh = sim.state.players.get("new")!;
  expect(fresh.prayerXp).toBe(0);
  expect(fresh.prayerPoints).toBe(10);

  sim.addPlayer("a", { ...newSave({ x: 1, y: 1 }), prayerPoints: 8 });
  const player = sim.state.players.get("a")!;
  for (let i = 0; i < 19; i++) sim.tick();
  expect(player.prayerPoints).toBe(8);
  sim.tick();
  expect(player.prayerPoints).toBe(9);
  const saved = sim.saveOf("a")!;
  sim.removePlayer("a");
  sim.addPlayer("returning", saved);
  const returning = sim.state.players.get("returning")!;
  expect(returning.prayerPoints).toBe(9);
  for (let i = 0; i < 40; i++) sim.tick();
  expect(returning.prayerPoints).toBe(10);
});

test("burying takes one bone per click and shares seven percent with Mastery", () => {
  const sim = new Simulation(parseRegion("TTTTT\nTR..T\nTTTTT"), () => 0);
  sim.addPlayer("a", {
    ...newSave({ x: 1, y: 1 }),
    prayerXp: 45,
    inventory: ["bones", "heavyBones"],
    inventoryCounts: [2, 1],
  });
  const player = sim.state.players.get("a")!;
  sim.queueBury("a", 0);
  sim.tick();
  sim.tick();
  expect(player.prayerXp).toBe(45);
  expect(player.inventoryCounts[0]).toBe(2);
  sim.tick();
  expect(player.prayerXp).toBe(50);
  expect(player.inventoryCounts[0]).toBe(1);
  expect(player.inventory[0]).toBe("bones");
  expect(player.masteryHundredths).toBe(35);
  expect(player.prayerPoints).toBe(10);

  sim.queueBury("a", 1);
  for (let i = 0; i < 17; i++) sim.tick();
  expect(player.inventory[1]).toBe("");
  expect(player.inventoryCounts[1]).toBe(0);
  expect(player.prayerXp).toBe(63);
  expect(player.masteryXp).toBe(1);
  expect(player.masteryHundredths).toBe(26);
  expect(player.prayerPoints).toBe(11);
  expect(sim.saveOf("a")).toMatchObject({ prayerXp: 63, prayerPoints: 11 });
});

test("walking interrupts burial and only the latest burial click counts", () => {
  const sim = new Simulation(parseRegion("TTTTT\nTR..T\nTTTTT"), () => 0);
  sim.addPlayer("a", {
    ...newSave({ x: 1, y: 1 }),
    inventory: ["bones", "heavyBones", "rope"],
  });
  const player = sim.state.players.get("a")!;
  sim.queueBury("a", 0);
  sim.tick();
  sim.queueWalk("a", { x: 2, y: 1 });
  for (let i = 0; i < 3; i++) sim.tick();
  expect(player.prayerXp).toBe(0);
  expect(player.inventory[0]).toBe("bones");

  sim.queueBury("a", 0);
  sim.tick();
  sim.queueBury("a", 1);
  for (let i = 0; i < 3; i++) sim.tick();
  expect(player.prayerXp).toBe(13);
  expect(player.inventory[0]).toBe("bones");

  sim.queueBury("a", 2);
  sim.queueBury("a", -1);
  for (let i = 0; i < 3; i++) sim.tick();
  expect(player.prayerXp).toBe(13);
  expect(player.inventory[2]).toBe("rope");
});

test("a burial never consumes a different item moved into the selected slot", () => {
  const sim = new Simulation(parseRegion("TTTTT\nTR..T\nTTTTT"), () => 0);
  sim.addPlayer("a", {
    ...newSave({ x: 1, y: 1 }),
    inventory: ["bones", "heavyBones"],
  });
  const player = sim.state.players.get("a")!;
  sim.queueBury("a", 0);
  sim.tick();
  sim.moveItem("a", 0, 1);
  sim.tick();
  sim.tick();
  expect([...player.inventory]).toEqual(["heavyBones", "bones"]);
  expect(player.prayerXp).toBe(0);
});

test("a living player can finish burying even when an enemy swings at them", () => {
  const sim = new Simulation(parseRegion("TTTTT\nTRS.T\nTTTTT"), () => 0.99);
  sim.addPlayer("a", {
    ...newSave({ x: 1, y: 1 }),
    inventory: ["bones"],
  });
  sim.queueTarget("a", "0");
  for (let i = 0; i < 3; i++) sim.tick();
  sim.queueBury("a", 0);
  for (let i = 0; i < 3; i++) sim.tick();
  expect(sim.events).toContainEqual(
    expect.objectContaining({ type: "enemySwing", player: "a" }),
  );
  expect(sim.state.players.get("a")!.prayerXp).toBe(5);
});
