import {
  INVENTORY_SLOTS,
  parseRegion,
  QUEST_DONE,
  stationRefusal,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

// Hollis stands at (3,1) with (2,1) beside them; the essence rock is (5,1), mined from (5,2);
// a Skeleton Mage is home at (8,1), with (7,1) beside it.
const TILES = parseRegion(
  ["TTTTTTTTTTT", "TR.L.E..Z.T", "T.........T", "TTTTTTTTTTT"].join("\n"),
);
const HIT = 0;
const MISS = 0.99;
/** The hit roll, the damage roll and the crit roll of a swing doing 100 damage. */
const SWING = [HIT, HIT, MISS];

const SAVE: PlayerSave = {
  x: 2,
  y: 1,
  defenseXp: 0,
  herblawXp: 0,
  hitpointsXp: 4050,
  health: 1000,
  miningXp: xpForLevel(25),
  tools: ["pickaxe"],
  inventory: Array<string>(INVENTORY_SLOTS).fill(""),
};
const KNOWS_ESSENCE = {
  identifiesEssence: true,
  quests: {
    odoCopper: { stage: QUEST_DONE, turns: 3 },
    odoEssence: { stage: QUEST_DONE, turns: 0 },
  },
};

let sim: Simulation;
let rolls: number[];
let events: WorldEvent[];
const me = () => sim.state.players.get("a")!;
const run = (ticks = 1) => {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    events.push(...sim.events.splice(0));
  }
};
const told = () =>
  events.flatMap((e) =>
    e.type === "told" && e.player === "a" ? [e.line] : [],
  );
/** Talks to Hollis from beside them and picks each choice in turn. */
const talk = (...choices: number[]) => {
  Object.assign(me(), { x: 2, y: 1 });
  sim.queueVisit("a", "hollis");
  run();
  for (const choice of choices) {
    sim.choose("a", choice);
    run();
  }
};
/** "Can I use the altar?", then "I'll bring them." */
const ASK = [1, 0];
const holds = (slot: number, item: string, count: number) => {
  me().inventory[slot] = item;
  me().inventoryCounts[slot] = count;
};
const mineRock = () => {
  Object.assign(me(), { x: 5, y: 2 });
  sim.queueGather("a", "mining", "5,1");
  run(8);
};

beforeEach(() => {
  rolls = [];
  events = [];
  sim = new Simulation(TILES, () => rolls.shift() ?? MISS);
});

test("Hollis won't start the offering before Odo has taught essence", () => {
  sim.addPlayer("a", SAVE, "a");
  talk(...ASK);
  expect(told()).toEqual([
    "Hollis looks through you. Learn to know essence first: the Blacksmith can teach it.",
  ]);
  expect([...me().quests]).toEqual([]);
});

describe("on the offering", () => {
  beforeEach(() => {
    sim.addPlayer("a", { ...SAVE, ...KNOWS_ESSENCE }, "a");
    talk(...ASK);
  });

  test("taking it starts the stage, and the altar stays shut", () => {
    expect([...me().quests]).toEqual([
      "odoCopper",
      "odoEssence",
      "hollisRunes",
    ]);
    expect([...me().questStages]).toEqual([QUEST_DONE, QUEST_DONE, "offering"]);
    expect(stationRefusal("altar", me())).toBe(
      "You need to help Hollis first.",
    );
  });

  test("an essence rock gives Hollow essence beside its own, until five are held", () => {
    // The success roll, the double roll, then the quest find's roll.
    rolls.push(HIT, MISS, HIT);
    mineRock();
    expect([...me().inventory].slice(0, 2)).toEqual([
      "runeEssence",
      "hollowEssence",
    ]);
    holds(1, "hollowEssence", 5);
    rolls.push(HIT, MISS, HIT);
    mineRock();
    expect(me().inventoryCounts[1]).toBe(5);
    expect(me().inventoryCounts[0]).toBe(2);
  });

  test("a Skeleton Mage's bone sigil drops for a player Hollis asked, and not for one Hollis didn't", () => {
    sim.addPlayer("b", { ...SAVE, x: 9, ...KNOWS_ESSENCE }, "b");
    const mage = sim.state.enemies.get("0")!;
    const sigils = (owner: string) =>
      [...sim.state.groundItems.values()].filter(
        (g) => g.item === "boneSigil" && g.owner === owner,
      ).length;
    // "a" is on the offering, "b" never took it; both win the roll.
    Object.assign(me(), { x: 7, y: 1 });
    mage.health = 200;
    rolls.push(...SWING, ...SWING, HIT, HIT);
    sim.queueTarget("a", "0");
    sim.queueTarget("b", "0");
    run();
    expect(mage.state).toBe("dead");
    expect([sigils("a"), sigils("b")]).toEqual([1, 0]);
  });

  test("the offering handed over finishes the quest and opens the altar", () => {
    holds(0, "hollowEssence", 5);
    holds(1, "boneSigil", 1);
    events = [];
    talk(0);
    expect(told()).toEqual([
      "You finish The stones remember. You earn 1 quest point.",
    ]);
    expect([...me().questStages]).toEqual([QUEST_DONE, QUEST_DONE, QUEST_DONE]);
    expect([...me().inventory].slice(0, 2)).toEqual(["", ""]);
    expect(stationRefusal("altar", me())).toBeUndefined();
  });
});
