import { parseRegion, type WorldEvent } from "@runic/shared";
import { expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const HIT = 0;
const MISS = 0.99;
const WIN = 0.2499;
const LOSE = 0.25;
/** The hit roll, the damage roll and the crit roll of a swing doing 100 damage. */
const SWING = [HIT, HIT, MISS];

// The Skeleton's home is (8,1), with players either side of it.
const CORRIDOR = [
  "TTTTTTTTTTTTTTTTTTTT",
  "TR......K..........T",
  "TTTTTTTTTTTTTTTTTTTT",
];
const SPIDER = ["TTTTTTTTTT", "TR......ST", "TTTTTTTTTT"];

const SAVE: PlayerSave = {
  x: 7,
  y: 1,
  combatXp: 0,
  defenseXp: 0,
  foragingXp: 0,
  hitpointsXp: 4050,
  health: 1000,
  inventory: Array<string>(30).fill(""),
};

/** Rolls come in order, and then everything misses. */
function world(rows: string[]) {
  const rolls: number[] = [];
  const s = new Simulation(
    parseRegion(rows.join("\n")),
    () => rolls.shift() ?? MISS,
  );
  return { s, rolls };
}

const enemy = (s: Simulation) => s.state.enemies.get("0")!;
/** Emberbones on the ground owned by the player with this username, who is also its id here. */
const bones = (s: Simulation, id: string) =>
  [...s.state.groundItems.values()].filter(
    ({ item, owner }) => item === "emberbone" && owner === id,
  ).length;

function run(s: Simulation, ticks = 1) {
  const seen: WorldEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    s.tick();
    seen.push(...s.events.splice(0));
  }
  return seen;
}

const toldTo = (events: WorldEvent[], id: string) =>
  events.flatMap((e) => (e.type === "told" && e.player === id ? [e.line] : []));

/** "a" swings once and "b" lands the killing blow, each doing 1 damage. */
function killedByTwo(rolls: number[], s: Simulation, ...bones: number[]) {
  s.addPlayer("a", SAVE, "a");
  s.addPlayer("b", { ...SAVE, x: 9 }, "b");
  enemy(s).health = 200;
  rolls.push(...SWING, ...SWING, ...bones);
  s.queueTarget("a", "0");
  s.queueTarget("b", "0");
}

test("each player who damaged it rolls their own 1 in 4", () => {
  const { s, rolls } = world(CORRIDOR);
  killedByTwo(rolls, s, LOSE, WIN);
  const events = run(s);
  expect(enemy(s).state).toBe("dead");
  expect(bones(s, "a")).toBe(0);
  expect(bones(s, "b")).toBe(1);
  expect(toldTo(events, "a")).toEqual([]);
  expect(toldTo(events, "b")).toEqual([
    "You find an Emberbone. It is on the ground.",
  ]);
});

test("a win lands on the Skeleton's tile, not in the inventory", () => {
  const { s, rolls } = world(CORRIDOR);
  killedByTwo(rolls, s, LOSE, WIN);
  run(s);
  expect([...s.state.groundItems.values()]).toEqual([
    expect.objectContaining({ x: 8, y: 1, item: "emberbone", count: 1 }),
  ]);
  expect(s.state.players.get("b")!.inventory).not.toContain("emberbone");
});

test("two winners each get their own, seen only by its owner at first", () => {
  const { s, rolls } = world(CORRIDOR);
  killedByTwo(rolls, s, WIN, WIN);
  run(s);
  const seenBy = (id: string) =>
    [...s.state.groundItems.keys()].filter((g) => s.canSee(id, g));
  expect(seenBy("a")).toHaveLength(1);
  expect(seenBy("b")).toHaveLength(1);
  expect(seenBy("a")).not.toEqual(seenBy("b"));
});

test("a swing that missed doesn't count", () => {
  const { s, rolls } = world(CORRIDOR);
  s.addPlayer("a", SAVE, "a");
  s.addPlayer("b", { ...SAVE, x: 9 }, "b");
  enemy(s).health = 1;
  // "a" misses, "b" kills, and the only roll left would win for anyone.
  rolls.push(MISS, ...SWING, WIN, WIN);
  s.queueTarget("a", "0");
  s.queueTarget("b", "0");
  run(s);
  expect(enemy(s).state).toBe("dead");
  expect(bones(s, "a")).toBe(0);
  expect(bones(s, "b")).toBe(1);
});

test("a dead player still rolls", () => {
  const { s, rolls } = world(CORRIDOR);
  s.addPlayer("a", SAVE, "a");
  s.addPlayer("b", { ...SAVE, x: 9 }, "b");
  enemy(s).health = 200;
  rolls.push(...SWING);
  s.queueTarget("a", "0");
  run(s);
  // "a" is dead by the time "b" lands the killing blow.
  Object.assign(s.state.players.get("a")!, { dead: true, health: 0 });
  rolls.push(...SWING, WIN, LOSE);
  s.queueTarget("b", "0");
  run(s);
  expect(enemy(s).state).toBe("dead");
  expect(bones(s, "a")).toBe(1);
  expect(bones(s, "b")).toBe(0);
});

test("a player who has left doesn't roll", () => {
  const { s, rolls } = world(CORRIDOR);
  s.addPlayer("a", SAVE, "a");
  s.addPlayer("b", { ...SAVE, x: 9 }, "b");
  enemy(s).health = 200;
  rolls.push(...SWING);
  s.queueTarget("a", "0");
  run(s);
  s.removePlayer("a");
  // Only "b" rolls, so the one winning roll is theirs and nothing else is drawn.
  rolls.push(...SWING, WIN);
  s.queueTarget("b", "0");
  const events = run(s, 8);
  expect(enemy(s).state).toBe("dead");
  expect(bones(s, "b")).toBe(1);
  expect(toldTo(events, "a")).toEqual([]);
});

test("a full inventory still gets it on the ground, with the same line", () => {
  const { s, rolls } = world(CORRIDOR);
  s.addPlayer(
    "a",
    { ...SAVE, inventory: Array<string>(30).fill("copperSword") },
    "a",
  );
  enemy(s).health = 1;
  rolls.push(...SWING, WIN);
  s.queueTarget("a", "0");
  const events = run(s);
  expect(bones(s, "a")).toBe(1);
  expect(toldTo(events, "a")).toEqual([
    "You find an Emberbone. It is on the ground.",
  ]);
});

test("recovering forgets who damaged it", () => {
  const { s, rolls } = world(CORRIDOR);
  s.addPlayer("a", SAVE, "a");
  s.addPlayer("b", { ...SAVE, x: 18 }, "b");
  enemy(s).health = 200;
  rolls.push(...SWING);
  s.queueTarget("a", "0");
  run(s);
  // "a" walks out of the leash, and it walks home and recovers.
  Object.assign(s.state.players.get("a")!, { x: 1 });
  s.queueWalk("a", { x: 1, y: 1 });
  run(s, 5);
  expect(enemy(s)).toMatchObject({ state: "idle", health: 2400 });
  // "b" comes back and kills it alone, so "a"'s old hit gets no roll.
  enemy(s).health = 1;
  Object.assign(s.state.players.get("b")!, { x: 9 });
  rolls.push(...SWING, WIN, WIN);
  s.queueTarget("b", "0");
  run(s, 8);
  expect(enemy(s).state).toBe("dead");
  expect(bones(s, "a")).toBe(0);
  expect(bones(s, "b")).toBe(1);
});

test("returning forgets who damaged it", () => {
  const { s, rolls } = world(CORRIDOR);
  s.addPlayer("a", SAVE, "a");
  enemy(s).health = 1;
  rolls.push(...SWING, LOSE);
  s.queueTarget("a", "0");
  run(s);
  expect(enemy(s).state).toBe("dead");
  s.addPlayer("b", { ...SAVE, x: 9 }, "b");
  run(s, 200);
  expect(enemy(s).state).not.toBe("dead");
  // "a" stands next to it, but only "b" hits it this time.
  Object.assign(s.state.players.get("a")!, { x: 1 });
  enemy(s).health = 1;
  rolls.push(...SWING, WIN, WIN);
  s.queueTarget("b", "0");
  run(s, 8);
  expect(enemy(s).state).toBe("dead");
  expect(bones(s, "a")).toBe(0);
  expect(bones(s, "b")).toBe(1);
});

test("Spiders still give nothing, and draw no roll", () => {
  const { s, rolls } = world(SPIDER);
  s.addPlayer("a", SAVE, "a");
  enemy(s).health = 1;
  rolls.push(...SWING, WIN);
  s.queueTarget("a", "0");
  const events = run(s);
  expect(enemy(s).state).toBe("dead");
  expect(bones(s, "a")).toBe(0);
  expect(toldTo(events, "a")).toEqual([]);
  expect(rolls).toEqual([WIN]);
});

test("who damaged what isn't in the save", () => {
  const { s } = world(CORRIDOR);
  s.addPlayer("a", SAVE, "a");
  expect(Object.keys(s.saveOf("a")!).join()).not.toMatch(/damag/i);
});
