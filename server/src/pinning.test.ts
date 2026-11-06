import { parseRegion } from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { players } from "./schema.ts";
import { Simulation } from "./simulation.ts";

const TILES = parseRegion(["TTTTT", "TR..T", "TTTTT"].join("\n"));
const STARTING_PINS = [
  "Combat",
  "Defense",
  "Foraging",
  "Hitpoints",
  "Mining",
  "Smithing",
];

let sim: Simulation;
const me = () => sim.state.players.get("a")!;
const pins = () => [...me().pinnedSkills];

beforeEach(() => {
  sim = new Simulation(TILES, () => 0);
  sim.addPlayer("a");
});

test("a new player starts with today's skills pinned, and Blocking not", () => {
  expect(pins()).toEqual(STARTING_PINS);
});

test("a save from before pins gets the same starting pins from its column", () => {
  expect(players.pinnedSkills.default).toEqual(STARTING_PINS);
});

test("the new skills start at 0 experience, level 1", () => {
  expect(me().miningXp).toBe(0);
  expect(me().smithingXp).toBe(0);
  expect(me().blockingXp).toBe(0);
});

test("the new skills and pins are saved", () => {
  Object.assign(me(), { miningXp: 10, smithingXp: 20, blockingXp: 40 });
  sim.pinSkill("a", { skill: "Mining", pinned: false });
  expect(sim.saveOf("a")).toMatchObject({
    miningXp: 10,
    smithingXp: 20,
    blockingXp: 40,
    pinnedSkills: STARTING_PINS.filter((skill) => skill !== "Mining"),
  });
});

test("a save's experience and pins come back at login", () => {
  sim.addPlayer("b", {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    health: 10,
    inventory: [],
    miningXp: 10,
    smithingXp: 20,
    blockingXp: 40,
    pinnedSkills: ["Blocking"],
  });
  const back = sim.state.players.get("b")!;
  expect([...back.pinnedSkills]).toEqual(["Blocking"]);
  expect(back.miningXp).toBe(10);
  expect(back.smithingXp).toBe(20);
  expect(back.blockingXp).toBe(40);
});

test("unpinning frees a pin, and pinning takes it", () => {
  sim.pinSkill("a", { skill: "Combat", pinned: false });
  sim.pinSkill("a", { skill: "Blocking", pinned: true });
  expect(pins()).toEqual([...STARTING_PINS.slice(1), "Blocking"]);
});

test("a seventh pin is ignored", () => {
  sim.pinSkill("a", { skill: "Blocking", pinned: true });
  expect(pins()).toEqual(STARTING_PINS);
});

test("pinning a skill twice or unpinning one that isn't pinned changes nothing", () => {
  sim.pinSkill("a", { skill: "Combat", pinned: false });
  sim.pinSkill("a", { skill: "Defense", pinned: true });
  sim.pinSkill("a", { skill: "Combat", pinned: false });
  expect(pins()).toEqual(STARTING_PINS.slice(1));
});

test.each([
  [undefined],
  [null],
  ["Combat"],
  [{ skill: "Fishing", pinned: true }],
  [{ skill: "Combat" }],
  [{ skill: "Combat", pinned: "false" }],
  [{ skill: ["Combat"], pinned: false }],
])("an invalid intent is ignored: %j", (intent) => {
  sim.pinSkill("a", intent as never);
  expect(pins()).toEqual(STARTING_PINS);
});

test("a player who isn't here is ignored", () => {
  expect(() =>
    sim.pinSkill("nobody", { skill: "Combat", pinned: false }),
  ).not.toThrow();
});

test("pinning replaces no action", () => {
  sim.queueWalk("a", { x: 3, y: 1 });
  sim.tick();
  sim.pinSkill("a", { skill: "Combat", pinned: false });
  sim.tick();
  expect(me().action).toBe("walking");
  sim.tick();
  expect(me().x).toBe(3);
});
