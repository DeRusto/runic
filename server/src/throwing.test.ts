import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  NO_CLEAR_SHOT_LINE,
  OUT_OF_KNIVES_LINE,
  parseRegion,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const MISS = 0.99;
const LEVEL_5_XP = 800;

// The respawn tile is (1,1). The Spider's home is 4 tiles off at (5,1), in reach of a throw.
const IN_REACH = ["TTTTTTTTTTTT", "TR...S.....T", "TTTTTTTTTTTT"];
// The Spider is 6 tiles off at (7,1), so a thrower must walk 2 tiles closer.
const OUT_OF_REACH = ["TTTTTTTTTTTT", "TR.....S...T", "TTTTTTTTTTTT"];
// A Tarn Ox, which never moves or fights back, 4 tiles off at (5,1).
const OX = ["TTTTTTTTTTTT", "TR...X.....T", "TTTTTTTTTTTT"];

type Start = Partial<PlayerSave> & { rows?: string[]; held?: string[] };

/** One thrower, "a", at (1,1) with 10 copper throwing knives in hand unless told otherwise. Rolls come in order, then everything misses. */
function thrower(
  { rows = IN_REACH, held = [], ...fields }: Start,
  ...rolls: number[]
) {
  const s = new Simulation(
    parseRegion(rows.join("\n")),
    () => rolls.shift() ?? MISS,
  );
  s.addPlayer("a", {
    x: 1,
    y: 1,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    health: 1000,
    weapon: "copperThrowingKnife",
    weaponCount: 10,
    inventory: [
      ...held,
      ...Array<string>(INVENTORY_SLOTS - held.length).fill(EMPTY_SLOT),
    ],
    ...fields,
  });
  return s;
}

const me = (s: Simulation) => s.state.players.get("a")!;
const enemy = (s: Simulation) => s.state.enemies.get("0")!;

/** Ticks the simulation, and returns each event with the tick it came on. */
function run(s: Simulation, ticks: number) {
  const seen: (WorldEvent & { tick: number })[] = [];
  for (let i = 0; i < ticks; i++) {
    s.tick();
    for (const event of s.events.splice(0))
      seen.push({ ...event, tick: s.state.tick });
  }
  return seen;
}

const throwTicks = (events: ReturnType<typeof run>) =>
  events.filter((e) => e.type === "playerSwing").map((e) => e.tick);
const told = (events: ReturnType<typeof run>) =>
  events.flatMap((e) => (e.type === "told" ? [e.line] : []));
const inventoryOf = (s: Simulation) =>
  me(s)
    .inventory.map((item, slot) => [item, me(s).inventoryCounts[slot]])
    .filter(([item]) => item !== EMPTY_SLOT);

describe("equipping a stack of knives", () => {
  test("the whole inventory stack goes into the weapon slot with its count", () => {
    const s = thrower({
      weapon: "",
      weaponCount: 0,
      held: ["bronzeThrowingKnife"],
      inventoryCounts: [13],
      rangedXp: LEVEL_5_XP,
    });
    s.equip("a", 0);
    expect(me(s)).toMatchObject({
      weapon: "bronzeThrowingKnife",
      weaponCount: 13,
    });
    expect(inventoryOf(s)).toEqual([]);
  });

  test("knives below their Ranged gate are refused with a line, and stay put", () => {
    const s = thrower({
      weapon: "",
      weaponCount: 0,
      held: ["bronzeThrowingKnife"],
      inventoryCounts: [13],
      rangedXp: LEVEL_5_XP - 1,
      attackXp: 20_000,
    });
    s.equip("a", 0);
    expect(me(s)).toMatchObject({ weapon: "", weaponCount: 0 });
    expect(inventoryOf(s)).toEqual([["bronzeThrowingKnife", 13]]);
    expect(told(run(s, 1))).toEqual(["You need Ranged 5 to equip this."]);
  });

  test("another tier swaps stacks, each keeping its exact count", () => {
    const s = thrower({
      held: ["bronzeThrowingKnife"],
      inventoryCounts: [17],
      rangedXp: LEVEL_5_XP,
    });
    s.equip("a", 0);
    expect(me(s)).toMatchObject({
      weapon: "bronzeThrowingKnife",
      weaponCount: 17,
    });
    expect(inventoryOf(s)).toEqual([["copperThrowingKnife", 10]]);
  });

  test("swapping to a sword in a full pack puts the whole knife stack in its freed slot", () => {
    const s = thrower({
      weaponCount: 20,
      held: [
        "copperSword",
        ...Array<string>(INVENTORY_SLOTS - 1).fill("berry"),
      ],
      inventoryCounts: Array<number>(INVENTORY_SLOTS).fill(1),
    });
    s.equip("a", 0);
    expect(me(s)).toMatchObject({ weapon: "copperSword", weaponCount: 1 });
    expect(inventoryOf(s)[0]).toEqual(["copperThrowingKnife", 20]);
    expect(inventoryOf(s)).toHaveLength(INVENTORY_SLOTS);
  });

  test("more of the knife in hand tops the stack up to 20, and the rest stays", () => {
    const s = thrower({ held: ["copperThrowingKnife"], inventoryCounts: [15] });
    s.equip("a", 0);
    expect(me(s)).toMatchObject({
      weapon: "copperThrowingKnife",
      weaponCount: 20,
    });
    expect(inventoryOf(s)).toEqual([["copperThrowingKnife", 5]]);
  });

  test("taking a stack off with no room for it is refused, and no knife is lost", () => {
    const s = thrower({
      held: Array<string>(INVENTORY_SLOTS).fill("berry"),
      inventoryCounts: Array<number>(INVENTORY_SLOTS).fill(1),
    });
    s.takeOff("a", "weapon");
    expect(me(s)).toMatchObject({
      weapon: "copperThrowingKnife",
      weaponCount: 10,
    });
    expect(told(run(s, 1))).toEqual([
      "You have no empty slot to take that off into.",
    ]);
  });
});

describe("throwing", () => {
  test("a knife is thrown at an enemy 4 tiles away without walking", () => {
    const s = thrower({});
    s.queueTarget("a", "0");
    expect(throwTicks(run(s, 1))).toEqual([1]);
    expect(me(s)).toMatchObject({ x: 1, y: 1 });
  });

  test("from further off, the thrower walks until 4 tiles away, then throws on arriving", () => {
    const s = thrower({ rows: OUT_OF_REACH });
    s.queueTarget("a", "0");
    const events = run(s, 3);
    expect(me(s).x).toBe(3);
    expect(throwTicks(events)).toEqual([3]);
  });

  test("a wall blocks a throw and leaves the knife stack untouched", () => {
    const s = thrower({ rows: ["TTTTTTTT", "TR.HX..T", "TTTTTTTT"] });
    s.queueTarget("a", "0");
    const events = run(s, 9);
    expect(throwTicks(events)).toEqual([]);
    expect(told(events)).toEqual([NO_CLEAR_SHOT_LINE]);
    expect(me(s).weaponCount).toBe(10);
  });

  test("knives are thrown every 6 ticks", () => {
    const s = thrower({ rows: OX });
    s.queueTarget("a", "0");
    expect(throwTicks(run(s, 13))).toEqual([1, 7, 13]);
  });

  test("a throw rolls on Ranged and the knife, and pays Ranged and Hitpoints 6 per 100 damage", () => {
    // Lands, rolls the bottom of the range (100), no crit: 100 plus the copper knife's 100.
    const s = thrower({}, 0, 0, MISS);
    s.queueTarget("a", "0");
    expect(run(s, 1).find((e) => e.type === "playerSwing")).toMatchObject({
      damage: 200,
    });
    expect(me(s)).toMatchObject({
      rangedXp: 12,
      hitpointsXp: 4062,
      attackXp: 0,
      strengthXp: 0,
    });
  });

  test("each throw spends one knife from the stack, hit or miss, and leaves worn arrows alone", () => {
    const s = thrower(
      { rows: OX, ammo: "copperArrow", ammoCount: 5 },
      0,
      0,
      MISS,
    );
    enemy(s).health = 10_000;
    s.queueTarget("a", "0");
    const events = run(s, 13);
    expect(events.map((e) => e.type === "playerSwing" && e.damage)).toEqual(
      expect.arrayContaining([200, 0]),
    );
    expect(me(s)).toMatchObject({
      weapon: "copperThrowingKnife",
      weaponCount: 7,
      ammo: "copperArrow",
      ammoCount: 5,
    });
  });
});

describe("running out", () => {
  test("the last knife's throw ends the attack with a chat line; the inventory does not refill it, nor another tier take its place", () => {
    const s = thrower({
      rows: OX,
      weaponCount: 1,
      held: ["copperThrowingKnife", "bronzeThrowingKnife"],
      inventoryCounts: [20, 20],
      rangedXp: LEVEL_5_XP,
    });
    s.queueTarget("a", "0");
    const events = run(s, 20);
    expect(throwTicks(events)).toEqual([1]);
    expect(told(events)).toEqual([OUT_OF_KNIVES_LINE]);
    expect(events.find((e) => e.type === "playerSwing")).toMatchObject({
      weapon: "copperThrowingKnife",
    });
    expect(me(s)).toMatchObject({
      weapon: "",
      weaponCount: 0,
      action: "",
      target: "",
    });
    expect(inventoryOf(s)).toEqual([
      ["copperThrowingKnife", 20],
      ["bronzeThrowingKnife", 20],
    ]);
  });

  test("equipping a sword after running out lets the player fight back", () => {
    const s = thrower({
      rows: ["TTTTTTTTTTTT", "TRS........T", "TTTTTTTTTTTT"],
      weaponCount: 1,
      held: ["copperSword"],
    });
    s.queueTarget("a", "0");
    expect(throwTicks(run(s, 1))).toEqual([1]);
    s.equip("a", 0);
    expect(throwTicks(run(s, 16))).toContain(9);
  });

  test("the player fights back when the enemy killed by the last knife returns", () => {
    const s = thrower(
      {
        rows: ["TTTTTTTTTTTT", "TRK........T", "TTTTTTTTTTTT"],
        weaponCount: 1,
      },
      0,
      0,
      MISS,
    );
    enemy(s).health = 200;
    s.queueTarget("a", "0");
    expect(throwTicks(run(s, 1))).toEqual([1]);
    expect(enemy(s).state).toBe("dead");
    expect(throwTicks(run(s, 220)).length).toBeGreaterThan(0);
  });

  test("an enemy that keeps hitting a thrower who ran out is not punched back, until the player gives a new order", () => {
    // The Spider at (3,1) comes to fight; every roll misses.
    const s = thrower({
      rows: ["TTTTTTTTTTTT", "TR.S.......T", "TTTTTTTTTTTT"],
      weaponCount: 1,
    });
    s.queueTarget("a", "0");
    let events = run(s, 20);
    expect(events.filter((e) => e.type === "enemySwing").length).toBe(2);
    expect(throwTicks(events)).toEqual([1]);
    expect(me(s)).toMatchObject({ action: "", weapon: "" });
    // A walk is a new order: the next swing at an idle, bare-handed player is punched back as usual.
    s.queueWalk("a", { x: me(s).x, y: me(s).y });
    events = run(s, 16);
    expect(throwTicks(events).length).toBeGreaterThan(0);
  });
});
