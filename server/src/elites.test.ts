import { Decoder, Encoder } from "@colyseus/schema";
import { parseRegion, type EnemyKind } from "@runic/shared";
import { expect, test } from "vitest";
import { newSave } from "./playerSave.ts";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";
import { WorldState } from "./worldState.ts";

function encounter(glyph: string, kind?: EnemyKind) {
  let roll = 0;
  const rolls: number[] = [];
  const tiles = parseRegion(`TR${glyph}........T`);
  if (kind) tiles[0]![2]!.enemy = kind;
  const sim = new Simulation(tiles, () => rolls.shift() ?? roll);
  const enemy = sim.state.enemies.get("0")!;
  const add = (id: string, x = 1, save: Partial<PlayerSave> = {}) => {
    sim.addPlayer(
      id,
      {
        ...newSave({ x, y: 0 }),
        health: 9000,
        hitpointsXp: 400_000,
        ...save,
      },
      id,
    );
    return sim.state.players.get(id)!;
  };
  const advanceUntil = (type: "enemyDied" | "enemyReturned") => {
    for (let i = 0; i < 300; i++) {
      sim.tick();
      if (sim.events.splice(0).some((event) => event.type === type)) return;
    }
    throw new Error(`No ${type} event`);
  };
  const kill = (id: string) => {
    roll = 0;
    sim.queueTarget(id, "0");
    advanceUntil("enemyDied");
  };
  const returnWith = (value: number) => {
    roll = value;
    advanceUntil("enemyReturned");
  };
  return {
    sim,
    enemy,
    add,
    kill,
    returnWith,
    rolls,
    setRoll: (value: number) => {
      roll = value;
    },
  };
}

test.each(Array.from({ length: 20 }, (_, i) => i / 20))(
  "a Fenwing starts ordinary and returns according to the roll %f",
  (roll) => {
    const { enemy, add, kill, returnWith } = encounter("j");
    expect(enemy).toMatchObject({ elite: false, health: 500, maxHealth: 500 });
    add("a");
    kill("a");
    returnWith(roll);
    expect(enemy).toMatchObject({
      elite: roll === 0,
      health: roll === 0 ? 1000 : 500,
      maxHealth: roll === 0 ? 1000 : 500,
    });
  },
);

test("a Tarn Ox returns ordinary even on a roll of zero", () => {
  const { enemy, add, kill, returnWith } = encounter("X");
  add("a");
  kill("a");
  returnWith(0);
  expect(enemy).toMatchObject({ elite: false, health: 200, maxHealth: 200 });
});

test("the elite flag and its own maximum health are sent to clients", () => {
  const { sim, add, kill, returnWith } = encounter("j");
  const encoder = new Encoder(sim.state);
  const state = new WorldState();
  const decoder = new Decoder(state);
  decoder.decode(encoder.encodeAll());
  expect(state.enemies.get("0")).toMatchObject({
    elite: false,
    maxHealth: 500,
  });
  add("a");
  kill("a");
  returnWith(0.04999);
  decoder.decode(encoder.encode());
  expect(state.enemies.get("0")).toMatchObject({
    elite: true,
    health: 1000,
    maxHealth: 1000,
  });
});

test("an elite keeps its doubled health through leashing, then rolls again on its next return", () => {
  const { sim, enemy, add, kill, returnWith, setRoll } = encounter("j");
  const player = add("a");
  kill("a");
  returnWith(0);
  sim.queueTarget("a", "0");
  sim.tick();
  expect(enemy.health).toBeLessThan(1000);
  expect(enemy.state).toBe("fighting");
  setRoll(0.99);
  sim.queueWalk("a", { x: 9, y: 0 });
  for (let i = 0; i < 30; i++) sim.tick();
  expect(player.x).toBe(9);
  expect(enemy).toMatchObject({
    x: 2,
    elite: true,
    health: 1000,
    state: "idle",
  });
  kill("a");
  returnWith(0.05);
  expect(enemy).toMatchObject({ elite: false, health: 500, maxHealth: 500 });
});

test("an elite Fenwing lands on 39 percent and can hit for 188", () => {
  const { sim, add, kill, returnWith, rolls } = encounter("j");
  add("a");
  kill("a");
  returnWith(0);
  sim.queueTarget("a", "0");
  for (let i = 0; i < 4; i++) sim.tick();
  rolls.push(0.39, 0.9999, 0.1);
  sim.tick();
  expect(sim.events.filter(({ type }) => type === "enemySwing")).toMatchObject([
    { damage: 188, critical: false },
  ]);
});

test.each([
  ["j", "swing"],
  ["I", "shot"],
] as const)("an elite %s reports a critical %s", (glyph, attack) => {
  const { sim, add, kill, returnWith, rolls } = encounter(glyph);
  const player = add("a", attack === "shot" ? 3 : 1);
  kill("a");
  returnWith(0);
  sim.queueTarget("a", "0");
  sim.tick();
  // The Thornling can still shoot after its target steps out of melee reach.
  if (attack === "shot") sim.queueWalk("a", { x: 4, y: 0 });
  for (let i = 0; i < 3; i++) sim.tick();
  if (attack === "shot") expect(player.x).toBe(4);
  const health = player.health;
  rolls.push(0, 0, 0);
  sim.tick();
  expect(sim.events.filter(({ type }) => type === "enemySwing")).toMatchObject([
    { enemy: "0", player: "a", damage: 150, blocked: false, critical: true },
  ]);
  expect(player.health).toBe(health - 150);
});

test("an elite Fenwing gives twice the Hitpoints experience through damage", () => {
  const { add, kill, returnWith } = encounter("j");
  const player = add("a");
  const before = player.hitpointsXp;
  kill("a");
  expect(player.hitpointsXp - before).toBe(30);
  returnWith(0);
  const ordinaryXp = player.hitpointsXp;
  kill("a");
  expect(player.hitpointsXp - ordinaryXp).toBe(60);
});

test("each damager gets two bag picks from an elite Gorger", () => {
  const { sim, add, kill, returnWith } = encounter("y");
  add("a");
  kill("a");
  returnWith(0);
  const old = new Set(sim.state.groundItems.keys());
  add("b", 3);
  sim.queueTarget("b", "0");
  kill("a");
  const drops = [...sim.state.groundItems]
    .filter(([id]) => !old.has(id))
    .map(([, { owner, item, count }]) => [owner, item, count]);
  expect(drops.sort()).toEqual([
    ["a", "spiderSilk", 1],
    ["a", "spiderSilk", 1],
    ["b", "spiderSilk", 1],
    ["b", "spiderSilk", 1],
  ]);
});

test("an elite Mage gives one sigil to each damager on the offering and heavy bones to both", () => {
  const { sim, add, kill, returnWith } = encounter("Z");
  add("a", 1, { quests: { hollisRunes: { stage: "offering", turns: 0 } } });
  kill("a");
  returnWith(0);
  const old = new Set(sim.state.groundItems.keys());
  add("b", 3);
  sim.queueTarget("b", "0");
  kill("a");
  const loot = [...sim.state.groundItems]
    .filter(([id]) => !old.has(id))
    .map(([, { owner, item }]) => [owner, item]);
  expect(loot.sort()).toEqual([
    ["a", "boneSigil"],
    ["a", "heavyBones"],
    ["b", "heavyBones"],
  ]);
});

test("an elite Imp leaves nothing", () => {
  const { sim, add, kill, returnWith } = encounter("I", "imp");
  add("a");
  kill("a");
  returnWith(0);
  kill("a");
  expect(sim.state.groundItems.size).toBe(0);
});

test("an elite Mage still notices at three tiles, stands to shoot, and leashes at four", () => {
  const { sim, enemy, add, kill, returnWith, setRoll } = encounter("Z");
  add("first");
  kill("first");
  sim.removePlayer("first");
  returnWith(0);
  add("a", 6);
  setRoll(0.99);
  sim.tick();
  expect(enemy).toMatchObject({ x: 2, target: "", state: "idle" });
  sim.queueWalk("a", { x: 5, y: 0 });
  sim.tick();
  expect(enemy).toMatchObject({ x: 2, target: "a", state: "fighting" });
  sim.queueWalk("a", { x: 6, y: 0 });
  for (let i = 0; i < 4; i++) sim.tick();
  expect(enemy.x).toBe(2);
  expect(sim.events).toContainEqual(
    expect.objectContaining({ type: "enemySwing", player: "a" }),
  );
  sim.queueWalk("a", { x: 7, y: 0 });
  for (let i = 0; i < 3; i++) sim.tick();
  expect(enemy).toMatchObject({
    x: 2,
    target: "",
    state: "idle",
    elite: true,
    health: 6400,
  });
});
