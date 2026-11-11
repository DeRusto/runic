import { parseRegion, type WorldEvent } from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

const TILES = parseRegion(
  ["TTTTTTTTT", "TR.....BT", "T.......T", "TTTTTTTTT"].join("\n"),
);
const BOTH = ["pickaxe", "hammer"];
const NEXT_TO = { x: 6, y: 1 };

let sim: Simulation;
let told: WorldEvent[];
const me = () => sim.state.players.get("a")!;
const tools = () => [...me().tools];
const ticks = (n: number) => {
  for (let i = 0; i < n; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      if (event.type === "told") told.push(event);
  }
};
const arrive = () => ticks(20);
/** Its index among the Blacksmith's first choices. */
const ASK_FOR_TOOLS = 2;
/** Walks over to the Blacksmith and asks for tools. */
const askForTools = (id = "a") => {
  sim.queueVisit(id, "odo");
  arrive();
  sim.choose(id, ASK_FOR_TOOLS);
};

beforeEach(() => {
  told = [];
  sim = new Simulation(TILES, () => 0.99);
  sim.addPlayer("a");
});

test("a new player has no tools", () => {
  expect(tools()).toEqual([]);
});

test("a player gets only the tools they lack", () => {
  sim.addPlayer("b", {
    ...NEXT_TO,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    health: 10,
    inventory: [],
    tools: ["hammer"],
  });
  askForTools("b");
  ticks(1);
  expect([...sim.state.players.get("b")!.tools]).toEqual(["hammer", "pickaxe"]);
  expect(told).toEqual([
    {
      type: "told",
      player: "b",
      line: "The Blacksmith gives you a pickaxe.",
    },
  ]);
});

test("the click replaces what the player was doing", () => {
  sim.queueWalk("a", { x: 1, y: 2 });
  ticks(1);
  askForTools();
  expect(me()).toMatchObject(NEXT_TO);
  expect(tools()).toEqual(BOTH);
});

test("clicking something else on the way means no visit", () => {
  sim.queueVisit("a", "odo");
  ticks(1);
  sim.queueWalk("a", { x: 1, y: 1 });
  arrive();
  expect(me()).toMatchObject({ x: 1, y: 1 });
  expect(tools()).toEqual([]);
  expect(told).toEqual([]);
});

test("a visit cut off by a lost connection gives nothing", () => {
  sim.queueVisit("a", "odo");
  ticks(1);
  sim.dropPlayer("a");
  arrive();
  expect(tools()).toEqual([]);
});

test("a dead player's click is ignored", () => {
  me().dead = true;
  sim.queueVisit("a", "odo");
  ticks(1);
  expect(tools()).toEqual([]);
});

test("a player who isn't here, or a region with no Blacksmith, is ignored", () => {
  expect(() => sim.queueVisit("nobody", "odo")).not.toThrow();
  const empty = new Simulation(parseRegion("TTT\nTRT\nTTT"), () => 0.99);
  empty.addPlayer("a");
  empty.queueVisit("a", "odo");
  empty.tick();
  expect(empty.events).toEqual([]);
});

test("tools take no inventory slot, and a full inventory still gets them", () => {
  for (let slot = 0; slot < 30; slot++) {
    me().inventory[slot] = "berry";
    me().inventoryCounts[slot] = 20;
  }
  askForTools();
  expect(tools()).toEqual(BOTH);
  expect([...me().inventory].every((item) => item === "berry")).toBe(true);
});

test("tools are saved, and come back at login", () => {
  askForTools();
  const save = sim.saveOf("a")!;
  expect(save.tools).toEqual(BOTH);
  sim.addPlayer("b", save);
  expect([...sim.state.players.get("b")!.tools]).toEqual(BOTH);
});

test("a save from before tools loads with none", () => {
  sim.addPlayer("b", {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    health: 10,
    inventory: [],
  });
  expect([...sim.state.players.get("b")!.tools]).toEqual([]);
});

test("tools are kept through dying", () => {
  sim = new Simulation(parseRegion("TTTTT\nTRS.T\nTTTTT"), () => 0);
  sim.addPlayer("a", {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    health: 1,
    inventory: [],
    tools: BOTH,
  });
  sim.queueTarget("a", "0");
  while (!me().dead) sim.tick();
  expect(tools()).toEqual(BOTH);
  while (me().dead) sim.tick();
  expect(tools()).toEqual(BOTH);
});

test("dropping every slot leaves tools alone", () => {
  askForTools();
  for (let slot = 0; slot < 30; slot++) {
    sim.queueDrop("a", slot, 20);
    ticks(1);
  }
  expect(tools()).toEqual(BOTH);
});
