import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

// The respawn tile, in the village square, is (1,1). Hollis stands at (10,3), so Hollow
// teleport lands west of them at (9,3). The caster starts far from both, at (6,5).
const ROWS = [
  "TTTTTTTTTTTT",
  "TR.........T",
  "T..........T",
  "T.........LT",
  "T..........T",
  "T..........T",
  "TTTTTTTTTTTT",
];
const START = { x: 6, y: 5 };
const VILLAGE = { x: 1, y: 1 };
const HOLLOW = { x: 9, y: 3 };

const EVERY_RUNE: [string, number][] = [
  ["airRune", 10],
  ["earthRune", 10],
  ["fireRune", 10],
  ["focusRune", 10],
  ["furyRune", 10],
];

type Start = Partial<PlayerSave> & {
  level?: number;
  stacks?: [string, number][];
  hollisDone?: boolean;
};

/** One caster, "a", at `START` with Magic `level` (30 unless told) and `stacks` in the first slots (ten of each rune unless told). */
function caster({
  level = 30,
  stacks = EVERY_RUNE,
  hollisDone = true,
  ...fields
}: Start = {}) {
  const s = new Simulation(parseRegion(ROWS.join("\n")), () => 0.99);
  s.addPlayer("a", {
    ...START,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    health: 1000,
    magicXp: xpForLevel(level),
    weapon: "",
    weaponCount: 0,
    quests: hollisDone ? { hollisRunes: { stage: "done", turns: 0 } } : {},
    inventory: [
      ...stacks.map(([item]) => item),
      ...Array<string>(INVENTORY_SLOTS - stacks.length).fill(EMPTY_SLOT),
    ],
    inventoryCounts: [
      ...stacks.map(([, count]) => count),
      ...Array<number>(INVENTORY_SLOTS - stacks.length).fill(0),
    ],
    ...fields,
  });
  return s;
}

const me = (s: Simulation) => s.state.players.get("a")!;
const bagOf = (s: Simulation) =>
  [...me(s).inventory].map((item, slot) => [
    item,
    me(s).inventoryCounts[slot]!,
  ]);
const toldA = (events: WorldEvent[]) =>
  events.flatMap((event) =>
    event.type === "told" && event.player === "a" ? [event.line] : [],
  );

/** Casts `spell` (on `slot` for Coin-turn) and runs the tick it applies on, returning that tick's events. */
function cast(s: Simulation, spell: unknown, slot?: number) {
  s.events.length = 0;
  s.queueCast("a", { spell, slot });
  s.tick();
  return [...s.events];
}

/** That a refused cast moved nothing, spent nothing and paid nothing. */
function expectNothingChanged(s: Simulation, before: ReturnType<typeof bagOf>) {
  expect(me(s)).toMatchObject({ ...START, magicXp: xpForLevel(30) });
  expect(bagOf(s)).toEqual(before);
}

describe("Village teleport", () => {
  test("moves the caster to the village square, spends 3 air and 1 fury, and pays 15 Magic experience", () => {
    const s = caster();
    const events = cast(s, "villageTeleport");
    expect(me(s)).toMatchObject({ ...VILLAGE, magicXp: xpForLevel(30) + 15 });
    expect(bagOf(s).slice(0, 5)).toEqual([
      ["airRune", 7],
      ["earthRune", 10],
      ["fireRune", 10],
      ["focusRune", 10],
      ["furyRune", 9],
    ]);
    expect(events).toContainEqual({ type: "teleported", player: "a" });
  });

  test("is refused below Magic 12, saying so, and spends nothing", () => {
    const s = caster({ level: 11 });
    const before = bagOf(s);
    expect(toldA(cast(s, "villageTeleport"))).toEqual([
      "You need Magic level 12 to cast Village teleport.",
    ]);
    expect(me(s)).toMatchObject({ ...START, magicXp: xpForLevel(11) });
    expect(bagOf(s)).toEqual(before);
  });

  test("is refused without its runes, saying so, and spends nothing", () => {
    const s = caster({ stacks: [["airRune", 3]] });
    const before = bagOf(s);
    expect(toldA(cast(s, "villageTeleport"))).toEqual([
      "You don't have the runes to cast Village teleport.",
    ]);
    expectNothingChanged(s, before);
  });

  test("replaces the current action, as a click does", () => {
    const s = caster();
    s.queueWalk("a", { x: 10, y: 5 });
    s.tick();
    cast(s, "villageTeleport");
    for (let tick = 0; tick < 10; tick++) s.tick();
    expect(me(s)).toMatchObject(VILLAGE);
  });
});

describe("Hollow teleport", () => {
  test("moves the caster beside Hollis once the quest is done, spending its runes and paying 25 Magic experience", () => {
    const s = caster();
    cast(s, "hollowTeleport");
    expect(me(s)).toMatchObject({ ...HOLLOW, magicXp: xpForLevel(30) + 25 });
    expect(bagOf(s).slice(0, 5)).toEqual([
      ["airRune", 9],
      ["earthRune", 7],
      ["fireRune", 10],
      ["focusRune", 10],
      ["furyRune", 9],
    ]);
  });

  test("is refused before Hollis's quest is done, saying so, and spends nothing", () => {
    const s = caster({ hollisDone: false });
    const before = bagOf(s);
    expect(toldA(cast(s, "hollowTeleport"))).toEqual([
      "You must finish Hollis's quest to cast Hollow teleport.",
    ]);
    expectNothingChanged(s, before);
  });

  test("is refused below Magic 28", () => {
    const s = caster({ level: 27 });
    expect(toldA(cast(s, "hollowTeleport"))).toEqual([
      "You need Magic level 28 to cast Hollow teleport.",
    ]);
    expect(me(s)).toMatchObject(START);
  });
});

describe("the combat lock", () => {
  test.each(["villageTeleport", "hollowTeleport"])(
    "refuses %s while it runs, saying so, and spends nothing",
    (spell) => {
      const s = caster();
      s.lock("a");
      const before = bagOf(s);
      expect(toldA(cast(s, spell))).toEqual([
        "You can't teleport until 10 seconds after a fight.",
      ]);
      expectNothingChanged(s, before);
    },
  );

  test("lets a teleport through once it has run out", () => {
    const s = caster();
    s.lock("a");
    for (let tick = 0; tick < 34; tick++) s.tick();
    cast(s, "villageTeleport");
    expect(me(s)).toMatchObject(VILLAGE);
  });
});

describe("Coin-turn", () => {
  test("turns one log from the picked stack into the store's price in coins, spending 3 fire and 1 focus and paying 10 Magic experience", () => {
    const s = caster({ stacks: [...EVERY_RUNE, ["oakLog", 3]] });
    cast(s, "coinTurn", 5);
    expect(bagOf(s).slice(0, 7)).toEqual([
      ["airRune", 10],
      ["earthRune", 10],
      ["fireRune", 7],
      ["focusRune", 9],
      ["furyRune", 10],
      ["oakLog", 2],
      // An oak log is worth 6, and the store pays 40%, rounded down.
      ["coins", 2],
    ]);
    expect(me(s)).toMatchObject({ ...START, magicXp: xpForLevel(30) + 10 });
  });

  test.each([
    ["coins", "The store doesn't buy coins."],
    ["boneSigil", "Coin-turn can't turn a quest item."],
    ["hollowEssence", "Coin-turn can't turn a quest item."],
  ])("refuses %s, saying why, and spends nothing", (item, line) => {
    const s = caster({ stacks: [...EVERY_RUNE, [item, 5]] });
    const before = bagOf(s);
    expect(toldA(cast(s, "coinTurn", 5))).toEqual([line]);
    expectNothingChanged(s, before);
  });

  test("is refused below Magic 20, and works during the combat lock, since it is no escape", () => {
    const low = caster({ level: 19, stacks: [...EVERY_RUNE, ["oakLog", 1]] });
    expect(toldA(cast(low, "coinTurn", 5))).toEqual([
      "You need Magic level 20 to cast Coin-turn.",
    ]);
    const locked = caster({ stacks: [...EVERY_RUNE, ["oakLog", 1]] });
    locked.lock("a");
    cast(locked, "coinTurn", 5);
    expect(bagOf(locked)[5]).toEqual(["coins", 2]);
  });

  test("ignores a slot that is not an inventory slot's index", () => {
    const s = caster({ stacks: [...EVERY_RUNE, ["oakLog", 1]] });
    const before = bagOf(s);
    for (const slot of [-1, INVENTORY_SLOTS, 1.5, "5", undefined])
      expect(toldA(cast(s, "coinTurn", slot as number))).toEqual([]);
    expectNothingChanged(s, before);
  });
});

describe("any weapon in hand", () => {
  test.each([
    ["a sword", { weapon: "copperSword", weaponCount: 1 }],
    ["a bow", { weapon: "birchBow", weaponCount: 1 }],
    ["bare hands", { weapon: "", weaponCount: 0 }],
    ["a staff", { weapon: "birchStaff", weaponCount: 1 }],
  ])("casts utility spells with %s", (_, weapon) => {
    const s = caster({ ...weapon, stacks: [...EVERY_RUNE, ["oakLog", 1]] });
    cast(s, "coinTurn", 5);
    expect(bagOf(s)[5]).toEqual(["coins", 2]);
    cast(s, "villageTeleport");
    expect(me(s)).toMatchObject(VILLAGE);
  });
});

test("ignores anything but a utility spell's id", () => {
  const s = caster();
  const before = bagOf(s);
  for (const spell of ["airDart", "toString", 3, undefined])
    expect(toldA(cast(s, spell))).toEqual([]);
  expectNothingChanged(s, before);
});

test("is refused during an Agility crossing, as other clicks are", () => {
  const tiles = parseRegion(ROWS.join("\n"));
  tiles[5]![6] = { ...tiles[5]![6]!, obstacle: "balanceBeam" };
  const s = new Simulation(tiles, () => 0);
  s.addPlayer("a", {
    ...START,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    health: 1000,
    magicXp: xpForLevel(30),
    inventory: [
      ...EVERY_RUNE.map(([rune]) => rune),
      ...Array<string>(INVENTORY_SLOTS - 5).fill(EMPTY_SLOT),
    ],
    inventoryCounts: [
      ...EVERY_RUNE.map(([, count]) => count),
      ...Array<number>(INVENTORY_SLOTS - 5).fill(0),
    ],
  });
  s.queueCross("a", "balanceBeam");
  s.tick();
  expect(s.isBusy("a")).toBe(true);
  s.queueCast("a", { spell: "villageTeleport" });
  s.tick();
  expect(me(s).x).not.toBe(VILLAGE.x);
  expect(me(s).inventoryCounts[0]).toBe(10);
});
