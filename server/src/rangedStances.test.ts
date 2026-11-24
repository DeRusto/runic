import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  parseRegion,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const MISS = 0.99;

// The respawn tile is (1,1); the Spider's home is (7,1), 6 tiles off, in reach of a bow.
const BOW_REACH = ["TTTTTTTTTTTT", "TR.....S...T", "TTTTTTTTTTTT"];
// The Spider is 8 tiles off at (9,1): in reach of a Longrange bow only.
const LONGRANGE_BOW_REACH = ["TTTTTTTTTTTT", "TR.......S.T", "TTTTTTTTTTTT"];
// The Spider is 4 tiles off at (5,1), in reach of a throw.
const KNIFE_REACH = ["TTTTTTTTTTTT", "TR...S.....T", "TTTTTTTTTTTT"];

// A Tarn Ox, which never fights back, 6 tiles off at (7,1).
const OX = ["TTTTTTTTTTTT", "TR.....X...T", "TTTTTTTTTTTT"];

type Start = Partial<PlayerSave> & { rows?: string[]; held?: string[] };

/** One archer, "a", at (1,1) with a birch bow and 20 copper arrows unless told otherwise. Rolls come in order, then everything misses. */
function archer(
  { rows = BOW_REACH, held = [], ...fields }: Start,
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
    weapon: "birchBow",
    weaponCount: 1,
    ammo: "copperArrow",
    ammoCount: 20,
    inventory: [
      ...held,
      ...Array<string>(INVENTORY_SLOTS - held.length).fill(EMPTY_SLOT),
    ],
    inventoryCounts: [
      ...held.map(() => 20),
      ...Array<number>(INVENTORY_SLOTS - held.length).fill(0),
    ],
    ...fields,
  });
  return s;
}

/** The same, with 20 copper throwing knives in hand. */
const thrower = ({ rows = KNIFE_REACH, ...start }: Start, ...rolls: number[]) =>
  archer(
    { rows, weapon: "copperThrowingKnife", weaponCount: 20, ...start },
    ...rolls,
  );

const me = (s: Simulation) => s.state.players.get("a")!;

/** Has the player attack the Spider, and hands back the simulation. */
const attack = (s: Simulation) => {
  s.queueTarget("a", "0");
  return s;
};

/** Ticks the simulation, and returns the ticks a shot or throw came on. */
function shotTicks(s: Simulation, ticks: number) {
  const seen: number[] = [];
  for (let i = 0; i < ticks; i++) {
    s.tick();
    for (const event of s.events.splice(0) as WorldEvent[])
      if (event.type === "playerSwing") seen.push(s.state.tick);
  }
  return seen;
}

describe("choosing a Ranged stance", () => {
  test("a player starts Steady, and choosing a Ranged stance leaves the melee stance as it was", () => {
    const s = archer({ stance: "forceful" });
    expect(me(s)).toMatchObject({ rangedStance: "steady", stance: "forceful" });
    s.setStance("a", "longrange");
    expect(me(s)).toMatchObject({
      rangedStance: "longrange",
      stance: "forceful",
    });
    s.setStance("a", "precise");
    expect(me(s)).toMatchObject({
      rangedStance: "longrange",
      stance: "precise",
    });
  });

  test("anything but a stance's own id is ignored", () => {
    const s = archer({ rangedStance: "rapid" });
    for (const stance of ["Rapid", "toString", "", "fast"])
      s.setStance("a", stance);
    expect(me(s)).toMatchObject({ rangedStance: "rapid", stance: "balanced" });
  });

  test("each style keeps its own stance across weapon swaps", () => {
    const s = archer({
      rangedStance: "rapid",
      stance: "precise",
      held: ["copperSword"],
    });
    s.equip("a", 0);
    expect(me(s)).toMatchObject({
      weapon: "copperSword",
      rangedStance: "rapid",
      stance: "precise",
    });
    s.equip("a", 0);
    expect(me(s)).toMatchObject({
      weapon: "birchBow",
      rangedStance: "rapid",
      stance: "precise",
    });
  });
});

describe("Steady", () => {
  test("a bow fires every 8 ticks from 6 tiles, and knives every 6 from 4", () => {
    expect(shotTicks(attack(archer({})), 17)).toEqual([1, 9, 17]);
    expect(shotTicks(attack(thrower({})), 13)).toEqual([1, 7, 13]);
  });

  test("all of a shot's experience goes to Ranged, with a bow and with knives", () => {
    for (const s of [archer({}, 0, 0, MISS), thrower({}, 0, 0, MISS)]) {
      shotTicks(attack(s), 1);
      expect(me(s)).toMatchObject({
        rangedXp: 12,
        defenseXp: 0,
        hitpointsXp: 4062,
      });
    }
  });
});

describe("Rapid", () => {
  test("a bow fires every 6 ticks", () => {
    const s = archer({ rangedStance: "rapid" });
    expect(shotTicks(attack(s), 13)).toEqual([1, 7, 13]);
  });

  test("knives are thrown every 4 ticks", () => {
    const s = thrower({ rangedStance: "rapid" });
    expect(shotTicks(attack(s), 9)).toEqual([1, 5, 9]);
  });

  test("all of a shot's experience goes to Ranged, with a bow and with knives", () => {
    for (const s of [
      archer({ rangedStance: "rapid" }, 0, 0, MISS),
      thrower({ rangedStance: "rapid" }, 0, 0, MISS),
    ]) {
      shotTicks(attack(s), 1);
      expect(me(s)).toMatchObject({ rangedXp: 12, defenseXp: 0 });
    }
  });
});

describe("Longrange", () => {
  test("a bow shoots an enemy 8 tiles away without walking, which Steady must walk to", () => {
    const far = archer({
      rows: LONGRANGE_BOW_REACH,
      rangedStance: "longrange",
    });
    expect(shotTicks(attack(far), 1)).toEqual([1]);
    expect(me(far)).toMatchObject({ x: 1, y: 1 });
    // Steady walks 2 tiles, into its 6, and shoots on arriving.
    const steady = archer({ rows: LONGRANGE_BOW_REACH });
    expect(shotTicks(attack(steady), 4)).toEqual([3]);
    expect(me(steady)).toMatchObject({ x: 3, y: 1 });
  });

  test("knives reach an enemy 6 tiles away without walking, which Steady must walk to", () => {
    const far = thrower({ rows: BOW_REACH, rangedStance: "longrange" });
    expect(shotTicks(attack(far), 1)).toEqual([1]);
    expect(me(far)).toMatchObject({ x: 1, y: 1 });
    // Steady walks 2 tiles, into its 4, and throws on arriving.
    const steady = thrower({ rows: BOW_REACH });
    expect(shotTicks(attack(steady), 4)).toEqual([3]);
    expect(me(steady)).toMatchObject({ x: 3, y: 1 });
  });

  test("keeps the weapon's own fire rate", () => {
    const bow = archer({ rangedStance: "longrange" });
    expect(shotTicks(attack(bow), 9)).toEqual([1, 9]);
    const knives = thrower({ rangedStance: "longrange" });
    expect(shotTicks(attack(knives), 7)).toEqual([1, 7]);
  });

  test("splits a shot's experience evenly between Ranged and Defense, Ranged taking the odd point, with a bow and with knives", () => {
    // 100 plus the copper bonus of 100 is 200 damage, for 12 experience.
    for (const s of [
      archer({ rangedStance: "longrange" }, 0, 0, MISS),
      thrower({ rangedStance: "longrange" }, 0, 0, MISS),
    ]) {
      shotTicks(attack(s), 1);
      expect(me(s)).toMatchObject({
        rangedXp: 6,
        defenseXp: 6,
        hitpointsXp: 4062,
      });
    }
    // 105 plus 100 is 205 damage, for 12.3, rounded to 12; a 215 hit gives 12.9, rounded to 13.
    const odd = archer({ rangedStance: "longrange" }, 0, 0.13, MISS);
    shotTicks(attack(odd), 1);
    expect(me(odd)).toMatchObject({
      rangedXp: 7,
      defenseXp: 6,
      hitpointsXp: 4063,
    });
  });
});

describe("changing mid-fight", () => {
  test("a change of stance is read by the next shot", () => {
    // The first shot misses the Ox, which never fights back; the second lands for 200.
    const s = archer({ rows: OX }, MISS, 0, 0, MISS);
    shotTicks(attack(s), 1);
    expect(me(s)).toMatchObject({ rangedXp: 0, defenseXp: 0 });
    s.setStance("a", "longrange");
    expect(shotTicks(s, 8)).toEqual([9]);
    expect(me(s)).toMatchObject({ rangedXp: 6, defenseXp: 6 });
  });

  test("Rapid never shortens the wait already running: the next shot comes when it ends, and the shorter interval from the one after", () => {
    const s = archer({});
    expect(shotTicks(attack(s), 2)).toEqual([1]);
    s.setStance("a", "rapid");
    expect(shotTicks(s, 13)).toEqual([9, 15]);
  });

  test("a swap from a bow to knives keeps the bow's wait, and the knives' interval applies after it", () => {
    const s = archer({ rows: KNIFE_REACH, held: ["copperThrowingKnife"] });
    expect(shotTicks(attack(s), 2)).toEqual([1]);
    s.equip("a", 0);
    expect(me(s).weapon).toBe("copperThrowingKnife");
    expect(shotTicks(s, 13)).toEqual([9, 15]);
  });

  test("a swap from knives to a bow never fires sooner than the knives' wait, and the bow's interval applies after it", () => {
    const s = thrower({ held: ["birchBow"] });
    expect(shotTicks(attack(s), 2)).toEqual([1]);
    s.equip("a", 0);
    expect(me(s).weapon).toBe("birchBow");
    expect(shotTicks(s, 13)).toEqual([7, 15]);
  });

  test("a change of stance is refused during an Agility crossing", () => {
    const tiles = parseRegion("TTTTTT\nTR...T\nT....T\nTTTTTT");
    tiles[1]![1] = { ...tiles[1]![1]!, obstacle: "balanceBeam" };
    const s = new Simulation(tiles, () => 0);
    s.addPlayer("a");
    s.queueCross("a", "balanceBeam");
    s.tick();
    expect(s.isBusy("a")).toBe(true);
    s.setStance("a", "rapid");
    expect(me(s).rangedStance).toBe("steady");
  });
});
