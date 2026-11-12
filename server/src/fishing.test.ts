import {
  gatherRefusal,
  parseRegion,
  VILLAGERS,
  xpForLevel,
  type SitePool,
} from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { gatheringHarness, seededRandom } from "./gatheringHarness.ts";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1); the Lake is row 2's water, and the spot at (3,2) is fished from (3,1).
const TILES = parseRegion(
  ["TTTTTTTTT", "TR......T", "T.~~~...T", "TTTTTTTTT"].join("\n"),
);
const SPOT = "3,2";
const POOL: SitePool = {
  skill: "fishing",
  kind: "shore",
  active: 1,
  spots: [{ x: 3, y: 2 }],
};
const FAIL = 0.99;
const SUCCEED = 0.4;

let sim: Simulation;
/** The rolls still to come, in order; once they run out, every roll fails. */
let rolls: number[];

beforeEach(() => {
  rolls = [];
  sim = new Simulation(TILES, () => rolls.shift() ?? FAIL, [POOL]);
});

const player = (id = "a") => sim.state.players.get(id)!;
const catchesLeft = () => sim.state.fishingSpots.get(SPOT)?.catchesLeft;

const harness = gatheringHarness(() => sim, "fishing", { x: 3, y: 1 });
/** Adds a player with a rod beside the spot, unless `tools` says otherwise. */
const addAt = (id: string, fishingXp: number, tools = ["rod"]) =>
  harness.addAt(id, fishingXp, 3, 1, tools);
/** Clicks the spot, runs ticks, and returns each `fish` event. */
const fish = (id = "a") => harness.gather(SPOT, id);

test("the spot is on water, and water blocks walking with or without a spot on it", () => {
  addAt("a", 0);
  expect(catchesLeft()).toBe(5);
  sim.queueWalk("a", { x: 4, y: 2 });
  for (let i = 0; i < 10; i++) sim.tick();
  expect(player()).not.toMatchObject({ x: 4, y: 2 });
});

test("a success at Fishing 1 gives a perch and its experience, with no doubles or finds", () => {
  addAt("a", 0);
  // A roll of 0 would double or find on a vein, and would land a better fish if the level let it.
  rolls = [0, 0, 0];
  expect(fish()).toEqual([
    { type: "fish", player: "a", success: true, count: 1, finds: [] },
  ]);
  expect(player().inventory[0]).toBe("perch");
  expect(player().fishingXp).toBe(8);
  expect(catchesLeft()).toBe(4);
});

test("at Fishing 20 a pike comes up on a 20% roll, with its own experience", () => {
  addAt("a", xpForLevel(20));
  rolls = [SUCCEED, 0.19];
  fish();
  expect(player().inventory[0]).toBe("pike");
  expect(player().fishingXp).toBe(xpForLevel(20) + 32);
});

test("at Fishing 20, a missed pike roll gives a trout on a 30% roll, and missing both a perch", () => {
  addAt("a", xpForLevel(20));
  rolls = [SUCCEED, 0.2, 0.29];
  fish();
  rolls = [SUCCEED, 0.2, 0.3];
  fish();
  expect([...player().inventory].slice(0, 2)).toEqual(["trout", "perch"]);
  expect(player().fishingXp).toBe(xpForLevel(20) + 20 + 8);
});

test("below Fishing 20 no pike comes up, and the first catch roll is trout's", () => {
  addAt("a", xpForLevel(19));
  rolls = [SUCCEED, 0];
  fish();
  expect(player().inventory[0]).toBe("trout");
});

test("below Fishing 10 every catch is a perch", () => {
  addAt("a", xpForLevel(9));
  rolls = [SUCCEED, 0, 0];
  fish();
  expect(player().inventory[0]).toBe("perch");
});

test("over many catches at Fishing 20, about 20% are pike, 24% trout and the rest perch", () => {
  const random = seededRandom(12345);
  const caught = new Map<string, number>();
  for (let i = 0; i < 1000; i++) {
    sim = new Simulation(TILES, random, [POOL]);
    // Enough to succeed every time, so each attempt is a catch.
    addAt("a", xpForLevel(30));
    fish();
    const item = player().inventory[0]!;
    caught.set(item, (caught.get(item) ?? 0) + 1);
  }
  expect([...caught.values()].reduce((a, b) => a + b)).toBe(1000);
  expect(caught.get("pike")! / 1000).toBeCloseTo(0.2, 1);
  expect(caught.get("trout")! / 1000).toBeCloseTo(0.24, 1);
  expect(caught.get("perch")! / 1000).toBeCloseTo(0.56, 1);
});

test("a spot holds 5 catches, then moves on, and comes back 150 ticks later", () => {
  addAt("a", 0);
  for (let i = 0; i < 5; i++) {
    rolls = [SUCCEED];
    fish();
  }
  expect(player().inventoryCounts[0]).toBe(5);
  expect(catchesLeft()).toBeUndefined();
  for (let i = 0; i < 150; i++) sim.tick();
  expect(catchesLeft()).toBe(5);
});

test("water still blocks once its spot has moved on", () => {
  addAt("a", 0);
  for (let i = 0; i < 5; i++) {
    rolls = [SUCCEED];
    fish();
  }
  sim.queueWalk("a", { x: 3, y: 2 });
  for (let i = 0; i < 10; i++) sim.tick();
  expect(player()).not.toMatchObject({ x: 3, y: 2 });
});

test("fishing without a rod is refused, naming the Fisher", () => {
  addAt("a", 0, []);
  expect(gatherRefusal("fishing", "shore", 5, player())).toBe(
    "You need a rod. The Fisher will give you one.",
  );
  rolls = [0];
  expect(fish()).toEqual([]);
  expect(catchesLeft()).toBe(5);
});

test("the Fisher gives the rod free when asked", () => {
  // The Fisher stands at (7,1), on the bank.
  sim = new Simulation(
    parseRegion(
      ["TTTTTTTTT", "TR.....YT", "T.~~~...T", "TTTTTTTTT"].join("\n"),
    ),
    () => FAIL,
    [POOL],
  );
  addAt("a", 0, []);
  sim.queueVisit("a", "tamsin");
  for (let i = 0; i < 20; i++) sim.tick();
  sim.choose(
    "a",
    VILLAGERS.tamsin.nodes.greet.choices.findIndex(
      (choice) => "action" in choice && choice.action === "giveTools",
    ),
  );
  sim.tick();
  expect([...player().tools]).toEqual(["rod"]);
  expect(sim.events).toContainEqual({
    type: "told",
    player: "a",
    line: "Tamsin gives you a rod.",
  });
});

test("a save from before Fishing loads with none", () => {
  sim.addPlayer("c", {
    x: 2,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    health: 10,
    inventory: [],
  });
  expect(player("c").fishingXp).toBe(0);
  expect(sim.saveOf("c")).toMatchObject({ fishingXp: 0 });
});
