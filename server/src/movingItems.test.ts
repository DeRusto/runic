import { INVENTORY_SLOTS, parseRegion } from "@runic/shared";
import { describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

const TILES = parseRegion(["TTTTTTT", "TR....T", "TTTTTTT"].join("\n"));

/** A player at the respawn tile holding these [item, count] stacks from slot 0. */
function holding(...stacks: [string, number][]) {
  const sim = new Simulation(TILES, () => 0);
  const inventory = Array<string>(INVENTORY_SLOTS).fill("");
  const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
  stacks.forEach(([item, count], slot) => {
    inventory[slot] = item;
    inventoryCounts[slot] = count;
  });
  sim.addPlayer("a", {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    health: 1000,
    inventory,
    inventoryCounts,
  });
  return sim;
}

/** The first `slots` slots as [item, count] pairs. */
const slotsOf = (sim: Simulation, slots = 3) => {
  const { inventory, inventoryCounts } = sim.state.players.get("a")!;
  return [...inventory]
    .slice(0, slots)
    .map((item, slot) => [item, inventoryCounts[slot]]);
};

describe("dragging in the inventory", () => {
  test("onto an empty slot moves the stack", () => {
    const sim = holding(["berry", 7]);
    sim.moveItem("a", 0, 2);
    expect(slotsOf(sim)).toEqual([
      ["", 0],
      ["", 0],
      ["berry", 7],
    ]);
  });

  test("onto a different item swaps them", () => {
    const sim = holding(["berry", 7], ["copperSword", 1]);
    sim.moveItem("a", 0, 1);
    expect(slotsOf(sim, 2)).toEqual([
      ["copperSword", 1],
      ["berry", 7],
    ]);
  });

  test("a partial stack onto a partial stack of the same item fills the target and leaves the rest", () => {
    const sim = holding(["berry", 15], ["berry", 12]);
    sim.moveItem("a", 0, 1);
    expect(slotsOf(sim, 2)).toEqual([
      ["berry", 7],
      ["berry", 20],
    ]);
  });

  test("a partial stack that fits entirely empties the source slot", () => {
    const sim = holding(["berry", 5], ["berry", 12]);
    sim.moveItem("a", 0, 1);
    expect(slotsOf(sim, 2)).toEqual([
      ["", 0],
      ["berry", 17],
    ]);
  });

  test("onto a full stack of the same item swaps them", () => {
    const sim = holding(["berry", 4], ["berry", 20]);
    sim.moveItem("a", 0, 1);
    expect(slotsOf(sim, 2)).toEqual([
      ["berry", 20],
      ["berry", 4],
    ]);
  });

  test("takes effect at once and interrupts nothing: not a walk", () => {
    const sim = holding(["berry", 4]);
    sim.queueWalk("a", { x: 5, y: 1 });
    sim.tick();
    sim.moveItem("a", 0, 1);
    expect(slotsOf(sim, 2)).toEqual([
      ["", 0],
      ["berry", 4],
    ]);
    for (let i = 0; i < 10; i++) sim.tick();
    expect(sim.state.players.get("a")!.x).toBe(5);
  });

  test("a drop waiting on a dragged slot doesn't drop what lands there", () => {
    const sim = holding(["berry", 4], ["herb", 3]);
    sim.queueDrop("a", 0, 20);
    sim.moveItem("a", 0, 1);
    sim.tick();
    expect(slotsOf(sim, 2)).toEqual([
      ["herb", 3],
      ["berry", 4],
    ]);
  });

  test("an eat waiting on a dragged slot doesn't eat what lands there", () => {
    const sim = holding(["berry", 4], ["herb", 3]);
    sim.queueEat("a", 0);
    sim.moveItem("a", 0, 1);
    sim.tick();
    expect(slotsOf(sim, 2)).toEqual([
      ["herb", 3],
      ["berry", 4],
    ]);
  });

  test.each([
    [-1, 1],
    [0, 30],
    [1.5, 0],
    ["0", 1],
    [null, 1],
    [undefined, undefined],
    [0, 0],
  ])("a drag from %j to %j is ignored", (from, to) => {
    const sim = holding(["berry", 4], ["herb", 3]);
    sim.moveItem("a", from as number, to as number);
    expect(slotsOf(sim, 2)).toEqual([
      ["berry", 4],
      ["herb", 3],
    ]);
  });

  test("dragging an empty slot does nothing", () => {
    const sim = holding(["berry", 4]);
    sim.moveItem("a", 2, 0);
    expect(slotsOf(sim)).toEqual([
      ["berry", 4],
      ["", 0],
      ["", 0],
    ]);
  });

  test("a player who isn't here", () => {
    const sim = holding(["berry", 4]);
    expect(() => sim.moveItem("nobody", 0, 1)).not.toThrow();
  });
});

describe("dropping an amount", () => {
  /** Every ground item, as [item, count] pairs. */
  const groundOf = (sim: Simulation) =>
    [...sim.state.groundItems.values()].map(({ item, count }) => [item, count]);

  test.each([
    [1, 19],
    [5, 15],
    [10, 10],
    [20, 0],
  ])("dropping %i of 20 leaves %i in the slot", (amount, left) => {
    const sim = holding(["berry", 20]);
    sim.queueDrop("a", 0, amount);
    sim.tick();
    expect(slotsOf(sim, 1)).toEqual([[left ? "berry" : "", left]]);
    expect(groundOf(sim)).toEqual([["berry", amount]]);
  });

  test("an amount larger than the stack drops the whole stack", () => {
    const sim = holding(["berry", 7]);
    sim.queueDrop("a", 0, 500);
    sim.tick();
    expect(slotsOf(sim, 1)).toEqual([["", 0]]);
    expect(groundOf(sim)).toEqual([["berry", 7]]);
  });

  test.each([[0], [-3], [2.5], ["5"], [null], [undefined], [NaN]])(
    "an amount of %j is ignored",
    (amount) => {
      const sim = holding(["berry", 7]);
      sim.queueDrop("a", 0, amount as number);
      sim.tick();
      expect(slotsOf(sim, 1)).toEqual([["berry", 7]]);
      expect(groundOf(sim)).toEqual([]);
    },
  );
});
