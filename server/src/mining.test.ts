import {
  INVENTORY_SLOTS,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), a walk of 3 steps from standing next to the Copper vein at (5,1).
const TILES = parseRegion(
  ["TTTTTTTTT", "TR...cieT", "T.......T", "TS......T", "TTTTTTTTT"].join("\n"),
);
const COPPER = "5,1";
const IRON = "6,1";
const ARRIVAL_TICK = 5;
const FAIL = 0.99;
const SUCCEED = 0;

let sim: Simulation;
let roll: number;

beforeEach(() => {
  roll = SUCCEED;
  sim = new Simulation(TILES, () => roll);
  addAt("a", 0, 1, 1);
});

const player = (id = "a") => sim.state.players.get(id)!;
const oreLeft = (vein: string) => sim.state.veins.get(vein)!.oreLeft;

/** Adds a player with a pickaxe, unless `tools` says otherwise. */
function addAt(
  id: string,
  miningXp: number,
  x = 4,
  y = 1,
  tools = ["pickaxe"],
) {
  sim.addPlayer(
    id,
    {
      x,
      y,
      miningXp,
      tools,
      combatXp: 0,
      defenseXp: 0,
      foragingXp: 0,
      hitpointsXp: 4050,
      health: 10,
      inventory: Array<string>(INVENTORY_SLOTS).fill(""),
    },
    id,
  );
}

/** Runs ticks and returns each `mine` event with the tick it came on. */
const attempts = (count: number) => {
  const seen: { tick: number; event: WorldEvent }[] = [];
  for (let i = 0; i < count; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      if (event.type === "mine") seen.push({ tick: sim.state.tick, event });
  }
  return seen;
};
const attemptTicks = (count: number) => attempts(count).map(({ tick }) => tick);

const mine = (vein: string, id = "a") => {
  sim.queueGather(id, "mining", vein);
  attempts(8);
};

test("a vein starts full, by its tier", () => {
  expect(oreLeft(COPPER)).toBe(3);
  expect(oreLeft(IRON)).toBe(3);
});

test("clicking a vein walks next to it and attempts on the tick of arrival", () => {
  roll = FAIL;
  sim.queueGather("a", "mining", COPPER);
  expect(attempts(ARRIVAL_TICK)).toEqual([
    {
      tick: ARRIVAL_TICK,
      event: { type: "mine", player: "a", success: false },
    },
  ]);
  expect(player()).toMatchObject({ x: 4, y: 1 });
});

test("a player on their way or trying counts as mining", () => {
  roll = FAIL;
  sim.queueGather("a", "mining", COPPER);
  attempts(1);
  expect(player().action).toBe("mining");
  attempts(ARRIVAL_TICK);
  expect(player().action).toBe("mining");
});

test("a success gives one ore and its experience, uses the vein and ends the action", () => {
  sim.queueGather("a", "mining", COPPER);
  expect(attemptTicks(40)).toEqual([ARRIVAL_TICK]);
  expect(player().miningXp).toBe(10);
  expect(player().inventory[0]).toBe("copperOre");
  expect(player().inventoryCounts[0]).toBe(1);
  expect(oreLeft(COPPER)).toBe(2);
  expect(player().action).toBe("");
});

test("ore tops up its stack", () => {
  addAt("b", 0);
  mine(COPPER, "b");
  mine(COPPER, "b");
  expect(player("b").inventory[0]).toBe("copperOre");
  expect(player("b").inventoryCounts[0]).toBe(2);
  expect(player("b").inventory[1]).toBe("");
});

test("a failure gives nothing, keeps the vein, and tries again every 8 ticks", () => {
  roll = FAIL;
  sim.queueGather("a", "mining", COPPER);
  expect(attemptTicks(ARRIVAL_TICK + 16)).toEqual([
    ARRIVAL_TICK,
    ARRIVAL_TICK + 8,
    ARRIVAL_TICK + 16,
  ]);
  expect(player().miningXp).toBe(0);
  expect(player().inventory[0]).toBe("");
  expect(oreLeft(COPPER)).toBe(3);
});

test("the attempt interval follows the Mining level, not Foraging", () => {
  addAt("b", xpForLevel(15));
  roll = FAIL;
  sim.queueGather("b", "mining", COPPER);
  expect(attemptTicks(15)).toEqual([1, 8, 15]);
});

test("the chance follows the Mining level above the tier's gate", () => {
  addAt("b", xpForLevel(10), 6, 2);
  roll = 0.51;
  sim.queueGather("b", "mining", IRON);
  attempts(1);
  expect(player("b").inventory[0]).toBe(""); // 50% at the gate.
  addAt("c", xpForLevel(11), 6, 2);
  sim.queueGather("c", "mining", IRON);
  attempts(1);
  expect(player("c").inventory[0]).toBe("ironOre"); // 52% one level up.
  expect(player("c").miningXp).toBe(xpForLevel(11) + 30);
});

test("clicking again can't beat the attempt interval", () => {
  addAt("b", 0);
  roll = FAIL;
  const ticks: number[] = [];
  for (let i = 0; i < 16; i++) {
    sim.queueGather("b", "mining", COPPER);
    ticks.push(...attemptTicks(1));
  }
  expect(ticks).toEqual([1, 9]);
});

test("foraging and mining share the timer, so swapping can't beat it", () => {
  sim = new Simulation(
    parseRegion(["TTTTT", "TbRcT", "TTTTT"].join("\n")),
    () => FAIL,
  );
  addAt("b", 0, 2, 1);
  sim.queueGather("b", "foraging", "1,1");
  sim.tick();
  sim.events.length = 0;
  sim.queueGather("b", "mining", "3,1");
  expect(attemptTicks(7)).toEqual([]);
  expect(attemptTicks(1)).toEqual([9]);
});

test("leaving and coming back can't beat the attempt interval", () => {
  addAt("c", 0);
  roll = FAIL;
  sim.queueGather("c", "mining", COPPER);
  attempts(1);
  const save = sim.saveOf("c")!;
  sim.removePlayer("c");
  sim.addPlayer("back", save, "c");
  sim.queueGather("back", "mining", COPPER);
  expect(attemptTicks(7)).toEqual([]);
  expect(attemptTicks(1)).toEqual([9]);
});

test("clicking something else stops the trying", () => {
  roll = FAIL;
  addAt("b", 0);
  sim.queueGather("b", "mining", COPPER);
  attempts(1);
  sim.queueWalk("b", { x: 3, y: 2 });
  expect(attemptTicks(20)).toEqual([]);
  expect(player("b").action).toBe("");
});

test("a run-out vein stops whoever is still trying, and a shared last ore goes to one player", () => {
  addAt("b", 0);
  addAt("c", 0, 4, 2);
  mine(COPPER, "b");
  mine(COPPER, "b");
  expect(oreLeft(COPPER)).toBe(1);
  sim.queueGather("b", "mining", COPPER);
  sim.queueGather("c", "mining", COPPER);
  expect(attempts(10)).toHaveLength(1);
  expect(oreLeft(COPPER)).toBe(0);
  expect(player("b").action).toBe("");
  expect(player("c").action).toBe("");
  expect(player("c").inventory[0]).toBe("");
});

test("a player on the way makes no attempt if someone else takes the last ore", () => {
  addAt("b", 0);
  mine(COPPER, "b");
  mine(COPPER, "b");
  sim.queueGather("a", "mining", COPPER);
  sim.queueGather("b", "mining", COPPER);
  expect(attempts(20)).toHaveLength(1);
  expect(player().inventory[0]).toBe("");
  expect(player().action).toBe("");
});

test("a click on a run-out vein is ignored", () => {
  addAt("b", 0);
  mine(COPPER, "b");
  mine(COPPER, "b");
  mine(COPPER, "b");
  expect(oreLeft(COPPER)).toBe(0);
  sim.queueGather("a", "mining", COPPER);
  attempts(1);
  expect(player()).toMatchObject({ x: 1, y: 1, action: "" });
});

test("a vein grows back fully only after it runs out, at its tier's time", () => {
  addAt("b", 0);
  mine(COPPER, "b");
  attempts(1000);
  expect(oreLeft(COPPER)).toBe(2);
  mine(COPPER, "b");
  mine(COPPER, "b");
  expect(oreLeft(COPPER)).toBe(0);
  attempts(399 - 7);
  expect(oreLeft(COPPER)).toBe(0);
  attempts(1);
  expect(oreLeft(COPPER)).toBe(3);
});

test("a full inventory stops the trying", () => {
  addAt("b", 0);
  roll = FAIL;
  sim.queueGather("b", "mining", COPPER);
  attempts(1);
  for (let slot = 0; slot < INVENTORY_SLOTS; slot++) {
    player("b").inventory[slot] = "herb";
    player("b").inventoryCounts[slot] = 20;
  }
  roll = SUCCEED;
  expect(attemptTicks(20)).toEqual([]);
  expect(player("b").action).toBe("");
});

test("a click with no pickaxe is ignored", () => {
  addAt("b", 0, 4, 1, []);
  sim.queueGather("b", "mining", COPPER);
  expect(attemptTicks(20)).toEqual([]);
  expect(player("b").action).toBe("");
});

test("a click below the tier's Mining level is ignored", () => {
  addAt("b", xpForLevel(9), 6, 2);
  sim.queueGather("b", "mining", IRON);
  expect(attemptTicks(20)).toEqual([]);
  expect(player("b").action).toBe("");
});

test("a click with no room for that ore is ignored, but a stack with room is room", () => {
  addAt("b", 0);
  for (let slot = 0; slot < INVENTORY_SLOTS; slot++) {
    player("b").inventory[slot] = "herb";
    player("b").inventoryCounts[slot] = 20;
  }
  sim.queueGather("b", "mining", COPPER);
  expect(attemptTicks(20)).toEqual([]);
  player("b").inventory[29] = "copperOre";
  player("b").inventoryCounts[29] = 19;
  sim.queueGather("b", "mining", COPPER);
  expect(attemptTicks(1)).toEqual([expect.any(Number)]);
  expect(player("b").inventoryCounts[29]).toBe(20);
});

test.each([["nowhere"], ["1,1"], [undefined], [{}]])(
  "a click on %j isn't a vein, and is ignored",
  (vein) => {
    sim.queueGather("a", "mining", vein as string);
    expect(attemptTicks(5)).toEqual([]);
    expect(player()).toMatchObject({ x: 1, y: 1 });
  },
);

test("a dead player's click, or one from nobody, is ignored", () => {
  player().dead = true;
  sim.queueGather("a", "mining", COPPER);
  expect(attemptTicks(1)).toEqual([]);
  expect(() => sim.queueGather("nobody", "mining", COPPER)).not.toThrow();
});

test("an enemy's swing doesn't turn a miner to fight", () => {
  sim = new Simulation(
    parseRegion(["TTTTT", "TRcST", "TTTTT"].join("\n")),
    () => FAIL,
  );
  addAt("b", 0, 3, 1);
  // Starts the Spider's fight, then turns straight to the vein.
  sim.queueTarget("b", "0");
  sim.tick();
  sim.queueGather("b", "mining", "2,1");
  for (let i = 0; i < 20; i++) sim.tick();
  const swings = sim.events.filter(({ type }) => type === "enemySwing");
  expect(swings.length).toBeGreaterThan(0);
  expect(player("b")).toMatchObject({ action: "mining", target: "" });
});

test("a lost connection stops the trying", () => {
  addAt("b", 0);
  roll = FAIL;
  sim.queueGather("b", "mining", COPPER);
  attempts(1);
  sim.dropPlayer("b");
  expect(attemptTicks(20)).toEqual([]);
});

test("experience and ore are saved, and vein state isn't", () => {
  addAt("b", 0);
  mine(COPPER, "b");
  const save = sim.saveOf("b")!;
  expect(save).toMatchObject({ miningXp: 10 });
  expect(save.inventory![0]).toBe("copperOre");
  expect(JSON.stringify(save)).not.toMatch(/oreLeft|vein/);
  // A restart starts every vein full again, the same as bushes.
  const restarted = new Simulation(TILES, () => FAIL);
  expect(restarted.state.veins.get(COPPER)!.oreLeft).toBe(3);
});
