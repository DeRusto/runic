import { parseRegion, type WorldEvent } from "@runic/shared";
import { expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const HIT = 0;
const MISS = 0.99;
/** A count roll on silk's 1 to 2 range: below a half gives 1, from a half up gives 2. */
const ONE = 0.4999;
const TWO = 0.5;
/** The hit roll, the damage roll and the crit roll of a swing doing 100 damage. */
const SWING = [HIT, HIT, MISS];

// The Spider's home is (7,1), with players either side of it and a workbench at (4,1).
const ROWS = ["TTTTTTTTTT", "TR..w..S.T", "T........T", "TTTTTTTTTT"];

const SAVE: PlayerSave = {
  x: 6,
  y: 1,
  defenseXp: 0,
  herblawXp: 0,
  hitpointsXp: 4050,
  health: 1000,
  inventory: Array<string>(30).fill(""),
};

/** Rolls come in order, and then everything misses. */
function world() {
  const rolls: number[] = [];
  const s = new Simulation(
    parseRegion(ROWS.join("\n")),
    () => rolls.shift() ?? MISS,
  );
  return { s, rolls };
}

const spider = (s: Simulation) => s.state.enemies.get("0")!;
/** Silk on the ground owned by the player with this username, who is also its id here. */
const silk = (s: Simulation, id: string) =>
  [...s.state.groundItems.values()]
    .filter(({ item, owner }) => item === "spiderSilk" && owner === id)
    .map(({ x, y, count }) => ({ x, y, count }));

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

/** "a" swings once and "b" lands the killing blow, each doing 100 damage; then each rolls a count. */
function killedByTwo(s: Simulation, rolls: number[], ...counts: number[]) {
  s.addPlayer("a", SAVE, "a");
  s.addPlayer("b", { ...SAVE, x: 8 }, "b");
  spider(s).health = 200;
  rolls.push(...SWING, ...SWING, ...counts);
  s.queueTarget("a", "0");
  s.queueTarget("b", "0");
}

test("each player who damaged a Spider finds their own silk on its tile, with a line", () => {
  const { s, rolls } = world();
  killedByTwo(s, rolls, ONE, TWO);
  const events = run(s);
  expect(spider(s).state).toBe("dead");
  expect(silk(s, "a")).toEqual([{ x: 7, y: 1, count: 1 }]);
  expect(silk(s, "b")).toEqual([{ x: 7, y: 1, count: 2 }]);
  expect(toldTo(events, "a")).toEqual([
    "You find a [Spider silk]. It is on the ground.",
  ]);
  expect(toldTo(events, "b")).toEqual([
    "You find 2 [Spider silk]. It is on the ground.",
  ]);
});

test("each damager rolls their own count, so both can get 1 or both 2", () => {
  for (const [roll, count] of [
    [ONE, 1],
    [TWO, 2],
  ] as const) {
    const { s, rolls } = world();
    killedByTwo(s, rolls, roll, roll);
    run(s);
    expect(silk(s, "a")).toEqual([{ x: 7, y: 1, count }]);
    expect(silk(s, "b")).toEqual([{ x: 7, y: 1, count }]);
  }
});

test("silk is its owner's alone for the first minute", () => {
  const { s, rolls } = world();
  killedByTwo(s, rolls, ONE, ONE);
  run(s);
  const seenBy = (id: string) =>
    [...s.state.groundItems.keys()].filter((g) => s.canSee(id, g));
  expect(seenBy("a")).toHaveLength(1);
  expect(seenBy("b")).toHaveLength(1);
  expect(seenBy("a")).not.toEqual(seenBy("b"));
});

test("a player who did no damage gets none", () => {
  const { s, rolls } = world();
  s.addPlayer("a", SAVE, "a");
  s.addPlayer("b", { ...SAVE, x: 8 }, "b");
  spider(s).health = 100;
  // "a" misses, "b" kills, and only "b" rolls a count.
  rolls.push(MISS, ...SWING, TWO);
  s.queueTarget("a", "0");
  s.queueTarget("b", "0");
  const events = run(s);
  expect(spider(s).state).toBe("dead");
  expect(silk(s, "a")).toEqual([]);
  expect(toldTo(events, "a")).toEqual([]);
  expect(silk(s, "b")).toEqual([{ x: 7, y: 1, count: 2 }]);
});

test("silk from a kill spins into rope at the workbench", () => {
  const { s, rolls } = world();
  s.addPlayer("a", SAVE, "a");
  spider(s).health = 100;
  rolls.push(...SWING, TWO);
  s.queueTarget("a", "0");
  run(s);
  s.queueTake("a", [...s.state.groundItems.keys()][0]!);
  run(s, 5);
  const inventory = () => {
    const { inventory, inventoryCounts } = s.state.players.get("a")!;
    return [...inventory]
      .map((item, slot) => [item, inventoryCounts[slot]])
      .filter(([item]) => item !== "");
  };
  expect(inventory()).toEqual([["spiderSilk", 2]]);
  s.queueMake("a", { item: "rope", all: false });
  run(s, 12);
  expect(inventory()).toEqual([["rope", 1]]);
});
