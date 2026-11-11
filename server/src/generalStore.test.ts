import {
  COINS,
  INVENTORY_SLOTS,
  parseRegion,
  type Deal,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, describe, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

const TILES = parseRegion(
  ["TTTTTTTTT", "TR.....MT", "T.......T", "TB......T", "TTTTTTTTT"].join("\n"),
);
const BESIDE_MARTA = { x: 6, y: 1 };
const WHAT_HAVE_YOU_GOT = 0;
const STARTING_SHELF = [
  ["berry", 20],
  ["herb", 10],
  ["copperOre", 5],
  ["coal", 5],
];

let sim: Simulation;
let events: WorldEvent[];
const me = (id = "a") => sim.state.players.get(id)!;
/** What a store sends: its opening and closing, and its lines in the chat box. */
const ticks = (n: number) => {
  for (let i = 0; i < n; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      if (["storeOpened", "storeClosed", "told", "talk"].includes(event.type))
        events.push(event);
  }
};
const shelf = () =>
  [...sim.state.shelf].map((item, at) => [item, sim.state.shelfCounts[at]]);
/** The filled slots as [item, count] pairs. */
const held = (id = "a") =>
  [...me(id).inventory]
    .map((item, slot) => [item, me(id).inventoryCounts[slot]])
    .filter(([item]) => item);

/** Player `id` beside Marta, holding these [item, count] stacks from slot 0. */
function addShopper(id: string, ...stacks: [string, number][]) {
  const inventory = Array<string>(INVENTORY_SLOTS).fill("");
  const inventoryCounts = Array<number>(INVENTORY_SLOTS).fill(0);
  stacks.forEach(([item, count], slot) => {
    inventory[slot] = item;
    inventoryCounts[slot] = count;
  });
  sim.addPlayer(id, {
    ...BESIDE_MARTA,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    health: 1000,
    inventory,
    inventoryCounts,
  });
}
/** Opens the store for `id` with the right-click Trade, already beside Marta. */
const openStore = (id = "a") => {
  sim.queueVisit(id, "marta", "openStore");
  ticks(1);
  events = [];
};
const deal = (id: string, deal: Partial<Deal>) => {
  sim.deal(id, { buy: [], sell: [], ...deal });
  ticks(1);
};

beforeEach(() => {
  events = [];
  sim = new Simulation(TILES, () => 0.99);
});

describe("opening the store", () => {
  test("Marta's conversation offers the store, and choosing it opens the window", () => {
    addShopper("a");
    sim.queueVisit("a", "marta");
    ticks(1);
    events = [];
    sim.choose("a", WHAT_HAVE_YOU_GOT);
    ticks(1);
    expect(events).toEqual([
      { type: "talk", player: "a", villager: "marta", node: "store" },
      { type: "storeOpened", player: "a" },
    ]);
  });

  test("Trade walks over to Marta and opens the window on arrival, with no conversation", () => {
    sim.addPlayer("a");
    sim.queueVisit("a", "marta", "openStore");
    ticks(1);
    expect(events).toEqual([]);
    ticks(30);
    expect(me()).toMatchObject({ ...BESIDE_MARTA, action: "" });
    expect(events).toEqual([{ type: "storeOpened", player: "a" }]);
  });

  test("an action the villager's conversation doesn't offer is ignored", () => {
    addShopper("a");
    for (const then of ["giveTools", "nonsense", 3]) {
      sim.queueVisit("a", "marta", then as string);
      ticks(1);
    }
    sim.queueVisit("a", "odo", "openStore");
    ticks(30);
    expect(events).toEqual([]);
  });

  test("walking away closes it with a line, and a deal after that is ignored", () => {
    addShopper("a", ["tin", 5]);
    openStore();
    sim.queueWalk("a", { x: 1, y: 1 });
    ticks(30);
    expect(events).toEqual([
      { type: "told", player: "a", line: "You walk away from Marta." },
      { type: "storeClosed", player: "a" },
    ]);
    Object.assign(me(), BESIDE_MARTA);
    deal("a", { sell: [{ item: "tin", count: 5 }] });
    expect(held()).toEqual([["tin", 5]]);
  });

  test("closing it ends it quietly", () => {
    addShopper("a", ["tin", 5]);
    openStore();
    sim.closeStore("a");
    deal("a", { sell: [{ item: "tin", count: 5 }] });
    expect(events).toEqual([]);
    expect(held()).toEqual([["tin", 5]]);
  });

  test("being hit closes it", () => {
    sim = new Simulation(parseRegion("TTTTT\nTMRST\nTTTTT"), () => 0);
    sim.addPlayer("a");
    openStore();
    sim.queueTarget("a", "0");
    for (let i = 0; i < 50 && me().health === me().maxHealth; i++) ticks(1);
    expect(events).toEqual([
      {
        type: "told",
        player: "a",
        line: "You're hit, and Marta stops trading.",
      },
      { type: "storeClosed", player: "a" },
    ]);
  });
});

describe("a deal", () => {
  test("sells first, then buys with the proceeds, and the sold items go on the shelf", () => {
    addShopper("a", ["ironSword", 1], ["tin", 3]);
    openStore();
    deal("a", {
      sell: [
        { item: "ironSword", count: 1 },
        { item: "tin", count: 3 },
      ],
      buy: [{ item: "berry", count: 2, stock: 20 }],
    });
    // The sword pays 9 and the tin 1 each: 12, less 6 for two berries.
    expect(held()).toEqual([
      [COINS, 6],
      ["berry", 2],
    ]);
    expect(shelf()).toEqual([
      ["berry", 18],
      ...STARTING_SHELF.slice(1),
      ["ironSword", 1],
      ["tin", 3],
    ]);
    expect(events).toEqual([
      {
        type: "told",
        player: "a",
        line: "Deal done: you paid 6 coins and got 12.",
      },
    ]);
  });

  test("is answered, so the client keeps its trays until the deal is done", () => {
    addShopper("a", [COINS, 4]);
    openStore();
    const answers = () =>
      sim.events.splice(0).filter(({ type }) => type === "dealAnswered");
    sim.deal("a", { buy: [{ item: "berry", count: 2, stock: 20 }], sell: [] });
    expect(answers()).toEqual([
      { type: "dealAnswered", player: "a", done: false },
    ]);
    sim.deal("a", { buy: [{ item: "berry", count: 1, stock: 20 }], sell: [] });
    expect(answers()).toEqual([
      { type: "dealAnswered", player: "a", done: true },
    ]);
  });

  test("that the rules refuse changes nothing and says why", () => {
    addShopper("a", [COINS, 4]);
    openStore();
    deal("a", { buy: [{ item: "berry", count: 2, stock: 20 }] });
    expect(held()).toEqual([[COINS, 4]]);
    expect(shelf()).toEqual(STARTING_SHELF);
    expect(events).toEqual([
      { type: "told", player: "a", line: "You need 2 more coins." },
    ]);
  });

  test("is refused when another player bought the stock first", () => {
    addShopper("a", [COINS, 100]);
    addShopper("b", [COINS, 100]);
    openStore("a");
    openStore("b");
    deal("b", { buy: [{ item: "coal", count: 3, stock: 5 }] });
    events = [];
    deal("a", { buy: [{ item: "coal", count: 3, stock: 5 }] });
    expect(held()).toEqual([[COINS, 100]]);
    expect(events).toEqual([
      {
        type: "told",
        player: "a",
        line: "The store doesn't have that many left.",
      },
    ]);
  });

  test("is refused when the shelf changed after it was set out, even with enough left", () => {
    addShopper("a", [COINS, 100]);
    addShopper("b", [COINS, 100]);
    openStore("a");
    openStore("b");
    deal("b", { buy: [{ item: "coal", count: 1, stock: 5 }] });
    events = [];
    deal("a", { buy: [{ item: "coal", count: 3, stock: 5 }] });
    expect(held()).toEqual([[COINS, 100]]);
    expect(events).toEqual([
      {
        type: "told",
        player: "a",
        line: "The shelf has changed since you set out this deal.",
      },
    ]);
  });

  test("of the wrong shape is ignored", () => {
    addShopper("a", ["tin", 5]);
    openStore();
    for (const bad of [
      null,
      "deal",
      { buy: "berry", sell: [] },
      { buy: [], sell: [{ item: "tin", count: 1.5 }] },
      { buy: [], sell: [{ item: "tin", count: -1 }] },
      { buy: [], sell: [{ item: ["tin"], count: 1 }] },
      { buy: [{ item: "berry", count: 1 }], sell: [] },
      { buy: [{ item: "berry", count: 1, stock: "20" }], sell: [] },
    ])
      sim.deal("a", bad as Deal);
    ticks(1);
    expect(held()).toEqual([["tin", 5]]);
    expect(events).toEqual([]);
  });
});

describe("the shelf", () => {
  test("refills the store's own stock by one every 30 s, up to its starting amount", () => {
    addShopper("a", [COINS, 100]);
    openStore();
    deal("a", { buy: [{ item: "coal", count: 5, stock: 5 }] });
    expect(shelf()[3]).toEqual(["coal", 0]);
    ticks(99);
    expect(shelf()[3]).toEqual(["coal", 1]);
    ticks(400);
    expect(shelf()[3]).toEqual(["coal", 5]);
    ticks(100);
    expect(shelf()[3]).toEqual(["coal", 5]);
  });

  test("drains what players sold one at a time, slower for higher Quality, then lets the slot go", () => {
    addShopper("a", ["tin", 2], ["ironSword:rare:might", 1]);
    openStore();
    deal("a", {
      sell: [
        { item: "tin", count: 2 },
        { item: "ironSword:rare:might", count: 1 },
      ],
    });
    ticks(199);
    expect(shelf().slice(4)).toEqual([
      ["tin", 1],
      ["ironSword:rare:might", 1],
    ]);
    ticks(200);
    expect(shelf().slice(4)).toEqual([["ironSword:rare:might", 1]]);
    ticks(4000);
    expect(shelf()).toEqual(STARTING_SHELF);
  });

  test("when full, the store still buys, but the item doesn't go on it until a sold item is bought out", () => {
    const sold = [
      "tin",
      "ironOre",
      "copperBar",
      "bronzeBar",
      "ironBar",
      "steelBar",
      "emberiteBar",
      "ashstone",
      "cinderglass",
      "heartflame",
      "emberbone",
      "emberiteOre",
    ];
    const gear = ["Sword", "Shield", "Helmet", "Chestplate", "Leggings"];
    const pieces = ["copper", "bronze", "iron", "steel", "emberite"].flatMap(
      (tier) => gear.map((piece) => `${tier}${piece}`),
    );
    // 4 starting items, 12 materials and 24 pieces of gear fill all 40 slots.
    const stacks = [...sold, ...pieces.slice(0, 24)].map(
      (item) => [item, 1] as [string, number],
    );
    addShopper("a", ...stacks.slice(0, 30));
    addShopper("b", ...stacks.slice(30), [pieces[24]!, 1]);
    openStore("a");
    openStore("b");
    const sellAll = (id: string) =>
      deal(id, {
        sell: held(id).map(([item, count]) => ({
          item: item as string,
          count: count as number,
        })),
      });
    sellAll("a");
    sellAll("b");
    expect(shelf()).toHaveLength(40);
    expect(shelf().map(([item]) => item)).not.toContain(pieces[24]);
    expect(held("b")).toEqual([[COINS, expect.any(Number)]]);
    // Buying out a sold item frees its slot, so the next sale fits.
    deal("b", { buy: [{ item: "tin", count: 1, stock: 1 }] });
    addShopper("c", [pieces[24]!, 1]);
    openStore("c");
    sellAll("c");
    expect(shelf().map(([item]) => item)).not.toContain("tin");
    expect(shelf().at(-1)).toEqual([pieces[24], 1]);
  });
});

test("coins stack past 255 in one slot, and a save keeps the count", () => {
  addShopper("a", [COINS, 70_000]);
  expect(held()).toEqual([[COINS, 70_000]]);
  expect(sim.saveOf("a")!.inventoryCounts![0]).toBe(70_000);
});

test("all a player's coins drop as one pile, and taking it back fills one slot", () => {
  addShopper("a", [COINS, 3_400_000], ["tin", 1]);
  sim.queueDrop("a", 0, 3_400_000);
  ticks(1);
  expect(held()).toEqual([["tin", 1]]);
  const [pile] = sim.state.groundItems.keys();
  sim.queueTake("a", pile!);
  ticks(1);
  expect(held()).toEqual([
    [COINS, 3_400_000],
    ["tin", 1],
  ]);
});
