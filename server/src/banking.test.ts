import {
  BANK_SLOTS,
  INVENTORY_SLOTS,
  parseRegion,
  type WorldEvent,
} from "@runic/shared";
import { beforeEach, expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

// `$` is Aldous, the banker; Odo stands far off.
const TILES = parseRegion(
  ["TTTTTTTTT", "TR.....$T", "T.......T", "TB......T", "TTTTTTTTT"].join("\n"),
);
const NEXT_TO = { x: 6, y: 1 };
const BANK = 0;

let sim: Simulation;
let events: WorldEvent[];
const me = () => sim.state.players.get("a")!;
/** Only what the bank and a conversation send. */
const ticks = (n: number) => {
  for (let i = 0; i < n; i++) {
    sim.tick();
    for (const event of sim.events.splice(0))
      if (
        ["talk", "talkEnded", "told", "bankOpened", "bankClosed"].includes(
          event.type,
        )
      )
        events.push(event);
  }
};
const opened = { type: "bankOpened", player: "a" };

beforeEach(() => {
  events = [];
  sim = new Simulation(TILES, () => 0.99);
  sim.addPlayer("a");
});

test("the Bank option on Aldous walks next to him and opens the bank on arrival, skipping the talk", () => {
  sim.queueVisit("a", "aldous", "openBank");
  ticks(1);
  expect(events).toEqual([]);
  ticks(20);
  expect(me()).toMatchObject({ ...NEXT_TO, action: "" });
  expect(events).toEqual([opened]);
});

test("Aldous's conversation offers the bank", () => {
  sim.queueVisit("a", "aldous");
  ticks(20);
  events = [];
  sim.choose("a", BANK);
  ticks(1);
  expect(events).toEqual([
    { type: "talk", player: "a", villager: "aldous", node: "bank" },
    opened,
  ]);
});

test("a shortcut the villager's conversation doesn't offer is ignored", () => {
  for (const [villager, then] of [
    ["odo", "openBank"],
    ["aldous", "giveTools"],
    ["aldous", "nothing"],
    ["aldous", ["openBank"]],
  ] as const) {
    sim.queueVisit("a", villager, then as string);
    ticks(1);
    expect(me().action).toBe("");
  }
});

/** A player beside Aldous with the bank open, holding these [item, count] stacks from inventory slot 0 and bank slot 0. */
function banking(held: [string, number][], banked: [string, number][] = []) {
  const fill = (stacks: [string, number][], slots: number) => {
    const items = Array<string>(slots).fill("");
    const counts = Array<number>(slots).fill(0);
    stacks.forEach(([item, count], slot) => {
      items[slot] = item;
      counts[slot] = count;
    });
    return [items, counts] as const;
  };
  const [inventory, inventoryCounts] = fill(held, INVENTORY_SLOTS);
  const [bank, bankCounts] = fill(banked, BANK_SLOTS);
  sim.removePlayer("a");
  sim.addPlayer("a", {
    ...NEXT_TO,
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    health: 1000,
    inventory,
    inventoryCounts,
    bank,
    bankCounts,
  });
  sim.queueVisit("a", "aldous", "openBank");
  ticks(1);
  events = [];
}

/** The first `slots` slots of the inventory, or of the bank, as [item, count] pairs. */
const inventoryOf = (slots = 3) =>
  [...me().inventory]
    .slice(0, slots)
    .map((item, slot) => [item, me().inventoryCounts[slot]]);
const bankOf = (slots = 3) =>
  [...me().bank]
    .slice(0, slots)
    .map((item, slot) => [item, me().bankCounts[slot]]);
/** `count` slots of one copper sword each, to fill space. */
const swords = (count: number) =>
  Array.from({ length: count }, () => ["copperSword", 1] as [string, number]);
const told = (line: string) => ({ type: "told", player: "a", line });

test("depositing part of a stack puts it in the bank, and more of it joins the same slot", () => {
  banking([["berry", 12]]);
  sim.deposit("a", 0, 5);
  expect(inventoryOf(1)).toEqual([["berry", 7]]);
  expect(bankOf(2)).toEqual([
    ["berry", 5],
    ["", 0],
  ]);
  sim.deposit("a", 0, 100);
  expect(inventoryOf(1)).toEqual([["", 0]]);
  expect(bankOf(2)).toEqual([
    ["berry", 12],
    ["", 0],
  ]);
});

test("each piece of gear takes its own bank slot", () => {
  banking(
    [
      ["copperSword", 1],
      ["copperSword:uncommon:might", 1],
    ],
    swords(1),
  );
  sim.deposit("a", 0, 1);
  sim.deposit("a", 1, 1);
  expect(bankOf()).toEqual([
    ["copperSword", 1],
    ["copperSword", 1],
    ["copperSword:uncommon:might", 1],
  ]);
});

test("withdrawing a stack tops up the inventory's stack first, then fills free slots in stacks of 20 and leaves the rest", () => {
  banking([["berry", 15], ...swords(INVENTORY_SLOTS - 2)], [["berry", 100]]);
  sim.withdraw("a", 0, 100);
  expect(inventoryOf(1)).toEqual([["berry", 20]]);
  expect(me().inventory.at(-1)).toBe("berry");
  expect(me().inventoryCounts.at(-1)).toBe(20);
  expect(bankOf(1)).toEqual([["berry", 75]]);
  sim.withdraw("a", 0, 1);
  expect(sim.events).toEqual([told("Your inventory is full.")]);
  expect(bankOf(1)).toEqual([["berry", 75]]);
});

test("withdrawing gear takes the one piece and empties its bank slot", () => {
  banking([], [["copperSword:uncommon:might", 1]]);
  sim.withdraw("a", 0, 5);
  expect(inventoryOf(1)).toEqual([["copperSword:uncommon:might", 1]]);
  expect(bankOf(1)).toEqual([["", 0]]);
});

test("a full bank still takes an item it already has a slot for, and refuses a new one", () => {
  banking(
    [
      ["berry", 4],
      ["herb", 3],
    ],
    [["berry", 1], ...swords(BANK_SLOTS - 1)],
  );
  sim.deposit("a", 0, 4);
  sim.deposit("a", 1, 3);
  expect(bankOf(1)).toEqual([["berry", 5]]);
  expect(inventoryOf(2)).toEqual([
    ["", 0],
    ["herb", 3],
  ]);
  expect(sim.events).toEqual([told("Your bank is full.")]);
});

test("Deposit inventory on a near-full bank puts in whatever fits", () => {
  banking(
    [
      ["herb", 3],
      ["copperShield", 1],
      ["berry", 6],
    ],
    [["berry", 1], ...swords(BANK_SLOTS - 2)],
  );
  sim.depositInventory("a");
  expect(inventoryOf()).toEqual([
    ["", 0],
    ["copperShield", 1],
    ["", 0],
  ]);
  expect(bankOf(1)).toEqual([["berry", 7]]);
  expect(me().bank.at(-1)).toBe("herb");
  expect(sim.events).toEqual([told("Your bank is full.")]);
});

test("deposits and withdrawals are refused during a combat lock", () => {
  banking([["berry", 4]], [["herb", 2]]);
  sim.lock("a");
  sim.deposit("a", 0, 4);
  sim.withdraw("a", 0, 2);
  sim.depositInventory("a");
  const refused = told(
    "You can't use the bank until 10 seconds after a fight.",
  );
  expect(sim.events).toEqual([refused, refused, refused]);
  expect(inventoryOf(1)).toEqual([["berry", 4]]);
  expect(bankOf(1)).toEqual([["herb", 2]]);
});

test("dragging in the bank reorders its slots", () => {
  banking(
    [],
    [
      ["berry", 30],
      ["copperSword", 1],
    ],
  );
  sim.moveBankItem("a", 0, 1);
  sim.moveBankItem("a", 1, 5);
  expect(bankOf(6)).toEqual([
    ["copperSword", 1],
    ["", 0],
    ["", 0],
    ["", 0],
    ["", 0],
    ["berry", 30],
  ]);
});

test("nothing moves with the bank shut, or with slots and amounts that aren't whole numbers in range", () => {
  banking([["berry", 4]], [["herb", 2]]);
  for (const bad of [-1, 1.5, "0", null, BANK_SLOTS]) {
    sim.withdraw("a", bad as number, 1);
    sim.deposit("a", bad as number, 1);
    sim.moveBankItem("a", 0, bad as number);
  }
  for (const bad of [0, -1, 1.5, "1", null]) {
    sim.withdraw("a", 0, bad as number);
    sim.deposit("a", 0, bad as number);
  }
  sim.closeBank("a");
  sim.deposit("a", 0, 4);
  sim.withdraw("a", 0, 2);
  sim.depositInventory("a");
  sim.moveBankItem("a", 0, 1);
  expect(inventoryOf(1)).toEqual([["berry", 4]]);
  expect(bankOf(2)).toEqual([
    ["herb", 2],
    ["", 0],
  ]);
  expect(() => sim.deposit("nobody", 0, 1)).not.toThrow();
});

test("walking away from Aldous shuts the bank with a line", () => {
  banking([["berry", 4]]);
  sim.queueWalk("a", { x: 1, y: 1 });
  ticks(20);
  expect(events).toEqual([
    told("You walk away from Aldous."),
    { type: "bankClosed", player: "a" },
  ]);
  sim.deposit("a", 0, 4);
  expect(bankOf(1)).toEqual([["", 0]]);
});

test("closing the bank shuts it quietly", () => {
  banking([]);
  sim.closeBank("a");
  sim.queueWalk("a", { x: 1, y: 1 });
  ticks(20);
  expect(events).toEqual([]);
});

test("being hit shuts the bank", () => {
  sim = new Simulation(parseRegion("TTTTT\nT$RST\nTTTTT"), () => 0);
  sim.addPlayer("a");
  sim.queueVisit("a", "aldous", "openBank");
  ticks(1);
  sim.queueTarget("a", "0");
  events = [];
  while (me().health === me().maxHealth) ticks(1);
  expect(events).toEqual([
    told("You're hit, and Aldous shuts the bank."),
    { type: "bankClosed", player: "a" },
  ]);
});

test("the bank survives a save and reload, and a save from before the bank loads with it empty", () => {
  banking(
    [],
    [
      ["berry", 300],
      ["copperSword:rare:might", 1],
    ],
  );
  const { bank, bankCounts, ...old } = sim.saveOf("a")!;
  sim.removePlayer("a");
  sim.addPlayer("b", { ...old, bank, bankCounts });
  const reloaded = sim.state.players.get("b")!;
  expect([...reloaded.bank].slice(0, 3)).toEqual([
    "berry",
    "copperSword:rare:might",
    "",
  ]);
  expect([...reloaded.bankCounts].slice(0, 3)).toEqual([300, 1, 0]);
  sim.addPlayer("c", old);
  const empty = sim.state.players.get("c")!;
  expect([...empty.bank]).toEqual(Array(BANK_SLOTS).fill(""));
  expect([...empty.bankCounts]).toEqual(Array(BANK_SLOTS).fill(0));
});
