import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  inSight,
  NO_SPELL_LINE,
  OUT_OF_RUNES_LINE,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const MISS = 0.99;

// The respawn tile is (1,1). The Spider's home is 8 tiles off at (9,1), in reach of a staff.
const IN_REACH = ["TTTTTTTTTTTTTT", "TR.......S...T", "TTTTTTTTTTTTTT"];
// The Spider is 10 tiles off at (11,1), so a staff must walk 2 tiles closer.
const OUT_OF_REACH = ["TTTTTTTTTTTTTT", "TR.........S.T", "TTTTTTTTTTTTTT"];
// The Spider is 2 tiles off at (3,1), inside its leash, so it comes and fights.
const CLOSE = ["TTTTTTTTTTTTTT", "TR.S.........T", "TTTTTTTTTTTTTT"];
// A house wall at (5,1) stands on the line to the Spider, 8 tiles off at (9,1).
const BEHIND_A_WALL = [
  "TTTTTTTTTTTTTT",
  "TR...H...S...T",
  "T............T",
  "T............T",
  "TTTTTTTTTTTTTT",
];

type Start = Partial<PlayerSave> & {
  rows?: string[];
  runes?: [string, number][];
};

/**
 * One mage, "a", at (1,1) with a birch staff, air dart picked, and 10 air and 10 focus runes
 * in the first slots unless told otherwise. Rolls come in order, then everything misses.
 */
function mage(
  {
    rows = IN_REACH,
    runes = [
      ["airRune", 10],
      ["focusRune", 10],
    ],
    ...fields
  }: Start,
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
    weapon: "birchStaff",
    weaponCount: 1,
    combatSpell: "airDart",
    inventory: [
      ...runes.map(([rune]) => rune),
      ...Array<string>(INVENTORY_SLOTS - runes.length).fill(EMPTY_SLOT),
    ],
    inventoryCounts: [
      ...runes.map(([, count]) => count),
      ...Array<number>(INVENTORY_SLOTS - runes.length).fill(0),
    ],
    ...fields,
  });
  return s;
}

const me = (s: Simulation) => s.state.players.get("a")!;
const spider = (s: Simulation) => s.state.enemies.get("0")!;

/** How many of `item` the mage carries, across their stacks. */
const held = (s: Simulation, item: string) =>
  [...me(s).inventory].reduce(
    (total, at, slot) =>
      total + (at === item ? me(s).inventoryCounts[slot]! : 0),
    0,
  );

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

const castTicks = (events: ReturnType<typeof run>) =>
  events.filter((e) => e.type === "playerSwing").map((e) => e.tick);
const told = (events: ReturnType<typeof run>) =>
  events.flatMap((e) => (e.type === "told" ? [e.line] : []));

describe("picking a combat spell", () => {
  test("a new player has none picked", () => {
    const s = mage({ combatSpell: undefined });
    expect(me(s).combatSpell).toBe("");
  });

  test("picks a spell at or below the player's Magic level", () => {
    const s = mage({ combatSpell: "", magicXp: xpForLevel(5) });
    s.pickSpell("a", "waterDart");
    expect(me(s).combatSpell).toBe("waterDart");
  });

  test("refuses a spell above the player's Magic level, keeping the one picked", () => {
    const s = mage({});
    s.pickSpell("a", "waterDart");
    expect(me(s).combatSpell).toBe("airDart");
  });

  test("ignores anything that isn't a combat spell", () => {
    const s = mage({});
    for (const junk of ["toString", "", 3, null, { spell: "airDart" }])
      s.pickSpell("a", junk);
    expect(me(s).combatSpell).toBe("airDart");
  });
});

describe("reach", () => {
  test("a staff casts at an enemy 8 tiles away without walking", () => {
    const s = mage({});
    s.queueTarget("a", "0");
    expect(castTicks(run(s, 1))).toEqual([1]);
    expect(me(s)).toMatchObject({ x: 1, y: 1 });
  });

  test("a staff walks into reach of an enemy further off, then casts on arriving", () => {
    const s = mage({ rows: OUT_OF_REACH });
    s.queueTarget("a", "0");
    const events = run(s, 4);
    expect(me(s).x).toBe(3);
    expect(castTicks(events)).toEqual([3]);
  });

  test("a staff walks around a wall until the enemy is in sight, spending nothing on the way", () => {
    const s = mage({ rows: BEHIND_A_WALL });
    s.queueTarget("a", "0");
    const tiles = parseRegion(BEHIND_A_WALL.join("\n"));
    let cast = false;
    for (let tick = 0; tick < 12 && !cast; tick++) {
      cast = castTicks(run(s, 1)).length > 0;
      if (!cast) expect(held(s, "airRune")).toBe(10);
    }
    expect(cast).toBe(true);
    expect(me(s)).not.toMatchObject({ x: 1, y: 1 });
    // Against the tile the Spider stood on, as it moves toward the mage later the same tick.
    expect(inSight(tiles, me(s), { x: 9, y: 1 })).toBe(true);
  });
});

describe("cast rate", () => {
  test("a staff casts every 10 ticks", () => {
    const s = mage({});
    s.queueTarget("a", "0");
    expect(castTicks(run(s, 21))).toEqual([1, 11, 21]);
  });
});

describe("spending runes", () => {
  test("each cast spends exactly its spell's runes, hit or miss", () => {
    // The first cast lands, the second misses.
    const s = mage({}, 0, 0, MISS);
    s.queueTarget("a", "0");
    run(s, 11);
    expect(held(s, "airRune")).toBe(8);
    expect(held(s, "focusRune")).toBe(8);
  });

  test("a bigger spell spends each of its runes", () => {
    const s = mage({
      magicXp: xpForLevel(20),
      combatSpell: "fireDart",
      runes: [
        ["fireRune", 7],
        ["airRune", 5],
        ["focusRune", 2],
        ["waterRune", 4],
      ],
    });
    s.queueTarget("a", "0");
    run(s, 1);
    expect(
      ["fireRune", "airRune", "focusRune", "waterRune"].map((rune) =>
        held(s, rune),
      ),
    ).toEqual([4, 3, 1, 4]);
  });

  test("running out mid-fight stops the attack and says so, and the enemy fights on", () => {
    const s = mage({
      rows: CLOSE,
      runes: [
        ["airRune", 1],
        ["focusRune", 1],
      ],
    });
    s.queueTarget("a", "0");
    const events = run(s, 21);
    expect(castTicks(events)).toEqual([1]);
    expect(told(events)).toEqual([OUT_OF_RUNES_LINE]);
    expect(me(s)).toMatchObject({ action: "", target: "" });
    expect(events.filter((e) => e.type === "enemySwing").length).toBe(3);
    expect(spider(s).target).toBe("a");
    expect([...me(s).inventory.slice(0, 2)]).toEqual([EMPTY_SLOT, EMPTY_SLOT]);
  });

  test("without the runes at the click, nothing is cast and the chat says so", () => {
    const s = mage({ rows: OUT_OF_REACH, runes: [["airRune", 10]] });
    s.queueTarget("a", "0");
    const events = run(s, 11);
    expect(castTicks(events)).toEqual([]);
    expect(told(events)).toEqual([OUT_OF_RUNES_LINE]);
    expect(me(s)).toMatchObject({ x: 1, action: "" });
  });
});

describe("with no spell picked", () => {
  test("an attack with a staff is refused, and the chat says so", () => {
    const s = mage({ combatSpell: "" });
    s.queueTarget("a", "0");
    const events = run(s, 11);
    expect(castTicks(events)).toEqual([]);
    expect(told(events)).toEqual([NO_SPELL_LINE]);
    expect(held(s, "airRune")).toBe(10);
  });
});

describe("a cast", () => {
  test("lands from 100 plus the spell's hit bonus, and pays Magic its base and damage parts and Hitpoints the damage part", () => {
    // Lands, rolls the bottom of the range (100), no crit: 100 plus air dart's 100.
    const s = mage({}, 0, 0, MISS);
    s.queueTarget("a", "0");
    const events = run(s, 1);
    expect(events.find((e) => e.type === "playerSwing")).toMatchObject({
      damage: 200,
      critical: false,
    });
    expect(spider(s).health).toBe(600);
    expect(me(s)).toMatchObject({
      magicXp: 14,
      hitpointsXp: 4062,
      attackXp: 0,
      strengthXp: 0,
      rangedXp: 0,
      defenseXp: 0,
    });
  });

  test("a miss pays only the spell's base experience", () => {
    const s = mage({});
    s.queueTarget("a", "0");
    run(s, 1);
    expect(me(s)).toMatchObject({ magicXp: 2, hitpointsXp: 4050 });
  });

  test("tops out at the Magic max plus the spell's bonus, and can crit", () => {
    // Magic 20: max 300, plus earth dart's 200; the crit makes it 750.
    const s = mage(
      {
        magicXp: xpForLevel(20),
        combatSpell: "earthDart",
        runes: [
          ["earthRune", 2],
          ["airRune", 1],
          ["focusRune", 1],
        ],
      },
      0,
      0.99999,
      0,
    );
    s.queueTarget("a", "0");
    expect(run(s, 1).find((e) => e.type === "playerSwing")).toMatchObject({
      damage: 750,
      critical: true,
    });
  });

  test("magic beats the Spider's melee: it lands 10 points more often", () => {
    // 45% with the birch staff, 55% against a melee enemy.
    const landed = (roll: number) => {
      const s = mage({}, roll, 0, MISS);
      s.queueTarget("a", "0");
      return run(s, 1).find((e) => e.type === "playerSwing");
    };
    expect(landed(0.5499)).toMatchObject({ damage: 200 });
    expect(landed(0.5501)).toMatchObject({ damage: 0 });
  });

  test("taking the staff off mid-fight ends the attack rather than turning it to a punch", () => {
    const s = mage({});
    s.queueTarget("a", "0");
    run(s, 1);
    s.takeOff("a", "weapon");
    // The next cast was due on tick 11, and nothing is spent or swung then.
    const events = run(s, 10);
    expect(castTicks(events)).toEqual([]);
    expect(held(s, "airRune")).toBe(9);
    expect(me(s)).toMatchObject({ attackXp: 0, strengthXp: 0, action: "" });
  });
});

describe("fighting back", () => {
  test("an idle mage who is hit casts back with the picked spell", () => {
    const s = mage({ rows: CLOSE });
    // The Spider starts the fight as though it had noticed them.
    s.queueTarget("a", "0");
    run(s, 1);
    s.queueWalk("a", { x: 1, y: 1 });
    const events = run(s, 20);
    // The Spider's swing on tick 5 finds them idle; they reply once 10 ticks have passed since
    // their first cast, and every 10 after.
    expect(castTicks(events)).toEqual([11, 21]);
    expect(held(s, "airRune")).toBe(7);
  });

  test("an idle mage with no spell picked does not fight back", () => {
    const s = mage({ rows: CLOSE, combatSpell: "" });
    s.queueTarget("a", "0");
    const events = run(s, 20);
    expect(castTicks(events)).toEqual([]);
  });
});
