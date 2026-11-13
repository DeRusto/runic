import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  parseRegion,
  QUEST_DONE,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Simulation } from "./simulation.ts";

// The furnace is at (4,1) and the anvil at (6,1), with (5,1) next to both.
const TILES = parseRegion(
  ["TTTTTTTTT", "TR..F.N.T", "T.......T", "TS......T", "TTTTTTTTT"].join("\n"),
);
const FAIL = 0.99;

let sim: Simulation;
let seen: { tick: number; event: WorldEvent }[];

beforeEach(() => {
  sim = new Simulation(TILES, () => FAIL);
  seen = [];
});

const player = (id = "a") => sim.state.players.get(id)!;

/** Adds a player holding `held`, a hammer, Odo's quest done, and standing next to both stations unless told otherwise. */
function add(
  held: [string, number][],
  {
    id = "a",
    x = 5,
    y = 1,
    smithingXp = 0,
    miningXp = 0,
    tools = ["hammer"],
    fill = "",
    fillCount = 0,
    // Odo's quest done, with its repeats spent, so the smithy's stations open (#231).
    quests = {
      odoCopper: { stage: QUEST_DONE, turns: 3 },
    } as Record<string, { stage: string; turns: number }>,
  } = {},
) {
  const inventory = Array<string>(INVENTORY_SLOTS).fill(fill);
  const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(fillCount);
  held.forEach(([item, count], slot) => {
    inventory[slot] = item;
    inventoryCounts[slot] = count;
  });
  sim.addPlayer(
    id,
    {
      x,
      y,
      smithingXp,
      miningXp,
      tools,
      inventory,
      inventoryCounts,
      combatXp: 0,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health: 10,
      quests,
    },
    id,
  );
}

const run = (ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      seen.push({ tick: sim.state.tick, event });
  }
};
const makes = () => seen.filter(({ event }) => event.type === "make");
const lines = () =>
  seen.flatMap(({ event }) => (event.type === "told" ? [event.line] : []));
const items = (id = "a") =>
  [...player(id).inventory]
    .map((item, slot) => [item, player(id).inventoryCounts[slot]])
    .filter(([item]) => item !== EMPTY_SLOT);

test("picking walks next to the station and starts work on arrival", () => {
  add([["copperOre", 1]], { x: 1, y: 1 });
  sim.queueMake("a", { item: "copperBar", all: false });
  run(1);
  expect(player().action).toBe("smithing");
  expect(makes()).toEqual([]);
  run(2);
  expect(player()).toMatchObject({ x: 3, y: 1, action: "smithing" });
  expect(makes()).toEqual([
    {
      tick: 3,
      event: { type: "make", player: "a", station: "furnace", ticks: 6 },
    },
  ]);
});

test("the smithy's stations ignore a player who hasn't helped Odo (#231)", () => {
  add([["copperOre", 1]], { quests: {} });
  sim.queueMake("a", { item: "copperBar", all: false });
  run(1);
  expect(player().action).toBe("");
  expect(makes()).toEqual([]);
});

test("materials leave and the item and experience arrive together at the end of the wait", () => {
  add([["copperOre", 2]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(6);
  expect(items()).toEqual([["copperOre", 2]]);
  expect(player().smithingXp).toBe(0);
  expect(player().miningXp).toBe(0);
  run(1);
  expect(items()).toEqual([
    ["copperOre", 1],
    ["copperBar", 1],
  ]);
  expect(player().smithingXp).toBe(0);
  expect(player().miningXp).toBe(2);
});

test("an Emberite bar gives 12 Mining experience and no Smithing", () => {
  add([["emberiteOre", 1]], { miningXp: xpForLevel(20) });
  sim.queueMake("a", { item: "emberiteBar", all: false });
  run(7);
  expect(player().smithingXp).toBe(0);
  expect(player().miningXp).toBe(xpForLevel(20) + 12);
});

test("a sword or shield gives only Smithing experience", () => {
  add([["copperBar", 7]]);
  sim.queueMake("a", { item: "copperSword", all: false });
  run(13);
  expect(player().smithingXp).toBe(18);
  sim.queueMake("a", { item: "copperShield", all: false });
  run(17);
  expect(player().smithingXp).toBe(42);
  expect(player().miningXp).toBe(0);
});

test("Smithing levels don't open smelting's Mining gate", () => {
  add([["ironOre", 1]], { smithingXp: xpForLevel(50) });
  sim.queueMake("a", { item: "ironBar", all: false });
  run(7);
  expect(items()).toEqual([["ironOre", 1]]);
  expect(player().smithingXp).toBe(xpForLevel(50));
  expect(player().miningXp).toBe(0);
  expect(lines()).toEqual(["Needs Mining 10"]);
});

test("Make 1 ends after one item, with no line", () => {
  add([["copperOre", 5]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(30);
  expect(items()).toEqual([
    ["copperOre", 4],
    ["copperBar", 1],
  ]);
  expect(player().action).toBe("");
  expect(makes()).toHaveLength(1);
  expect(lines()).toEqual([]);
});

test("Make all goes on until the materials run out, then says so once", () => {
  add([["copperOre", 2]]);
  sim.queueMake("a", { item: "copperBar", all: true });
  run(7);
  expect(items()).toEqual([
    ["copperOre", 1],
    ["copperBar", 1],
  ]);
  expect(player().action).toBe("smithing");
  expect(makes().map(({ tick }) => tick)).toEqual([1, 7]);
  expect(lines()).toEqual([]);
  run(30);
  expect(items()).toEqual([[`copperBar`, 2]]);
  expect(player().action).toBe("");
  expect(player().miningXp).toBe(4);
  expect(lines()).toEqual(["Not enough materials"]);
});

test("any new choice starts the wait over, even the same item, and costs nothing", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(5);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(6);
  expect(items()).toEqual([["copperOre", 1]]);
  run(1);
  expect(items()).toEqual([["copperBar", 1]]);
});

test("clicking something else stops the work, and only the progress is lost", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(5);
  sim.queueWalk("a", { x: 5, y: 2 });
  run(20);
  expect(items()).toEqual([["copperOre", 1]]);
  expect(player().smithingXp).toBe(0);
  expect(player().action).toBe("");
  expect(lines()).toEqual([]);
});

test("too few materials on arrival end it with a line, and nothing is made", () => {
  add([["copperBar", 2]]);
  sim.queueMake("a", { item: "copperSword", all: false });
  run(20);
  expect(makes()).toEqual([]);
  expect(items()).toEqual([["copperBar", 2]]);
  expect(player().action).toBe("");
  expect(lines()).toEqual(["Not enough materials"]);
});

test("too low a level on arrival ends it, whatever is held", () => {
  add([["ironOre", 5]], { miningXp: xpForLevel(9) });
  sim.queueMake("a", { item: "ironBar", all: true });
  run(20);
  expect(makes()).toEqual([]);
  expect(lines()).toEqual(["Needs Mining 10"]);
  add([["ironOre", 5]], { id: "b", miningXp: xpForLevel(10) });
  sim.queueMake("b", { item: "ironBar", all: false });
  run(7);
  expect(player("b").miningXp).toBe(xpForLevel(10) + 6);
  expect(player("b").smithingXp).toBe(0);
});

test("materials dropped during the wait end it with a line, and nothing is made", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(3);
  sim.queueDrop("a", 0, 20);
  run(1);
  expect(player().action).toBe("smithing");
  run(10);
  expect(items()).toEqual([]);
  expect(player().smithingXp).toBe(0);
  expect(lines()).toEqual(["Not enough materials"]);
});

test("the last ore in a full inventory becomes a bar", () => {
  add([["copperOre", 1]], { fill: "herb", fillCount: 20 });
  sim.queueMake("a", { item: "copperBar", all: false });
  run(7);
  expect(player().inventory[0]).toBe("copperBar");
  expect(player().inventoryCounts[0]).toBe(1);
  expect(lines()).toEqual([]);
});

test("with no room the materials stay, and it ends with one line", () => {
  add([["copperOre", 2]], { fill: "herb", fillCount: 20 });
  sim.queueMake("a", { item: "copperBar", all: true });
  run(20);
  expect(player().inventory[0]).toBe("copperOre");
  expect(player().inventoryCounts[0]).toBe(2);
  expect(player().smithingXp).toBe(0);
  expect(player().action).toBe("");
  expect(lines()).toEqual(["Your inventory is full."]);
});

test("a make refused for room rolls nothing, so it leaves the random stream alone", () => {
  const drawsIn = (make: boolean) => {
    const random = vi.fn(() => 0);
    sim = new Simulation(TILES, random);
    add([["copperBar", 10]], { fill: "herb", fillCount: 20 });
    if (make) sim.queueMake("a", { item: "copperSword", all: false });
    run(13);
    return random.mock.calls.length;
  };
  const refused = drawsIn(true);
  expect(lines()).toEqual(["Your inventory is full."]);
  expect(refused).toBe(drawsIn(false));
});

test("a stack with room is room, even in a full inventory", () => {
  add(
    [
      ["copperOre", 2],
      ["copperBar", 19],
    ],
    { fill: "herb", fillCount: 20 },
  );
  sim.queueMake("a", { item: "copperBar", all: false });
  run(7);
  expect(player().inventoryCounts[0]).toBe(1);
  expect(player().inventoryCounts[1]).toBe(20);
});

test("costs come out of several stacks, and an emptied slot is freed", () => {
  add([
    ["copperBar", 1],
    ["herb", 1],
    ["copperBar", 5],
  ]);
  sim.queueMake("a", { item: "copperShield", all: false });
  run(17);
  expect(items()).toEqual([
    ["copperShield", 1],
    ["herb", 1],
    ["copperBar", 2],
  ]);
  expect(player().smithingXp).toBe(24);
});

test("gear takes a slot each", () => {
  add([["copperBar", 6]]);
  sim.queueMake("a", { item: "copperSword", all: true });
  run(30);
  expect(items()).toEqual([
    ["copperSword", 1],
    ["copperSword", 1],
  ]);
});

test("eating and dropping don't interrupt it", () => {
  add([
    ["copperOre", 1],
    ["berry", 2],
    ["herb", 1],
  ]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(2);
  sim.queueEat("a", 1);
  sim.queueDrop("a", 2, 20);
  run(5);
  expect(items()).toEqual([
    ["copperBar", 1],
    ["berry", 1],
  ]);
  expect(makes()).toHaveLength(1);
});

test("any number of players can share a station", () => {
  add([["copperOre", 1]]);
  add([["copperOre", 1]], { id: "b", x: 3, y: 1 });
  add([["copperOre", 1]], { id: "c", x: 3, y: 2 });
  for (const id of ["a", "b", "c"])
    sim.queueMake(id, { item: "copperBar", all: false });
  run(7);
  for (const id of ["a", "b", "c"])
    expect(items(id)).toEqual([["copperBar", 1]]);
});

test("an enemy's swing doesn't turn someone working", () => {
  sim = new Simulation(
    parseRegion(["TTTTT", "TRFST", "TTTTT"].join("\n")),
    () => FAIL,
  );
  add([["copperOre", 20]], { x: 3, y: 1 });
  // Starts the Spider's fight, then turns straight to the furnace.
  sim.queueTarget("a", "0");
  run(1);
  sim.queueMake("a", { item: "copperBar", all: true });
  run(20);
  expect(seen.some(({ event }) => event.type === "enemySwing")).toBe(true);
  expect(player()).toMatchObject({ action: "smithing", target: "" });
});

test("a lost connection stops the work", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(1);
  sim.dropPlayer("a");
  run(10);
  expect(items()).toEqual([["copperOre", 1]]);
  expect(player().action).toBe("");
});

test("dying stops the work", () => {
  sim = new Simulation(
    parseRegion(["TTTTT", "TRFST", "TTTTT"].join("\n")),
    () => 0, // Every enemy swing lands, for 1 damage.
  );
  add([["copperOre", 1]], { x: 3, y: 1 });
  player().health = 1;
  sim.queueTarget("a", "0");
  run(1);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(5);
  expect(player().dead).toBe(true);
  expect(player().action).toBe("");
  run(5);
  // Dropped on death as it was, never made into a bar.
  const dropped = [...sim.state.groundItems.values()];
  expect(dropped.map(({ item, count }) => [item, count])).toEqual([
    ["copperOre", 1],
  ]);
  expect(player().smithingXp).toBe(0);
});

test.each([
  [{ item: "nothing", all: false }],
  [{ item: "berry", all: false }],
  [{ item: "constructor", all: true }],
  [{ item: ["copperBar"], all: true }],
  [{ all: true }],
  ["copperBar"],
  [undefined],
])("%j isn't a thing to make, and is ignored", (intent) => {
  add([["copperOre", 5]], { x: 1, y: 1 });
  sim.queueMake("a", intent as never);
  run(10);
  expect(makes()).toEqual([]);
  expect(player()).toMatchObject({ x: 1, y: 1, action: "" });
});

test("anything but `all: true` means Make 1", () => {
  add([["copperOre", 5]]);
  sim.queueMake("a", { item: "copperBar", all: "yes" } as never);
  run(20);
  expect(makes()).toHaveLength(1);
});

test("choosing an anvil recipe with no hammer is ignored, and a furnace recipe needs no tool", () => {
  add([["copperBar", 5]], { tools: [] });
  sim.queueMake("a", { item: "copperSword", all: false });
  run(20);
  expect(makes()).toEqual([]);
  add([["copperOre", 5]], { id: "b", x: 3, y: 1, tools: [] });
  sim.queueMake("b", { item: "copperBar", all: false });
  run(1);
  expect(makes()).toHaveLength(1);
});

test("a dead player's pick, or one from nobody, is ignored", () => {
  add([["copperOre", 5]]);
  player().dead = true;
  sim.queueMake("a", { item: "copperBar", all: false });
  run(1);
  expect(makes()).toEqual([]);
  expect(() =>
    sim.queueMake("nobody", { item: "copperBar", all: false }),
  ).not.toThrow();
});

test("a region without that station ignores the pick", () => {
  sim = new Simulation(parseRegion("TTT\nTRT\nTTT"), () => FAIL);
  add([["copperOre", 5]], { x: 1, y: 1 });
  sim.queueMake("a", { item: "copperBar", all: false });
  run(5);
  expect(makes()).toEqual([]);
});

test.each([
  ["west side", 1, 2],
  ["north side", 2, 1],
  ["east side", 4, 3],
  ["south side", 3, 4],
  ["north-west corner", 1, 1],
])(
  "a 2×2 furnace is one station, smelted at from its %s without a step",
  (_, x, y) => {
    sim = new Simulation(
      parseRegion(
        ["TTTTTT", "TR...T", "T.FF.T", "T.FF.T", "T....T", "TTTTTT"].join("\n"),
      ),
      () => FAIL,
    );
    add([["copperOre", 1]], { x, y });
    sim.queueMake("a", { item: "copperBar", all: false });
    run(7);
    expect(player()).toMatchObject({ x, y });
    expect(items()).toEqual([["copperBar", 1]]);
  },
);

test("what was made and its experience are saved", () => {
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(7);
  expect(sim.saveOf("a")).toMatchObject({ miningXp: 2 });
  expect(sim.saveOf("a")!.inventory![0]).toBe("copperBar");
});

test("a piece of gear can come out improved, for the same experience, and says what was made", () => {
  sim = new Simulation(TILES, () => 0);
  add([["copperBar", 3]]);
  sim.queueMake("a", { item: "copperSword", all: false });
  run(13);
  expect(items()).toEqual([["copperSword:rare:fortitude", 1]]);
  expect(player().smithingXp).toBe(18);
  expect(seen.map(({ event }) => event)).toContainEqual({
    type: "made",
    player: "a",
    item: "copperSword:rare:fortitude",
  });
});

test("a bar is never improved, even on the luckiest roll", () => {
  sim = new Simulation(TILES, () => 0);
  add([["copperOre", 1]]);
  sim.queueMake("a", { item: "copperBar", all: false });
  run(7);
  expect(items()).toEqual([["copperBar", 1]]);
});

test("one bar of a tier makes ten arrowheads of it, for 6 Smithing (#228)", () => {
  add([["copperBar", 1]]);
  sim.queueMake("a", { item: "copperArrowhead", all: false });
  run(7);
  expect(items()).toEqual([["copperArrowhead", 10]]);
  expect(player().smithingXp).toBe(6);
  expect(seen.map(({ event }) => event)).toContainEqual({
    type: "made",
    player: "a",
    item: "copperArrowhead",
  });
});

test("Make all tops up the batch's stack before filling another slot (#228)", () => {
  add([["copperBar", 3]]);
  sim.queueMake("a", { item: "copperArrowhead", all: true });
  run(25);
  // The third batch's stack takes the slot the last bar freed.
  expect(items()).toEqual([
    ["copperArrowhead", 10],
    ["copperArrowhead", 20],
  ]);
  expect(player().smithingXp).toBe(18);
});

test("an Emberite arrowhead needs no Emberbone, unlike the gear and the knife (#228)", () => {
  add([["emberiteBar", 1]], { smithingXp: xpForLevel(20) });
  sim.queueMake("a", { item: "emberiteArrowhead", all: false });
  run(7);
  expect(items()).toEqual([["emberiteArrowhead", 10]]);
});

test("a throwing knife takes an Emberbone too at Emberite, like the gear (#228)", () => {
  add([["emberiteBar", 1]], { smithingXp: xpForLevel(20) });
  sim.queueMake("a", { item: "emberiteThrowingKnife", all: false });
  run(7);
  expect(items()).toEqual([["emberiteBar", 1]]);
  expect(lines()).toEqual(["Not enough materials"]);
  add(
    [
      ["emberiteBar", 1],
      ["emberbone", 1],
    ],
    { id: "b", smithingXp: xpForLevel(20) },
  );
  sim.queueMake("b", { item: "emberiteThrowingKnife", all: false });
  run(7);
  expect(items("b")).toEqual([["emberiteThrowingKnife", 1]]);
});

// The range is at (4,1), with (3,1) and (5,1) beside it, and no enemies to spend rolls on.
const RANGE_TILES = parseRegion(
  ["TTTTTTT", "TR..G.T", "T.....T", "TTTTTTT"].join("\n"),
);

describe("cooking at the range (#221)", () => {
  let sim: Simulation;
  let seen: { tick: number; event: WorldEvent }[];

  beforeEach(() => {
    sim = new Simulation(RANGE_TILES, () => FAIL);
    seen = [];
  });

  /** Adds a player holding `held` next to the range, with `cookingXp` and a random source. */
  function cook(
    held: [string, number][],
    {
      id = "a",
      x = 5,
      y = 1,
      cookingXp = 0,
      random = (() => FAIL) as () => number,
    } = {},
  ) {
    if (random !== undefined) sim = new Simulation(RANGE_TILES, random);
    const inventory = Array<string>(INVENTORY_SLOTS).fill("");
    const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
    held.forEach(([item, count], slot) => {
      inventory[slot] = item;
      inventoryCounts[slot] = count;
    });
    sim.addPlayer(
      id,
      {
        x,
        y,
        combatXp: 0,
        defenseXp: 0,
        herblawXp: 0,
        hitpointsXp: 4050,
        health: 10,
        cookingXp,
        inventory,
        inventoryCounts,
      },
      id,
    );
  }

  const run = (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      sim.tick();
      for (const event of sim.events.splice(0))
        seen.push({ tick: sim.state.tick, event });
    }
  };
  const lines = () =>
    seen.flatMap(({ event }) => (event.type === "told" ? [event.line] : []));
  const items = (id = "a") =>
    [...sim.state.players.get(id)!.inventory]
      .map((item, slot) => [
        item,
        sim.state.players.get(id)!.inventoryCounts[slot],
      ])
      .filter(([item]) => item !== EMPTY_SLOT);

  test("a raw fish cooks into a cooked one, paying Cooking", () => {
    cook([["perch", 1]]);
    sim.queueMake("a", { item: "cookedPerch", all: false });
    run(7);
    expect(items()).toEqual([["cookedPerch", 1]]);
    expect(sim.state.players.get("a")!.cookingXp).toBe(12);
    expect(seen.map(({ event }) => event)).toContainEqual({
      type: "make",
      player: "a",
      station: "range",
      ticks: 6,
    });
  });

  test("the range needs no tool", () => {
    cook([["perch", 1]], { random: () => 1 });
    sim.state.players.get("a")!.tools.length = 0;
    sim.queueMake("a", { item: "cookedPerch", all: false });
    run(7);
    expect(items()).toEqual([["cookedPerch", 1]]);
  });

  test("a burn eats the fish: no item, no experience, and a line", () => {
    cook([["perch", 1]], { random: () => 0 }); // Every roll burns or improves.
    sim.queueMake("a", { item: "cookedPerch", all: false });
    run(7);
    expect(items()).toEqual([]);
    expect(sim.state.players.get("a")!.cookingXp).toBe(0);
    expect(lines()).toEqual(["You burn the cooked perch."]);
  });

  test("Make all cooks on through a burn, until the fish run out", () => {
    cook([["perch", 2]], { random: () => 0 });
    sim.queueMake("a", { item: "cookedPerch", all: true });
    run(20);
    expect(items()).toEqual([]);
    expect(lines()).toEqual([
      "You burn the cooked perch.",
      "You burn the cooked perch.",
      "Not enough materials",
    ]);
  });

  test("a fish that doesn't burn can come out Delicious", () => {
    const random = vi.fn().mockReturnValueOnce(0.5).mockReturnValue(0);
    cook([["perch", 1]], { random });
    sim.queueMake("a", { item: "cookedPerch", all: false });
    run(7);
    expect(items()).toEqual([["cookedPerch:delicious", 1]]);
    expect(sim.state.players.get("a")!.cookingXp).toBe(12);
    expect(seen.map(({ event }) => event)).toContainEqual({
      type: "made",
      player: "a",
      item: "cookedPerch:delicious",
    });
  });

  test("a dish costs its fish and its berry, and burns both", () => {
    const cooking5 = xpForLevel(5);
    cook(
      [
        ["perch", 1],
        ["berry", 1],
      ],
      { cookingXp: cooking5, random: () => 0 },
    );
    sim.queueMake("a", { item: "berryPerch", all: false });
    run(7);
    expect(items()).toEqual([]);
    expect(lines()).toEqual(["You burn the berry perch."]);
    cook(
      [
        ["perch", 1],
        ["berry", 1],
      ],
      { id: "b", cookingXp: cooking5, random: () => 0.99 },
    );
    sim.queueMake("b", { item: "berryPerch", all: false });
    run(7);
    expect(items("b")).toEqual([["berryPerch", 1]]);
  });
});

// The workbench is at (4,1), with (3,1) and (5,1) beside it, and no enemies to spend rolls on.
const WORKBENCH_TILES = parseRegion(
  ["TTTTTTT", "TR..w..T", "T......T", "TTTTTTT"].join("\n"),
);

describe("crafting at the workbench (#225)", () => {
  let sim: Simulation;
  let seen: { tick: number; event: WorldEvent }[];

  beforeEach(() => {
    sim = new Simulation(WORKBENCH_TILES, () => 0.99);
    seen = [];
  });

  /** Adds a player holding `held` next to the workbench, with `craftingXp` and a random source. */
  function craft(
    held: [string, number][],
    {
      id = "a",
      x = 5,
      y = 1,
      craftingXp = 0,
      random = (() => 0.99) as () => number,
    } = {},
  ) {
    if (random !== undefined) sim = new Simulation(WORKBENCH_TILES, random);
    const inventory = Array<string>(INVENTORY_SLOTS).fill("");
    const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
    held.forEach(([item, count], slot) => {
      inventory[slot] = item;
      inventoryCounts[slot] = count;
    });
    sim.addPlayer(
      id,
      {
        x,
        y,
        combatXp: 0,
        defenseXp: 0,
        herblawXp: 0,
        hitpointsXp: 4050,
        health: 10,
        craftingXp,
        inventory,
        inventoryCounts,
      },
      id,
    );
  }

  const run = (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      sim.tick();
      for (const event of sim.events.splice(0))
        seen.push({ tick: sim.state.tick, event });
    }
  };
  const lines = () =>
    seen.flatMap(({ event }) => (event.type === "told" ? [event.line] : []));
  const made = () =>
    seen.flatMap(({ event }) => (event.type === "made" ? [event.item] : []));
  const items = (id = "a") =>
    [...sim.state.players.get(id)!.inventory]
      .map((item, slot) => [
        item,
        sim.state.players.get(id)!.inventoryCounts[slot],
      ])
      .filter(([item]) => item !== EMPTY_SLOT);

  test("a rope spins from two silk, paying Crafting, and never rolls improved", () => {
    craft([["spiderSilk", 2]], { random: () => 0 });
    sim.queueMake("a", { item: "rope", all: false });
    run(7);
    expect(items()).toEqual([["rope", 1]]);
    expect(sim.state.players.get("a")!.craftingXp).toBe(8);
    expect(made()).toEqual(["rope"]);
    expect(seen.map(({ event }) => event)).toContainEqual({
      type: "make",
      player: "a",
      station: "workbench",
      ticks: 6,
    });
  });

  test("a torch costs its birch log and its rope", () => {
    craft(
      [
        ["birchLog", 1],
        ["rope", 1],
      ],
      { craftingXp: xpForLevel(5) },
    );
    sim.queueMake("a", { item: "torch", all: false });
    run(7);
    expect(items()).toEqual([["torch", 1]]);
    expect(sim.state.players.get("a")!.craftingXp).toBe(xpForLevel(5) + 14);
  });

  test("a vial needs Crafting 10 and comes from a cinderglass", () => {
    craft([["cinderglass", 1]], { craftingXp: xpForLevel(9) });
    sim.queueMake("a", { item: "vial", all: false });
    run(7);
    expect(items()).toEqual([["cinderglass", 1]]);
    expect(lines()).toEqual(["Needs Crafting 10"]);
    craft([["cinderglass", 1]], { id: "b", craftingXp: xpForLevel(10) });
    sim.queueMake("b", { item: "vial", all: false });
    run(7);
    expect(items("b")).toEqual([["vial", 1]]);
    expect(sim.state.players.get("b")!.craftingXp).toBe(xpForLevel(10) + 20);
  });

  test("the workbench needs no tool", () => {
    craft([["spiderSilk", 2]]);
    sim.state.players.get("a")!.tools.length = 0;
    sim.queueMake("a", { item: "rope", all: false });
    run(7);
    expect(items()).toEqual([["rope", 1]]);
  });
});

// The workbench is at (4,1), with (3,1) and (5,1) beside it, and no enemies to spend rolls on.

describe("fletching at the workbench (#228)", () => {
  let sim: Simulation;
  let seen: { tick: number; event: WorldEvent }[];

  beforeEach(() => {
    sim = new Simulation(WORKBENCH_TILES, () => 0.99);
    seen = [];
  });

  /** Adds a player holding `held` next to the workbench, with `fletchingXp` and a random source. */
  function fletch(
    held: [string, number][],
    {
      id = "a",
      x = 5,
      y = 1,
      fletchingXp = 0,
      smithingXp = 0,
      random = (() => 0.99) as () => number,
    } = {},
  ) {
    if (random !== undefined) sim = new Simulation(WORKBENCH_TILES, random);
    const inventory = Array<string>(INVENTORY_SLOTS).fill("");
    const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
    held.forEach(([item, count], slot) => {
      inventory[slot] = item;
      inventoryCounts[slot] = count;
    });
    sim.addPlayer(
      id,
      {
        x,
        y,
        combatXp: 0,
        defenseXp: 0,
        herblawXp: 0,
        hitpointsXp: 4050,
        health: 10,
        fletchingXp,
        smithingXp,
        inventory,
        inventoryCounts,
      },
      id,
    );
  }

  const run = (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      sim.tick();
      for (const event of sim.events.splice(0))
        seen.push({ tick: sim.state.tick, event });
    }
  };
  const lines = () =>
    seen.flatMap(({ event }) => (event.type === "told" ? [event.line] : []));
  const items = (id = "a") =>
    [...sim.state.players.get(id)!.inventory]
      .map((item, slot) => [
        item,
        sim.state.players.get(id)!.inventoryCounts[slot],
      ])
      .filter(([item]) => item !== EMPTY_SLOT);

  test("a log of any tier splits into ten shafts, for 2 Fletching", () => {
    fletch([["birchLog", 1]]);
    sim.queueMake("a", { item: "arrowShaft", all: false });
    run(7);
    expect(items()).toEqual([["arrowShaft", 10]]);
    expect(sim.state.players.get("a")!.fletchingXp).toBe(2);
    fletch([["charwoodLog", 1]], { id: "b" });
    sim.queueMake("b", { item: "arrowShaft", all: false });
    run(7);
    expect(items("b")).toEqual([["arrowShaft", 10]]);
    expect(sim.state.players.get("b")!.fletchingXp).toBe(2);
  });

  test("Make all keeps fletching shafts from two logs into one stack (#228)", () => {
    fletch([["oakLog", 2]]);
    sim.queueMake("a", { item: "arrowShaft", all: true });
    run(14);
    expect(items()).toEqual([["arrowShaft", 20]]);
    expect(sim.state.players.get("a")!.fletchingXp).toBe(4);
  });

  test("an arrow costs ten of each of its parts, and the head's tier is its own", () => {
    fletch(
      [
        ["arrowShaft", 10],
        ["ironArrowhead", 10],
        ["feather", 10],
      ],
      { random: () => 0.99 },
    );
    sim.queueMake("a", { item: "ironArrow", all: false });
    run(7);
    expect(items()).toEqual([["ironArrow", 10]]);
    expect(sim.state.players.get("a")!.fletchingXp).toBe(8);
    // The copper head doesn't fit the iron arrow, and a missing feather is noticed too.
    fletch(
      [
        ["arrowShaft", 10],
        ["copperArrowhead", 10],
        ["feather", 10],
      ],
      { id: "b" },
    );
    sim.queueMake("b", { item: "ironArrow", all: false });
    run(7);
    expect(items("b")).toEqual([
      ["arrowShaft", 10],
      ["copperArrowhead", 10],
      ["feather", 10],
    ]);
    expect(lines()).toEqual(["Not enough materials"]);
  });

  test("a shaft's batch never rolls improved, like a bar", () => {
    const random = vi.fn(() => 0.99);
    fletch([["birchLog", 1]], { random });
    sim.queueMake("a", { item: "arrowShaft", all: false });
    run(7);
    expect(items()).toEqual([["arrowShaft", 10]]);
    expect(random).not.toHaveBeenCalled();
  });

  test("a bow rolls improved like all gear, at its Fletching level", () => {
    const random = vi.fn().mockReturnValue(0);
    fletch(
      [
        ["birchLog", 1],
        ["rope", 1],
      ],
      { fletchingXp: xpForLevel(20), random },
    );
    sim.queueMake("a", { item: "birchBow", all: false });
    run(7);
    // At Fletching 20 the improved chance is 7.8%, so the first roll improves it.
    expect(items()).toEqual([["birchBow:rare:fortitude", 1]]);
    expect(random).toHaveBeenCalledTimes(3);
    expect(sim.state.players.get("a")!.fletchingXp).toBe(xpForLevel(20) + 20);
  });

  test("a bow's improved chance is the Fletching level's, not the Smithing level's", () => {
    // 7.8% at Fletching 20: just over refuses, though Smithing 99 would have improved it.
    fletch(
      [
        ["birchLog", 1],
        ["rope", 1],
      ],
      {
        fletchingXp: xpForLevel(20),
        smithingXp: xpForLevel(99),
        random: () => 0.078,
      },
    );
    sim.queueMake("a", { item: "birchBow", all: false });
    run(7);
    expect(items()).toEqual([["birchBow", 1]]);
    fletch(
      [
        ["birchLog", 1],
        ["rope", 1],
      ],
      { id: "b", fletchingXp: xpForLevel(20), random: () => 0.0779 },
    );
    sim.queueMake("b", { item: "birchBow", all: false });
    run(7);
    expect(items("b")).toEqual([["birchBow:rare:fortitude", 1]]);
  });

  test("a bow costs its own wood and a rope, gated on Fletching at 1, 10 and 20", () => {
    fletch(
      [
        ["oakLog", 1],
        ["rope", 1],
      ],
      { fletchingXp: xpForLevel(9) },
    );
    sim.queueMake("a", { item: "oakBow", all: false });
    run(7);
    expect(items()).toEqual([
      ["oakLog", 1],
      ["rope", 1],
    ]);
    expect(lines()).toEqual(["Needs Fletching 10"]);
    fletch(
      [
        ["birchLog", 1],
        ["rope", 1],
      ],
      { id: "b" },
    );
    sim.queueMake("b", { item: "birchBow", all: false });
    run(7);
    expect(items("b")).toEqual([["birchBow", 1]]);
    expect(sim.state.players.get("b")!.fletchingXp).toBe(20);
  });
});

describe("the gossamer cloak's augmentation on the server (#217, #225)", () => {
  let sim: Simulation;
  let seen: { tick: number; event: WorldEvent }[];

  beforeEach(() => {
    sim = new Simulation(WORKBENCH_TILES, () => 0.99);
    seen = [];
  });

  /** Adds a player holding `held` next to the workbench, at Crafting 15 or above unless told otherwise. */
  function augment(
    held: [string, number][],
    { id = "a", x = 5, y = 1, craftingXp = xpForLevel(15) } = {},
  ) {
    const inventory = Array<string>(INVENTORY_SLOTS).fill("");
    const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
    held.forEach(([item, count], slot) => {
      inventory[slot] = item;
      inventoryCounts[slot] = count;
    });
    sim.addPlayer(
      id,
      {
        x,
        y,
        combatXp: 0,
        defenseXp: 0,
        herblawXp: 0,
        hitpointsXp: 4050,
        health: 10,
        craftingXp,
        inventory,
        inventoryCounts,
      },
      id,
    );
  }

  const run = (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      sim.tick();
      for (const event of sim.events.splice(0))
        seen.push({ tick: sim.state.tick, event });
    }
  };
  const lines = () =>
    seen.flatMap(({ event }) => (event.type === "told" ? [event.line] : []));
  const made = () =>
    seen.flatMap(({ event }) => (event.type === "made" ? [event.item] : []));
  const items = (id = "a") =>
    [...sim.state.players.get(id)!.inventory]
      .map((item, slot) => [
        item,
        sim.state.players.get(id)!.inventoryCounts[slot],
      ])
      .filter(([item]) => item !== EMPTY_SLOT);

  test("a cape becomes its gossamer cloak, which keeps the cape's Quality and Virtue", () => {
    augment([
      ["spiderSilk", 1],
      ["copperMightCape:uncommon:fortitude", 1],
    ]);
    sim.queueMake("a", { item: "gossamerCloak", all: false });
    run(7);
    expect(items()).toEqual([
      ["copperMightCape:uncommon:fortitude:gossamer", 1],
    ]);
    expect(sim.state.players.get("a")!.craftingXp).toBe(xpForLevel(15) + 25);
    expect(made()).toEqual(["copperMightCape:uncommon:fortitude:gossamer"]);
  });

  test("Make all goes cape by cape, each keeping its own rolls, until the capes or silk run out", () => {
    augment([
      ["spiderSilk", 2],
      ["copperMightCape:uncommon:fortitude", 1],
      ["bronzeFortitudeCape", 1],
      ["copperAvoidanceCape:rare:avoidance:gossamer", 1],
    ]);
    sim.queueMake("a", { item: "gossamerCloak", all: true });
    run(26);
    expect(items()).toEqual([
      ["bronzeFortitudeCape:gossamer", 1],
      ["copperMightCape:uncommon:fortitude:gossamer", 1],
      // An already-augmented cape is no input, and stays as it is.
      ["copperAvoidanceCape:rare:avoidance:gossamer", 1],
    ]);
    expect(made()).toEqual([
      "copperMightCape:uncommon:fortitude:gossamer",
      "bronzeFortitudeCape:gossamer",
    ]);
    expect(sim.state.players.get("a")!.craftingXp).toBe(xpForLevel(15) + 50);
    expect(lines()).toEqual(["Not enough materials"]);
  });

  test("with no cape, or one already augmented, nothing is made", () => {
    augment([["spiderSilk", 1]]);
    sim.queueMake("a", { item: "gossamerCloak", all: false });
    run(7);
    expect(items()).toEqual([["spiderSilk", 1]]);
    expect(lines()).toEqual(["Not enough materials"]);
    augment(
      [
        ["spiderSilk", 1],
        ["ironMightCape:rare:fortitude:gossamer", 1],
      ],
      {
        id: "b",
      },
    );
    sim.queueMake("b", { item: "gossamerCloak", all: false });
    run(7);
    expect(items("b")).toEqual([
      ["spiderSilk", 1],
      ["ironMightCape:rare:fortitude:gossamer", 1],
    ]);
  });

  test("the cloak takes the cape's slot, even in a full inventory", () => {
    augment(
      [
        ["spiderSilk", 1],
        ["copperMightCape", 1],
      ],
      { craftingXp: xpForLevel(15) },
    );
    const player = sim.state.players.get("a")!;
    for (let slot = 2; slot < INVENTORY_SLOTS; slot++) {
      player.inventory[slot] = "herb";
      player.inventoryCounts[slot] = 20;
    }
    sim.queueMake("a", { item: "gossamerCloak", all: false });
    run(7);
    expect(items("a")).toEqual([
      ["copperMightCape:gossamer", 1],
      ...Array(28).fill(["herb", 20]),
    ]);
    expect(sim.state.players.get("a")!.craftingXp).toBe(xpForLevel(15) + 25);
    expect(lines()).toEqual([]);
  });

  test("the cloak equips into the cape slot, at its cape's gate", () => {
    augment([
      ["spiderSilk", 1],
      ["copperMightCape", 1],
    ]);
    sim.queueMake("a", { item: "gossamerCloak", all: false });
    run(7);
    sim.equip("a", 0);
    expect(sim.state.players.get("a")!.cape).toBe("copperMightCape:gossamer");
  });
});

// The altar is at (4,1), with (3,1) beside it, and no enemies to spend rolls on (#232).
const ALTAR_TILES = parseRegion(
  ["TTTTTTT", "TR..O..T", "T......T", "TTTTTTT"].join("\n"),
);

describe("runecrafting at the altar (#232)", () => {
  let sim: Simulation;
  let seen: { tick: number; event: WorldEvent }[];

  beforeEach(() => {
    sim = new Simulation(ALTAR_TILES, () => 0.99);
    seen = [];
  });

  /** Adds a player holding `held` next to the altar, with `runecraftingXp`. */
  function craft(
    held: [string, number][],
    {
      id = "a",
      x = 3,
      y = 1,
      runecraftingXp = 0,
    }: { id?: string; x?: number; y?: number; runecraftingXp?: number } = {},
  ) {
    const inventory = Array<string>(INVENTORY_SLOTS).fill("");
    const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
    held.forEach(([item, count], slot) => {
      inventory[slot] = item;
      inventoryCounts[slot] = count;
    });
    sim.addPlayer(
      id,
      {
        x,
        y,
        combatXp: 0,
        defenseXp: 0,
        herblawXp: 0,
        hitpointsXp: 4050,
        health: 10,
        runecraftingXp,
        inventory,
        inventoryCounts,
      },
      id,
    );
  }

  const run = (ticks: number) => {
    for (let i = 0; i < ticks; i++) {
      sim.tick();
      for (const event of sim.events.splice(0))
        seen.push({ tick: sim.state.tick, event });
    }
  };
  const lines = () =>
    seen.flatMap(({ event }) => (event.type === "told" ? [event.line] : []));
  const makes = () => seen.filter(({ event }) => event.type === "make");
  const items = (id = "a") =>
    [...sim.state.players.get(id)!.inventory]
      .map((item, slot) => [
        item,
        sim.state.players.get(id)!.inventoryCounts[slot],
      ])
      .filter(([item]) => item !== EMPTY_SLOT);

  test("the altar needs no quest and no tool, and the air rune is the first rune", () => {
    craft([["runeEssence", 1]]);
    sim.queueMake("a", { item: "airRune", all: false });
    run(7);
    expect(items()).toEqual([["airRune", 1]]);
    expect(sim.state.players.get("a")!.runecraftingXp).toBe(5);
    expect(
      seen.flatMap(({ event }) =>
        event.type === "make" ? [event.station] : [],
      ),
    ).toEqual(["altar"]);
    expect(lines()).toEqual([]);
  });

  test("each rune is gated on Runecrafting, one essence to one rune, and never fails", () => {
    craft([["runeEssence", 2]], { runecraftingXp: xpForLevel(4) });
    sim.queueMake("a", { item: "waterRune", all: true });
    run(14);
    expect(lines()).toEqual(["Needs Runecrafting 5"]);
    expect(items()).toEqual([["runeEssence", 2]]);
    craft([["runeEssence", 2]], {
      id: "b",
      runecraftingXp: xpForLevel(5),
    });
    sim.queueMake("b", { item: "waterRune", all: true });
    run(14);
    expect(items("b")).toEqual([["waterRune", 2]]);
    expect(sim.state.players.get("b")!.runecraftingXp).toBe(xpForLevel(5) + 16);
  });

  test("at a rune's doubling level one essence makes two runes and pays for both", () => {
    // Air doubles at 20; at 19 the same essence gives one rune and 5 experience.
    craft([["runeEssence", 1]], { runecraftingXp: xpForLevel(19) });
    sim.queueMake("a", { item: "airRune", all: false });
    run(7);
    expect(items()).toEqual([["airRune", 1]]);
    expect(sim.state.players.get("a")!.runecraftingXp).toBe(xpForLevel(19) + 5);
    craft([["runeEssence", 1]], {
      id: "b",
      runecraftingXp: xpForLevel(20),
    });
    sim.queueMake("b", { item: "airRune", all: false });
    run(7);
    expect(items("b")).toEqual([["airRune", 2]]);
    expect(sim.state.players.get("b")!.runecraftingXp).toBe(
      xpForLevel(20) + 10,
    );
  });

  test("Make all keeps the doubling rune by rune, until the essence runs out", () => {
    craft(
      [
        ["runeEssence", 3],
        ["airRune", 16],
      ],
      { runecraftingXp: xpForLevel(20) },
    );
    sim.queueMake("a", { item: "airRune", all: true });
    run(26);
    expect(items()).toEqual([
      // The essence's own slot empties first, so the last make's two runes fill it.
      ["airRune", 2],
      ["airRune", 20],
    ]);
    expect(sim.state.players.get("a")!.runecraftingXp).toBe(
      xpForLevel(20) + 30,
    );
    // Make all runs out of essence on its next try, and says so once.
    expect(lines()).toEqual(["Not enough materials"]);
  });
});
