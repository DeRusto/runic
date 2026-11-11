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
  const empty = { inventory: Array<string>(INVENTORY_SLOTS).fill("") };
  sim.addPlayer("b", { ...save, ...empty, x: 3, inventoryCounts: [] }, "bob");
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

/** Fills every slot of a player's inventory from `slots`, then with `fill`. */
function hold(
  sim: Simulation,
  id: string,
  slots: [string, number][],
  fill: [string, number] = ["", 0],
) {
  const player = sim.state.players.get(id)!;
  for (let slot = 0; slot < INVENTORY_SLOTS; slot++) {
    const [item, count] = slots[slot] ?? fill;
    player.inventory[slot] = item;
    player.inventoryCounts[slot] = count;
  }
}

const held = (sim: Simulation, id: string) => {
  const { inventory, inventoryCounts } = sim.state.players.get(id)!;
  return [...inventory]
    .map((item, slot) => [item, inventoryCounts[slot]] as const)
    .filter(([item]) => item);
};

const onlyGroundItem = (sim: Simulation) =>
  [...sim.state.groundItems.keys()][0]!;

test("taking a lone ground item from afar walks onto its tile, then moves it into the inventory", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  sim.queueWalk("a", { x: 4, y: 1 });
  ticks(sim, 20);
  const alice = sim.state.players.get("a")!;
  expect(alice.x).toBe(4);

  sim.queueTake("a", onlyGroundItem(sim));
  ticks(sim, 20);
  expect({ x: alice.x, y: alice.y }).toEqual({ x: 1, y: 1 });
  expect(held(sim, "a")).toEqual([
    ["copperOre", 12],
    ["copperSword", 1],
  ]);
  expect(groundItems(sim)).toEqual([]);
});

test("a taken stack joins a matching stack first, and what doesn't fit stays with its timers", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  ticks(sim, 200);
  hold(
    sim,
    "b",
    [
      ["herb", 1],
      ["copperOre", 15],
    ],
    ["herb", 1],
  );
  sim.queueTake("b", onlyGroundItem(sim));
  ticks(sim, 20);
  expect(held(sim, "b")[1]).toEqual(["copperOre", 20]);
  expect(groundItems(sim)).toEqual([
    { x: 1, y: 1, item: "copperOre", count: 7 },
  ]);
  // Dropped on tick 1, so it still vanishes on tick 601.
  ticks(sim, 600 - sim.state.tick);
  expect(groundItems(sim)).toHaveLength(1);
  sim.tick();
  expect(groundItems(sim)).toEqual([]);
});

test("taking gear with no free slot is refused with a chat line, and the item stays", () => {
  const sim = world();
  sim.queueDrop("a", 1);
  sim.tick();
  hold(sim, "a", [], ["herb", 1]);
  sim.events.length = 0;
  sim.queueTake("a", onlyGroundItem(sim));
  sim.tick();
  expect(sim.events).toContainEqual({
    type: "told",
    player: "a",
    line: "Your inventory is full.",
  });
  expect(groundItems(sim)).toEqual([
    { x: 1, y: 1, item: "copperSword", count: 1 },
  ]);
});

test("a take intent for a ground item the player can't see is ignored", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  sim.queueTake("b", onlyGroundItem(sim));
  sim.queueTake("b", "nothing");
  ticks(sim, 20);
  expect(sim.state.players.get("b")!.x).toBe(3);
  expect(held(sim, "b")).toEqual([]);
  expect(groundItems(sim)).toHaveLength(1);
});

test("a take intent whose payload isn't a ground item's id string is ignored", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  sim.queueWalk("a", { x: 4, y: 1 });
  ticks(sim, 20);
  for (const payload of [0, [onlyGroundItem(sim)], { id: "0" }, null])
    sim.queueTake("a", payload as unknown as string);
  ticks(sim, 20);
  expect(sim.state.players.get("a")!.x).toBe(4);
  expect(groundItems(sim)).toHaveLength(1);
});

test("when two players take the same ground item on the same tick, only one gets it", () => {
  const sim = world();
  sim.queueDrop("a", 1);
  sim.tick();
  ticks(sim, 200);
  sim.state.players.get("b")!.x = 1;
  sim.queueTake("a", onlyGroundItem(sim));
  sim.queueTake("b", onlyGroundItem(sim));
  sim.tick();
  const swords = [...held(sim, "a"), ...held(sim, "b")].filter(
    ([item]) => item === "copperSword",
  );
  expect(swords).toEqual([["copperSword", 1]]);
  expect(groundItems(sim)).toEqual([]);
});

test("when the first of two same-tick takers leaves part of a stack, the second still gets none", () => {
  const sim = world();
  sim.queueDrop("a", 0);
  sim.tick();
  ticks(sim, 200);
  hold(sim, "a", [["copperOre", 15]], ["herb", 1]);
  sim.state.players.get("b")!.x = 1;
  sim.queueTake("a", onlyGroundItem(sim));
  sim.queueTake("b", onlyGroundItem(sim));
  sim.tick();
  const ore = (id: string) =>
    held(sim, id)
      .filter(([item]) => item === "copperOre")
      .reduce((sum, [, count]) => sum + count, 0);
  expect(ore("a") + ore("b")).toBe(20);
  expect(Math.min(ore("a") - 15, ore("b"))).toBe(0);
  expect(groundItems(sim)).toEqual([
    { x: 1, y: 1, item: "copperOre", count: 7 },
  ]);
});

test("an improved piece is dropped and taken back whole", () => {
  const sim = world();
  const alice = sim.state.players.get("a")!;
  alice.inventory[1] = "copperSword:uncommon:might";
  sim.queueDrop("a", 1);
  sim.tick();
  expect(groundItems(sim)).toEqual([
    { x: 1, y: 1, item: "copperSword:uncommon:might", count: 1 },
  ]);
  sim.queueTake("a", [...sim.state.groundItems.keys()][0]!);
  sim.tick();
  expect(alice.inventory[1]).toBe("copperSword:uncommon:might");
  expect(groundItems(sim)).toEqual([]);
});
