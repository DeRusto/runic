import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  parseRegion,
  xpForLevel,
} from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// The respawn tile is (1,1), and nothing else is here.
const TILES = parseRegion(["TTTTTTT", "TR.....T", "TTTTTTT"].join("\n"));

let sim: Simulation;

beforeEach(() => {
  sim = new Simulation(TILES, () => 0);
  sim.addPlayer("a");
});

const player = () => sim.state.players.get("a")!;

/** Re-adds our player holding these [item, count] stacks from slot 0, with Herblaw `level`. */
function addHolding(level: number, ...stacks: [string, number][]) {
  const save = sim.saveOf("a")!;
  const inventory = Array<string>(INVENTORY_SLOTS).fill(EMPTY_SLOT);
  const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
  stacks.forEach(([item, count], slot) => {
    inventory[slot] = item;
    inventoryCounts[slot] = count;
  });
  sim.removePlayer("a");
  sim.addPlayer("a", {
    ...save,
    herblawXp: xpForLevel(level),
    inventory,
    inventoryCounts,
  });
}

/** The held [item, count] pairs, empty slots left out. */
const items = () =>
  [...player().inventory]
    .map((item, slot) => [item, player().inventoryCounts[slot]] as const)
    .filter(([item]) => item !== EMPTY_SLOT);

/** The chat lines this tick's events carry. */
const lines = () =>
  sim.events.flatMap((event) => (event.type === "told" ? [event.line] : []));

describe("mixing a potion", () => {
  test("one vial and one plant anywhere become one potion, at once", () => {
    addHolding(5, ["dewpetal", 1], ["vial", 1]);
    sim.mix("a", 0);
    expect(items()).toEqual([["mightPotion", 1]]);
  });

  test("the vial and plant come from any slots, and leftovers stay", () => {
    addHolding(5, ["vial", 2], ["berry", 3], ["dewpetal", 2]);
    sim.mix("a", 2);
    expect(items()).toEqual([
      ["vial", 1],
      ["berry", 3],
      ["dewpetal", 1],
      ["mightPotion", 1],
    ]);
  });

  test("a potion tops up its own stack", () => {
    addHolding(5, ["vial", 2], ["dewpetal", 2], ["mightPotion", 5]);
    sim.mix("a", 1);
    expect(items()).toEqual([
      ["vial", 1],
      ["dewpetal", 1],
      ["mightPotion", 6],
    ]);
  });

  test("a level below the plant's pick gate is refused and keeps both (#222)", () => {
    addHolding(4, ["dewpetal", 1], ["vial", 1]);
    sim.mix("a", 0);
    expect(lines()).toEqual(["Needs Herblaw 5"]);
    expect(items()).toEqual([
      ["dewpetal", 1],
      ["vial", 1],
    ]);
  });

  test("a nightbloom needs Herblaw 15, an emberbloom 20", () => {
    addHolding(14, ["nightbloom", 1], ["vial", 1]);
    sim.mix("a", 0);
    expect(lines()).toEqual(["Needs Herblaw 15"]);
    expect(items()).toEqual([
      ["nightbloom", 1],
      ["vial", 1],
    ]);
    addHolding(20, ["emberbloom", 1], ["vial", 1]);
    sim.mix("a", 0);
    expect(items()).toEqual([["avoidancePotion", 1]]);
  });

  test("no vial is not enough materials", () => {
    addHolding(15, ["nightbloom", 1]);
    sim.mix("a", 0);
    expect(lines()).toEqual(["Not enough materials"]);
    expect(items()).toEqual([["nightbloom", 1]]);
  });

  test("a full inventory with nothing freed is refused", () => {
    const stacks = Array.from(
      { length: INVENTORY_SLOTS - 2 },
      () => ["berry", 20] as [string, number],
    );
    addHolding(5, ...stacks, ["vial", 2], ["dewpetal", 2]);
    sim.mix("a", INVENTORY_SLOTS - 1);
    expect(lines()).toEqual(["Your inventory is full."]);
    expect(items()).toEqual([...stacks, ["vial", 2], ["dewpetal", 2]]);
  });

  test("the base herb mixes nothing", () => {
    addHolding(99, ["herb", 1], ["vial", 1]);
    sim.mix("a", 0);
    expect(lines()).toEqual([]);
    expect(items()).toEqual([
      ["herb", 1],
      ["vial", 1],
    ]);
  });

  test("mixing pays no experience", () => {
    addHolding(5, ["dewpetal", 1], ["vial", 1]);
    sim.mix("a", 0);
    expect(player().herblawXp).toBe(xpForLevel(5));
  });

  test("mixing doesn't stop a walk", () => {
    addHolding(5, ["dewpetal", 1], ["vial", 1]);
    sim.queueWalk("a", { x: 5, y: 1 });
    sim.mix("a", 0);
    for (let i = 0; i < 9; i++) sim.tick();
    expect(player()).toMatchObject({ x: 5, y: 1 });
    expect(items()).toEqual([["mightPotion", 1]]);
  });

  test.each([[-1], [1.5], [INVENTORY_SLOTS], ["0"], [null], [undefined], [{}]])(
    "a slot of %j is ignored",
    (slot) => {
      addHolding(5, ["dewpetal", 1], ["vial", 1]);
      sim.mix("a", slot as number);
      expect(lines()).toEqual([]);
      expect(items()).toEqual([
        ["dewpetal", 1],
        ["vial", 1],
      ]);
    },
  );

  test("an empty slot, and a slot holding what isn't a plant, are ignored", () => {
    addHolding(5, ["berry", 1], ["vial", 1]);
    sim.mix("a", 5);
    sim.mix("a", 0);
    expect(lines()).toEqual([]);
    expect(items()).toEqual([
      ["berry", 1],
      ["vial", 1],
    ]);
  });

  test("someone who isn't here is ignored", () => {
    addHolding(5, ["dewpetal", 1], ["vial", 1]);
    expect(() => sim.mix("nobody", 0)).not.toThrow();
    expect(items()).toEqual([
      ["dewpetal", 1],
      ["vial", 1],
    ]);
  });
});
