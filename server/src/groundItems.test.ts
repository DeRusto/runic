import { INVENTORY_SLOTS, parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

const TILES = parseRegion(["TTTTTT", "TR...T", "TTTTTT"].join("\n"));

/** Alice at (1,1) holding 12 copper ore in slot 0 and a copper sword in slot 1, and Bob at (3,1). */
function world() {
  const sim = new Simulation(TILES, () => 0.99);
  const inventory = Array<string>(INVENTORY_SLOTS).fill("");
  inventory.splice(0, 2, "copperOre", "copperSword");
  const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
  inventoryCounts.splice(0, 2, 12, 1);
  const save = {
    x: 1,
    y: 1,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    health: 1000,
    inventory,
    inventoryCounts,
  };
  sim.addPlayer("a", save, "alice");
  sim.addPlayer("b", { ...save, x: 3, inventory: [] }, "bob");
  return sim;
}

const groundItems = (sim: Simulation) =>
  [...sim.state.groundItems.values()].map(({ x, y, item, count }) => ({
    x,
    y,
    item,
    count,
  }));

const ticks = (sim: Simulation, n: number) => {
  for (let i = 0; i < n; i++) sim.tick();
};

test("dropping a slot leaves its whole stack on the player's tile, and empties the slot", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  expect(groundItems(sim)).toEqual([
    { x: 1, y: 1, item: "copperOre", count: 12 },
  ]);
  const alice = sim.state.players.get("a")!;
  expect(alice.inventory[0]).toBe("");
  expect(alice.inventoryCounts[0]).toBe(0);
});

test("several drops on one tile stay separate ground items", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  sim.queueDrop("a", 1);
  sim.tick();
  expect(groundItems(sim)).toEqual([
    { x: 1, y: 1, item: "copperOre", count: 12 },
    { x: 1, y: 1, item: "copperSword", count: 1 },
  ]);
});

test("a ground item vanishes 600 ticks after its drop, each on its own timer", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  ticks(sim, 10);
  sim.queueDrop("a", 1);
  sim.tick();
  ticks(sim, 588);
  expect(groundItems(sim).map(({ item }) => item)).toEqual([
    "copperOre",
    "copperSword",
  ]);
  sim.tick();
  expect(groundItems(sim).map(({ item }) => item)).toEqual(["copperSword"]);
  ticks(sim, 10);
  expect(groundItems(sim).map(({ item }) => item)).toEqual(["copperSword"]);
  sim.tick();
  expect(groundItems(sim)).toEqual([]);
});

test("a ground item stays when its owner logs out, and its timer keeps running", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  sim.removePlayer("a");
  ticks(sim, 599);
  expect(groundItems(sim)).toHaveLength(1);
  sim.tick();
  expect(groundItems(sim)).toEqual([]);
});

const seenBy = (sim: Simulation, player: string) =>
  [...sim.state.groundItems.keys()].filter((id) => sim.canSee(player, id));

test("only the owner can see a ground item for 200 ticks, then everyone can", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  ticks(sim, 199);
  expect(seenBy(sim, "a")).toHaveLength(1);
  expect(seenBy(sim, "b")).toEqual([]);
  sim.tick();
  expect(seenBy(sim, "a")).toHaveLength(1);
  expect(seenBy(sim, "b")).toHaveLength(1);
});

test("the owner is the account, so logging in again still sees it", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  const save = sim.saveOf("a")!;
  sim.removePlayer("a");
  sim.addPlayer("a2", save, "alice");
  expect(seenBy(sim, "a2")).toHaveLength(1);
});

test("the owner's name rides along until the owner minute ends, for the gold ring", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  const [dropped] = sim.state.groundItems.values();
  expect(dropped!.owner).toBe("alice");
  ticks(sim, 200);
  expect(dropped!.owner).toBe("");
});

test("a player who isn't here, or a ground item that isn't, sees nothing", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  ticks(sim, 200);
  expect(seenBy(sim, "nobody")).toEqual([]);
  expect(sim.canSee("a", "nothing")).toBe(false);
});
