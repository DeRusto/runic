import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The furnace is at (4,1) and the anvil at (6,1), with (5,1) next to both.
const TILES = parseRegion(
  ["TTTTTTTTT", "TR..F.N.T", "T.......T", "TS......T", "TTTTTTTTT"].join("\n"),
);
const FAIL = 0.99;

let sim: Simulation;
let seen: { tick: number; event: WorldEvent }[];

beforeEach(() => {
  sim = new Simulation(TILES, () => FAIL);
  seen = [];
});

const player = (id = "a") => sim.state.players.get(id)!;

/** Adds a player holding `held`, a hammer, and standing next to both stations unless told otherwise. */
function add(
  held: [string, number][],
  {
    id = "a",
    x = 5,
    y = 1,
    smithingXp = 0,
    miningXp = 0,
    tools = ["hammer"],
    fill = "",
    fillCount = 0,
  } = {},
) {
  const inventory = Array<string>(INVENTORY_SLOTS).fill(fill);
  const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(fillCount);
  held.forEach(([item, count], slot) => {
    inventory[slot] = item;
    inventoryCounts[slot] = count;
  });
  sim.addPlayer(
    id,
    {
      x,
      y,
      smithingXp,
      miningXp,
      tools,
      inventory,
      inventoryCounts,
      combatXp: 0,
      defenseXp: 0,
      foragingXp: 0,
      hitpointsXp: 4050,
      health: 10,
    },
    id,
  );
}

const run = (ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      seen.push({ tick: sim.state.tick, event });
  }
};
const makes = () => seen.filter(({ event }) => event.type === "make");
const lines = () =>
  seen.flatMap(({ event }) => (event.type === "told" ? [event.line] : []));
const items = (id = "a") =>
  [...player(id).inventory]
    .map((item, slot) => [item, player(id).inventoryCounts[slot]])
    .filter(([item]) => item !== EMPTY_SLOT);

test("picking walks next to the station and starts work on arrival", () => {
  add([["copperOre", 1]], { x: 1, y: 1 });
  sim.queueMake("a", { item: "copperBar", all: false });
  run(1);
  expect(player().action).toBe("smithing");
  expect(makes()).toEqual([]);
  run(2);
  expect(player()).toMatchObject({ x: 3, y: 1, action: "smithing" });
  expect(makes()).toEqual([
    {
      tick: 3,
      event: { type: "make", player: "a", station: "furnace", ticks: 6 },
    },
  ]);
});

test("materials leave and the item and experience arrive together at the end of the wait", () => {
  add([["copperOre", 2]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(6);
  expect(items()).toEqual([["copperOre", 2]]);
  expect(player().smithingXp).toBe(0);
  expect(player().miningXp).toBe(0);
  run(1);
  expect(items()).toEqual([
    ["copperOre", 1],
    ["copperBar", 1],
  ]);
  expect(player().smithingXp).toBe(0);
  expect(player().miningXp).toBe(2);
});

test("an Emberite bar gives 12 Mining experience and no Smithing", () => {
  add([["emberiteOre", 1]], { miningXp: xpForLevel(20) });
  sim.queueMake("a", { item: "emberiteBar", all: false });
  run(7);
  expect(player().smithingXp).toBe(0);
  expect(player().miningXp).toBe(xpForLevel(20) + 12);
});

test("a sword or shield gives only Smithing experience", () => {
  add([["copperBar", 7]]);
  sim.queueMake("a", { item: "copperSword", all: false });
  run(13);
  expect(player().smithingXp).toBe(18);
  sim.queueMake("a", { item: "copperShield", all: false });
  run(17);
  expect(player().smithingXp).toBe(42);
  expect(player().miningXp).toBe(0);
});

test("Smithing levels don't open smelting's Mining gate", () => {
  add([["ironOre", 1]], { smithingXp: xpForLevel(50) });
  sim.queueMake("a", { item: "ironBar", all: false });
  run(7);
  expect(items()).toEqual([["ironOre", 1]]);
  expect(player().smithingXp).toBe(xpForLevel(50));
  expect(player().miningXp).toBe(0);
  expect(lines()).toEqual(["Needs Mining 10"]);
});

test("Make 1 ends after one item, with no line", () => {
  add([["copperOre", 5]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(30);
  expect(items()).toEqual([
    ["copperOre", 4],
    ["copperBar", 1],
  ]);
  expect(player().action).toBe("");
  expect(makes()).toHaveLength(1);
  expect(lines()).toEqual([]);
});

test("Make all goes on until the materials run out, then says so once", () => {
  add([["copperOre", 2]]);
  sim.queueMake("a", { item: "copperBar", all: true });
  run(7);
  expect(items()).toEqual([
    ["copperOre", 1],
    ["copperBar", 1],
  ]);
  expect(player().action).toBe("smithing");
  expect(makes().map(({ tick }) => tick)).toEqual([1, 7]);
  expect(lines()).toEqual([]);
  run(30);
  expect(items()).toEqual([[`copperBar`, 2]]);
  expect(player().action).toBe("");
  expect(player().miningXp).toBe(4);
  expect(lines()).toEqual(["Not enough materials"]);
});

test("any new choice starts the wait over, even the same item, and costs nothing", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(5);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(6);
  expect(items()).toEqual([["copperOre", 1]]);
  run(1);
  expect(items()).toEqual([["copperBar", 1]]);
});

test("clicking something else stops the work, and only the progress is lost", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(5);
  sim.queueWalk("a", { x: 5, y: 2 });
  run(20);
  expect(items()).toEqual([["copperOre", 1]]);
  expect(player().smithingXp).toBe(0);
  expect(player().action).toBe("");
  expect(lines()).toEqual([]);
});

test("too few materials on arrival end it with a line, and nothing is made", () => {
  add([["copperBar", 2]]);
  sim.queueMake("a", { item: "copperSword", all: false });
  run(20);
  expect(makes()).toEqual([]);
  expect(items()).toEqual([["copperBar", 2]]);
  expect(player().action).toBe("");
  expect(lines()).toEqual(["Not enough materials"]);
});

test("too low a level on arrival ends it, whatever is held", () => {
  add([["ironOre", 5]], { miningXp: xpForLevel(9) });
  sim.queueMake("a", { item: "ironBar", all: true });
  run(20);
  expect(makes()).toEqual([]);
  expect(lines()).toEqual(["Needs Mining 10"]);
  add([["ironOre", 5]], { id: "b", miningXp: xpForLevel(10) });
  sim.queueMake("b", { item: "ironBar", all: false });
  run(7);
  expect(player("b").miningXp).toBe(xpForLevel(10) + 6);
  expect(player("b").smithingXp).toBe(0);
});

test("materials dropped during the wait end it with a line, and nothing is made", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(3);
  sim.queueDrop("a", 0);
  run(1);
  expect(player().action).toBe("smithing");
  run(10);
  expect(items()).toEqual([]);
  expect(player().smithingXp).toBe(0);
  expect(lines()).toEqual(["Not enough materials"]);
});

test("the last ore in a full inventory becomes a bar", () => {
  add([["copperOre", 1]], { fill: "herb", fillCount: 20 });
  sim.queueMake("a", { item: "copperBar", all: false });
  run(7);
  expect(player().inventory[0]).toBe("copperBar");
  expect(player().inventoryCounts[0]).toBe(1);
  expect(lines()).toEqual([]);
});

test("with no room the materials stay, and it ends with one line", () => {
  add([["copperOre", 2]], { fill: "herb", fillCount: 20 });
  sim.queueMake("a", { item: "copperBar", all: true });
  run(20);
  expect(player().inventory[0]).toBe("copperOre");
  expect(player().inventoryCounts[0]).toBe(2);
  expect(player().smithingXp).toBe(0);
  expect(player().action).toBe("");
  expect(lines()).toEqual(["Your inventory is full."]);
});

test("a stack with room is room, even in a full inventory", () => {
  add(
    [
      ["copperOre", 2],
      ["copperBar", 19],
    ],
    { fill: "herb", fillCount: 20 },
  );
  sim.queueMake("a", { item: "copperBar", all: false });
  run(7);
  expect(player().inventoryCounts[0]).toBe(1);
  expect(player().inventoryCounts[1]).toBe(20);
});

test("costs come out of several stacks, and an emptied slot is freed", () => {
  add([
    ["copperBar", 1],
    ["herb", 1],
    ["copperBar", 5],
  ]);
  sim.queueMake("a", { item: "copperShield", all: false });
  run(17);
  expect(items()).toEqual([
    ["copperShield", 1],
    ["herb", 1],
    ["copperBar", 2],
  ]);
  expect(player().smithingXp).toBe(24);
});

test("gear takes a slot each", () => {
  add([["copperBar", 6]]);
  sim.queueMake("a", { item: "copperSword", all: true });
  run(30);
  expect(items()).toEqual([
    ["copperSword", 1],
    ["copperSword", 1],
  ]);
});

test("eating and dropping don't interrupt it", () => {
  add([
    ["copperOre", 1],
    ["herb", 2],
    ["berry", 1],
  ]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(2);
  sim.queueEat("a", 1);
  sim.queueDrop("a", 2);
  run(5);
  expect(items()).toEqual([
    ["copperBar", 1],
    ["herb", 1],
  ]);
  expect(makes()).toHaveLength(1);
});

test("any number of players can share a station", () => {
  add([["copperOre", 1]]);
  add([["copperOre", 1]], { id: "b", x: 3, y: 1 });
  add([["copperOre", 1]], { id: "c", x: 3, y: 2 });
  for (const id of ["a", "b", "c"])
    sim.queueMake(id, { item: "copperBar", all: false });
  run(7);
  for (const id of ["a", "b", "c"])
    expect(items(id)).toEqual([["copperBar", 1]]);
});

test("an enemy's swing doesn't turn someone working", () => {
  sim = new Simulation(
    parseRegion(["TTTTT", "TRFST", "TTTTT"].join("\n")),
    () => FAIL,
  );
  add([["copperOre", 20]], { x: 3, y: 1 });
  // Starts the Spider's fight, then turns straight to the furnace.
  sim.queueTarget("a", "0");
  run(1);
  sim.queueMake("a", { item: "copperBar", all: true });
  run(20);
  expect(seen.some(({ event }) => event.type === "enemySwing")).toBe(true);
  expect(player()).toMatchObject({ action: "smithing", target: "" });
});

test("a lost connection stops the work", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(1);
  sim.dropPlayer("a");
  run(10);
  expect(items()).toEqual([["copperOre", 1]]);
  expect(player().action).toBe("");
});

test("dying stops the work", () => {
  sim = new Simulation(
    parseRegion(["TTTTT", "TRFST", "TTTTT"].join("\n")),
    () => 0, // Every enemy swing lands, for 1 damage.
  );
  add([["copperOre", 1]], { x: 3, y: 1 });
  player().health = 1;
  sim.queueTarget("a", "0");
  run(1);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(5);
  expect(player().dead).toBe(true);
  expect(player().action).toBe("");
  run(5);
  // Dropped on death as it was, never made into a bar.
  const dropped = [...sim.state.groundItems.values()];
  expect(dropped.map(({ item, count }) => [item, count])).toEqual([
    ["copperOre", 1],
  ]);
  expect(player().smithingXp).toBe(0);
});

test.each([
  [{ item: "nothing", all: false }],
  [{ item: "berry", all: false }],
  [{ item: "constructor", all: true }],
  [{ item: ["copperBar"], all: true }],
  [{ all: true }],
  ["copperBar"],
  [undefined],
])("%j isn't a thing to make, and is ignored", (intent) => {
  add([["copperOre", 5]], { x: 1, y: 1 });
  sim.queueMake("a", intent as never);
  run(10);
  expect(makes()).toEqual([]);
  expect(player()).toMatchObject({ x: 1, y: 1, action: "" });
});

test("anything but `all: true` means Make 1", () => {
  add([["copperOre", 5]]);
  sim.queueMake("a", { item: "copperBar", all: "yes" } as never);
  run(20);
  expect(makes()).toHaveLength(1);
});

test("choosing an anvil recipe with no hammer is ignored, and a furnace recipe needs no tool", () => {
  add([["copperBar", 5]], { tools: [] });
  sim.queueMake("a", { item: "copperSword", all: false });
  run(20);
  expect(makes()).toEqual([]);
  add([["copperOre", 5]], { id: "b", x: 3, y: 1, tools: [] });
  sim.queueMake("b", { item: "copperBar", all: false });
  run(1);
  expect(makes()).toHaveLength(1);
});

test("a dead player's pick, or one from nobody, is ignored", () => {
  add([["copperOre", 5]]);
  player().dead = true;
  sim.queueMake("a", { item: "copperBar", all: false });
  run(1);
  expect(makes()).toEqual([]);
  expect(() =>
    sim.queueMake("nobody", { item: "copperBar", all: false }),
  ).not.toThrow();
});

test("a region without that station ignores the pick", () => {
  sim = new Simulation(parseRegion("TTT\nTRT\nTTT"), () => FAIL);
  add([["copperOre", 5]], { x: 1, y: 1 });
  sim.queueMake("a", { item: "copperBar", all: false });
  run(5);
  expect(makes()).toEqual([]);
});

test("what was made and its experience are saved", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(7);
  expect(sim.saveOf("a")).toMatchObject({ miningXp: 2 });
  expect(sim.saveOf("a")!.inventory![0]).toBe("copperBar");
});
