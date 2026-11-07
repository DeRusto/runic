import {
  BLOCKING_XP_PER_BLOCK,
  DEFENSE_XP_PER_ENEMY_SWING,
  MAX_XP,
  parseRegion,
  xpForLevel,
} from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The berry bush at (5,1) is next to (4,1); the Spider's home at (2,1) is next to the respawn tile.
const BUSH_TILES = parseRegion(["TTTTTTT", "TR...bT", "TTTTTTT"].join("\n"));
const BERRY = "5,1";
const SPIDER_TILES = parseRegion(
  ["TTTTTTT", "TRS...T", "T.....T", "TTTTTTT"].join("\n"),
);

let sim: Simulation;
let rolls: number[];
const me = () => sim.state.players.get("a")!;
const ticks = (n: number) => {
  for (let i = 0; i < n; i++) sim.tick();
};
const startAt = (tiles: typeof BUSH_TILES, fields = {}) => {
  sim = new Simulation(tiles, () => rolls.shift() ?? 0.99);
  sim.addPlayer("template");
  const save = sim.saveOf("template")!;
  sim.removePlayer("template");
  sim.addPlayer("a", { ...save, ...fields });
};
const pickBerry = () => {
  rolls = [0];
  sim.queueGather("a", "foraging", BERRY);
  ticks(8);
};

beforeEach(() => {
  rolls = [];
});

test("a new player starts Mastery at 0 experience", () => {
  startAt(BUSH_TILES);
  expect(me().masteryXp).toBe(0);
  expect(me().masteryHundredths).toBe(0);
});

test("a berry's 10 experience earns 0.7, and the fractions add up", () => {
  startAt(BUSH_TILES, { x: 4, y: 1 });
  pickBerry();
  expect(me().foragingXp).toBe(10);
  expect(me()).toMatchObject({ masteryXp: 0, masteryHundredths: 70 });
  pickBerry();
  expect(me()).toMatchObject({ masteryXp: 1, masteryHundredths: 40 });
});

test("experience lost to the cap earns nothing", () => {
  startAt(BUSH_TILES, { x: 4, y: 1, foragingXp: MAX_XP - 1 });
  pickBerry();
  expect(me().foragingXp).toBe(MAX_XP);
  expect(me()).toMatchObject({ masteryXp: 0, masteryHundredths: 7 });
});

test("experience at the cap earns nothing, and Mastery's own can't pass it", () => {
  startAt(BUSH_TILES, {
    x: 4,
    y: 1,
    foragingXp: MAX_XP,
    masteryXp: MAX_XP,
  });
  pickBerry();
  expect(me().masteryXp).toBe(MAX_XP);
  expect(me().masteryHundredths).toBe(0);
});

test("one swing pays Combat and Hitpoints, and earns a share of each", () => {
  startAt(SPIDER_TILES);
  const hitpointsBefore = me().hitpointsXp;
  // Hits, for the lowest damage.
  rolls = [0, 0];
  sim.queueTarget("a", "0");
  sim.tick();
  expect(me().combatXp).toBe(6);
  expect(me().hitpointsXp).toBe(hitpointsBefore + 6);
  // 7% of 6, twice.
  expect(me()).toMatchObject({ masteryXp: 0, masteryHundredths: 84 });
});

test("a block earns a share of Blocking and of Defense", () => {
  startAt(SPIDER_TILES, { shield: "copperShield" });
  // The player's swing misses; the Spider's hits for 1 and is blocked.
  rolls = [0.99, 0, 0, 0];
  sim.queueTarget("a", "0");
  ticks(5);
  expect(me().blockingXp).toBe(BLOCKING_XP_PER_BLOCK);
  expect(me().defenseXp).toBe(DEFENSE_XP_PER_ENEMY_SWING);
  // 7% of 46.
  expect(me()).toMatchObject({ masteryXp: 3, masteryHundredths: 22 });
});

test("Mastery and its fraction are saved and come back at login", () => {
  startAt(BUSH_TILES, { x: 4, y: 1 });
  pickBerry();
  const save = sim.saveOf("a")!;
  expect(save).toMatchObject({ masteryXp: 0, masteryHundredths: 70 });
  sim.removePlayer("a");
  sim.addPlayer("a", save);
  pickBerry();
  expect(me()).toMatchObject({ masteryXp: 1, masteryHundredths: 40 });
});

test("Mastery can be pinned", () => {
  startAt(BUSH_TILES, { masteryXp: xpForLevel(2) });
  sim.pinSkill("a", { skill: "Smithing", pinned: false });
  sim.pinSkill("a", { skill: "Mastery", pinned: true });
  expect([...me().pinnedSkills]).toContain("Mastery");
});
