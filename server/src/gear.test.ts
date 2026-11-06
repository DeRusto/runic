import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  parseRegion,
  type GearSlot,
} from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), with the Spider's home at (2,1), next to it.
const TILES = parseRegion(
  ["TTTTTTT", "TRS...T", "T.....T", "TTTTTTT"].join("\n"),
);
const LEVEL_10_XP = 4050;
const LEVEL_20_XP = 18050;
const MISS = 0.99;

type Start = Partial<PlayerSave> & { held?: string[] };

let sim: Simulation;
/** Rolls come in order, and then everything misses (and nothing wanders). */
let rolls: number[];
const me = () => sim.state.players.get("a")!;
const start = ({ held = [], ...fields }: Start = {}) => {
  rolls = [];
  sim = new Simulation(TILES, () => rolls.shift() ?? MISS);
  sim.addPlayer("a", {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: LEVEL_10_XP,
    health: 10,
    inventory: [
      ...held,
      ...Array<string>(INVENTORY_SLOTS - held.length).fill(EMPTY_SLOT),
    ],
    ...fields,
  });
};
const ticks = (n: number) => {
  for (let i = 0; i < n; i++) sim.tick();
};
const told = () =>
  sim.events.flatMap((event) => (event.type === "told" ? [event.line] : []));
const swings = () =>
  sim.events.flatMap((event) =>
    event.type === "playerSwing" ? [event.damage] : [],
  );

beforeEach(() => start());

describe("equipping", () => {
  test("moves gear from the inventory to its gear slot, freeing the slot", () => {
    start({ held: ["berry", "copperSword"], inventoryCounts: [3, 1] });
    sim.equip("a", 1);
    expect(me().weapon).toBe("copperSword");
    expect(me().inventory[1]).toBe(EMPTY_SLOT);
    expect(me().inventoryCounts[1]).toBe(0);
  });

  test("with one worn, the two trade places, even in a full inventory", () => {
    start({
      held: Array<string>(INVENTORY_SLOTS).fill("ironSword"),
      combatXp: LEVEL_10_XP,
      weapon: "copperSword",
    });
    sim.equip("a", 4);
    expect(me().weapon).toBe("ironSword");
    expect(me().inventory[4]).toBe("copperSword");
    expect(me().inventoryCounts[4]).toBe(1);
    expect(told()).toEqual([]);
  });

  test("gear above the player's level is refused with a line", () => {
    start({ held: ["ironSword"], combatXp: LEVEL_10_XP - 1 });
    sim.equip("a", 0);
    expect(me().weapon).toBe("");
    expect(me().inventory[0]).toBe("ironSword");
    expect(sim.events).toEqual([
      { type: "told", player: "a", line: "You need Combat 10 to equip this." },
    ]);
  });

  test("gear at the player's level is allowed", () => {
    start({ held: ["emberiteSword"], combatXp: LEVEL_20_XP });
    sim.equip("a", 0);
    expect(me().weapon).toBe("emberiteSword");
  });

  test("a discard waiting on that slot doesn't destroy the sword traded into it", () => {
    start({
      held: ["ironSword"],
      combatXp: LEVEL_10_XP,
      weapon: "copperSword",
    });
    sim.queueDiscard("a", 0);
    sim.equip("a", 0);
    sim.tick();
    expect(me().inventory[0]).toBe("copperSword");
  });
});

describe("taking off", () => {
  test("moves gear to the first empty slot", () => {
    start({
      held: ["berry", "", "herb"],
      inventoryCounts: [1, 0, 1],
      weapon: "copperSword",
    });
    sim.takeOff("a", "weapon");
    expect(me().weapon).toBe("");
    expect(me().inventory[1]).toBe("copperSword");
    expect(me().inventoryCounts[1]).toBe(1);
  });

  test("with no empty slot is refused with a line", () => {
    start({
      held: Array<string>(INVENTORY_SLOTS).fill("berry"),
      weapon: "copperSword",
    });
    sim.takeOff("a", "weapon");
    expect(me().weapon).toBe("copperSword");
    expect(told()).toEqual(["You have no empty slot to take that off into."]);
  });

  test("an empty gear slot does nothing, even with a full inventory", () => {
    start({ held: Array<string>(INVENTORY_SLOTS).fill("berry") });
    sim.takeOff("a", "weapon");
    expect(sim.events).toEqual([]);
  });
});

describe("mid-fight", () => {
  test("changing gear keeps the action and the swing timer", () => {
    start({ held: ["copperSword"] });
    sim.queueTarget("a", "0");
    sim.tick(); // The first swing, so the next is due on tick 9.
    sim.events.length = 0;
    ticks(3);
    sim.equip("a", 0);
    sim.takeOff("a", "weapon");
    sim.equip("a", 0);
    expect(me().action).toBe("fighting");
    ticks(4);
    expect(swings()).toEqual([]);
    sim.tick();
    expect(swings()).toHaveLength(1);
    expect(me().action).toBe("fighting");
  });

  test("it doesn't stop a walk either", () => {
    start({ held: ["copperSword"] });
    sim.queueWalk("a", { x: 5, y: 2 });
    sim.tick();
    sim.equip("a", 0);
    sim.tick();
    expect(me().action).toBe("walking");
  });
});

describe("what lasts", () => {
  test("gear is saved and loaded", () => {
    start({ weapon: "copperSword", shield: "copperShield" });
    expect(me().weapon).toBe("copperSword");
    expect(me().shield).toBe("copperShield");
    expect(sim.saveOf("a")).toMatchObject({
      weapon: "copperSword",
      shield: "copperShield",
    });
  });

  test("a new player and a save from before gear wear nothing", () => {
    sim.addPlayer("b");
    expect(sim.state.players.get("b")).toMatchObject({
      weapon: "",
      shield: "",
    });
    expect(sim.saveOf("b")).toMatchObject({ weapon: "", shield: "" });
    expect(me().weapon).toBe("");
  });

  test("gear is kept on death", () => {
    start({ weapon: "copperSword", health: 1 });
    // The player misses on tick 1, and the Spider's hit on tick 5 kills.
    rolls = [MISS, 0, 0];
    sim.queueTarget("a", "0");
    ticks(5);
    expect(me().dead).toBe(true);
    expect(me().weapon).toBe("copperSword");
    ticks(6);
    expect(me().dead).toBe(false);
    expect(me().weapon).toBe("copperSword");
  });

  test("worn gear can't be discarded, as no slot holds it", () => {
    start({ weapon: "copperSword" });
    for (let slot = 0; slot < INVENTORY_SLOTS; slot++) {
      sim.queueDiscard("a", slot);
      sim.tick();
    }
    expect(me().weapon).toBe("copperSword");
  });
});

describe("damage on a hit is (1 + bonus)..(2 + floor(Combat / 20) + bonus)", () => {
  const LOWEST = 0;
  const HIGHEST = 0.99;
  const swing = (roll: number, fields: Start) => {
    start(fields);
    rolls = [0, roll];
    sim.queueTarget("a", "0");
    sim.tick();
    return swings()[0];
  };

  test.each([
    ["", 0, 1, 2],
    ["copperSword", 0, 2, 3],
    ["ironSword", LEVEL_10_XP, 3, 4],
    ["emberiteSword", LEVEL_20_XP, 4, 6],
  ])("%j at %i experience", (weapon, combatXp, low, high) => {
    expect(swing(LOWEST, { weapon, combatXp })).toBe(low);
    expect(swing(HIGHEST, { weapon, combatXp })).toBe(high);
  });

  test("a miss is still a miss with a sword", () => {
    start({ weapon: "emberiteSword" });
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([0]);
  });

  test("a shield adds nothing to a hit", () => {
    expect(swing(LOWEST, { shield: "emberiteShield" })).toBe(1);
  });

  test("the bonus earns experience, but not for overkill", () => {
    start({ weapon: "copperSword" });
    sim.state.enemies.get("0")!.health = 1;
    rolls = [0, HIGHEST];
    sim.queueTarget("a", "0");
    sim.tick();
    expect(swings()).toEqual([1]);
    expect(me().combatXp).toBe(6);
  });
});

describe("anything invalid off the network is ignored", () => {
  test.each([-1, INVENTORY_SLOTS, 1.5, "0", null, undefined, [0], {}, NaN])(
    "equipping slot %j",
    (slot) => {
      start({ held: ["copperSword"] });
      sim.equip("a", slot as number);
      expect(me().weapon).toBe("");
      expect(sim.events).toEqual([]);
    },
  );

  test("equipping an empty slot, food or a material", () => {
    start({ held: ["berry", "copperOre"] });
    for (const slot of [0, 1, 2]) sim.equip("a", slot);
    expect(me().weapon).toBe("");
    expect(me().inventory[0]).toBe("berry");
    expect(me().inventory[1]).toBe("copperOre");
    expect(sim.events).toEqual([]);
  });

  test.each(["", "health", "inventory", "__proto__", null, 0, ["weapon"], {}])(
    "taking off %j",
    (slot) => {
      start({ weapon: "copperSword" });
      sim.takeOff("a", slot as GearSlot);
      expect(me().weapon).toBe("copperSword");
      expect(sim.events).toEqual([]);
    },
  );

  test("a player who isn't there", () => {
    sim.equip("nobody", 0);
    sim.takeOff("nobody", "weapon");
    expect(sim.events).toEqual([]);
  });

  test("a dead player, as for eating and discarding", () => {
    start({ held: ["copperSword"], weapon: "copperSword" });
    me().dead = true;
    sim.equip("a", 0);
    sim.takeOff("a", "weapon");
    expect(me().inventory[0]).toBe("copperSword");
    expect(me().weapon).toBe("copperSword");
  });
});
