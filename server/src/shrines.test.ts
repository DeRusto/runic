import { parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
import { newSave } from "./playerSave.ts";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const shrine = { x: 5, y: 1 };
const beside = { x: 4, y: 1 };

function shrineGame(save: Partial<PlayerSave> = {}) {
  const sim = new Simulation(
    parseRegion("TTTTTTTTT\nTR...p..T\nTTTTTTTTT"),
    () => 0,
  );
  sim.addPlayer("a", { ...newSave(beside), ...save });
  const tick = (count = 1) => {
    for (let i = 0; i < count; i++) sim.tick();
  };
  return { sim, tick, player: sim.state.players.get("a")! };
}

test("praying walks to the shrine and refills each tick on arrival without paying experience", () => {
  const { sim, tick, player } = shrineGame({
    x: 1,
    prayerXp: 8450,
    prayerPoints: 0,
  });
  sim.queuePray("a", shrine);
  tick();
  expect(player.prayerPoints).toBe(0);
  while (player.x < beside.x) tick();
  expect(player.prayerPoints).toBe(20);
  tick();
  expect(player.prayerPoints).toBe(40);
  tick(30);
  expect(player.prayerPoints).toBe(140);
  expect(player.prayerXp).toBe(8450);
  expect(player.action).toBe("");
});

test("walking away interrupts praying, which can be shared with another player", () => {
  const { sim, tick, player } = shrineGame({ prayerXp: 8450, prayerPoints: 0 });
  sim.addPlayer("b", { ...newSave({ x: 6, y: 1 }), prayerPoints: 0 });
  sim.queuePray("a", shrine);
  sim.queuePray("b", shrine);
  tick();
  expect(player.prayerPoints).toBe(20);
  expect(sim.state.players.get("b")!.prayerPoints).toBe(10);
  sim.queueWalk("a", { x: 3, y: 1 });
  tick(4);
  expect(player).toMatchObject({ x: 3, prayerPoints: 20 });
});

test("offering takes one bone every two ticks in bag order and awards Prayer and Mastery", () => {
  const { sim, tick, player } = shrineGame({
    inventory: ["heavyBones", "rope", "bones", "heavyBones"],
    inventoryCounts: [1, 1, 2, 1],
  });
  sim.queueOfferBones("a", shrine);
  tick(2);
  expect(player.prayerXp).toBe(0);
  tick();
  expect(player.prayerXp).toBe(40);
  expect(player.inventory[0]).toBe("");
  tick(2);
  expect(player.prayerXp).toBe(55);
  expect(player.inventoryCounts[2]).toBe(1);
  tick(2);
  expect(player.prayerXp).toBe(70);
  tick(2);
  expect([...player.inventory]).toEqual(["", "rope", "", ""]);
  expect(player).toMatchObject({
    prayerXp: 110,
    masteryXp: 7,
    masteryHundredths: 70,
  });
  tick(3);
  expect(sim.events).not.toContainEqual(
    expect.objectContaining({ type: "told" }),
  );
});

test.each(["walk", "pray"])(
  "a new %s intent stops offering before the next bone",
  (next) => {
    const { sim, tick, player } = shrineGame({
      inventory: ["bones"],
      inventoryCounts: [2],
    });
    sim.queueOfferBones("a", shrine);
    tick(3);
    if (next === "walk") sim.queueWalk("a", { x: 3, y: 1 });
    else sim.queuePray("a", shrine);
    tick(4);
    expect(player.prayerXp).toBe(15);
    expect(player.inventoryCounts[0]).toBe(1);
  },
);

test("an empty bag is refused before walking, and an invented shrine is ignored", () => {
  const { sim, tick, player } = shrineGame({
    x: 1,
    inventory: ["rope"],
    prayerPoints: 0,
  });
  sim.queueOfferBones("a", shrine);
  tick();
  expect(player.x).toBe(1);
  expect(sim.events).toContainEqual({
    type: "told",
    player: "a",
    line: "You have no bones to offer.",
  });
  sim.queuePray("a", beside);
  sim.queuePray("a", { x: 5.5, y: 1 });
  tick(8);
  expect(player).toMatchObject({ x: 1, prayerPoints: 0, prayerXp: 0 });
});

test("the Cairns shrine refills like the village one", () => {
  const sim = new Simulation(parseRegion("TTTTT\nTR.+T\nTTTTT"), () => 0);
  sim.addPlayer("a", { ...newSave({ x: 2, y: 1 }), prayerPoints: 0 });
  sim.queuePray("a", { x: 3, y: 1 });
  sim.tick();
  expect(sim.state.players.get("a")!.prayerPoints).toBe(10);
});
