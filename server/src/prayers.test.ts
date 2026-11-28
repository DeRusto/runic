import {
  EAT_SWING_DELAY_TICKS,
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  landChanceOf,
  magicHitOf,
  MIGHT_POTION_HIT,
  rangedHitOf,
  OUT_OF_PRAYER_LINE,
  parseRegion,
  xpForLevel,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const MISS = 0.99;

// The respawn tile is (1,1); nothing else stands here.
const ALONE = ["TTTTT", "TR..T", "TTTTT"];
// The Spider's home is (2,1), next to the respawn tile.
const NEXT_TO = ["TTTTTTT", "TRS...T", "T.....T", "TTTTTTT"];
// The Spider's home is 6 tiles off at (7,1), in reach of a bow and a staff.
const IN_REACH = ["TTTTTTTTTTTT", "TR.....S...T", "TTTTTTTTTTTT"];

/** The bag holding `items` in its first slots, the rest empty. */
const bag = (...items: [string, number][]) => ({
  inventory: [
    ...items.map(([item]) => item),
    ...Array<string>(INVENTORY_SLOTS - items.length).fill(EMPTY_SLOT),
  ],
  inventoryCounts: [
    ...items.map(([, count]) => count),
    ...Array<number>(INVENTORY_SLOTS - items.length).fill(0),
  ],
});

/** Player "a" at (1,1) at `prayerLevel` with a full pool. Rolls come in order, then everything misses. */
function prayerAt(
  prayerLevel: number,
  { rows = ALONE, ...fields }: Partial<PlayerSave> & { rows?: string[] } = {},
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
    inventory: [],
    prayerXp: xpForLevel(prayerLevel),
    prayerPoints: prayerLevel * 10,
    ...fields,
  });
  return s;
}

const me = (s: Simulation) => s.state.players.get("a")!;
const spider = (s: Simulation) => s.state.enemies.get("0")!;
const active = (s: Simulation) => [...me(s).prayers];

/** Ticks the simulation, and returns each event it sent. */
function run(s: Simulation, ticks: number) {
  const seen: WorldEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    s.tick();
    seen.push(...s.events.splice(0));
  }
  return seen;
}

const told = (events: WorldEvent[]) =>
  events.flatMap((e) => (e.type === "told" ? [e.line] : []));

describe("turning prayers on and off", () => {
  test("a click turns a prayer on, and another click turns it off", () => {
    const s = prayerAt(1);
    s.togglePrayer("a", "sureHand");
    expect(active(s)).toEqual(["sureHand"]);
    s.togglePrayer("a", "sureHand");
    expect(active(s)).toEqual([]);
  });

  test("only one step of a ladder runs at once, and ladders combine", () => {
    const s = prayerAt(25);
    s.togglePrayer("a", "sureHand");
    s.togglePrayer("a", "firmGrip");
    s.togglePrayer("a", "lightStep");
    s.togglePrayer("a", "farSight");
    expect(active(s).sort()).toEqual(["farSight", "firmGrip", "lightStep"]);
    s.togglePrayer("a", "giantsWrath");
    expect(active(s).sort()).toEqual(["farSight", "giantsWrath", "lightStep"]);
  });

  test("a prayer above the player's level is refused", () => {
    const s = prayerAt(3);
    s.togglePrayer("a", "firmGrip");
    expect(active(s)).toEqual([]);
  });

  test("turning a prayer on at 0 points is refused", () => {
    const s = prayerAt(1, { prayerPoints: 0 });
    s.togglePrayer("a", "sureHand");
    expect(active(s)).toEqual([]);
  });

  test("a ward, an unknown name or anything but a string is ignored", () => {
    const s = prayerAt(99);
    for (const prayer of ["wardOfSteel", "toString", 3, undefined, {}])
      s.togglePrayer("a", prayer);
    expect(active(s)).toEqual([]);
  });

  test("prayers can't be changed during an Agility crossing, like stances", () => {
    const tiles = parseRegion("TTTTTT\nTR...T\nT....T\nTTTTTT");
    tiles[1]![1] = { ...tiles[1]![1]!, obstacle: "balanceBeam" };
    const s = new Simulation(tiles, () => 0);
    s.addPlayer("a");
    s.queueCross("a", "balanceBeam");
    s.tick();
    expect(s.isBusy("a")).toBe(true);
    s.togglePrayer("a", "sureHand");
    expect(active(s)).toEqual([]);
  });
});

describe("drain", () => {
  test("points drain at the summed rate and none come back while a prayer is on", () => {
    // Sure Hand and Firm Grip drain 10 each per 200 ticks: one point every 10 ticks.
    const s = prayerAt(4, { prayerPoints: 30 });
    s.togglePrayer("a", "sureHand");
    s.togglePrayer("a", "firmGrip");
    run(s, 9);
    expect(me(s).prayerPoints).toBe(30);
    run(s, 1);
    expect(me(s).prayerPoints).toBe(29);
    // Tick 20 would restore a point with no prayer on.
    run(s, 190);
    expect(me(s).prayerPoints).toBe(10);
  });

  test("at 0 every prayer switches off with a line in chat, and regen starts again", () => {
    const s = prayerAt(4, { prayerPoints: 1 });
    s.togglePrayer("a", "sureHand");
    s.togglePrayer("a", "firmGrip");
    const events = run(s, 10);
    expect(me(s).prayerPoints).toBe(0);
    expect(active(s)).toEqual([]);
    expect(told(events)).toEqual([OUT_OF_PRAYER_LINE]);
    run(s, 10);
    expect(me(s).prayerPoints).toBe(1);
  });

  test("with no prayer on, points come back as before", () => {
    const s = prayerAt(4, { prayerPoints: 30 });
    run(s, 20);
    expect(me(s).prayerPoints).toBe(31);
  });
});

describe("the boosts in a fight", () => {
  test("an Accuracy prayer lands a melee swing that would have missed", () => {
    // A fresh swing lands below 0.40; Sure Hand's 3 points make it 0.43.
    const missed = prayerAt(1, { rows: NEXT_TO }, 0.42, 0);
    missed.queueTarget("a", "0");
    run(missed, 1);
    expect(spider(missed).health).toBe(800);

    const s = prayerAt(1, { rows: NEXT_TO }, 0.42, 0);
    s.togglePrayer("a", "sureHand");
    s.queueTarget("a", "0");
    run(s, 1);
    expect(spider(s).health).toBe(700);
  });

  test("a Might prayer adds to a landed hit, on top of a Might potion", () => {
    const s = prayerAt(22, { rows: NEXT_TO }, 0, 0);
    s.togglePrayer("a", "giantsWrath");
    s.queueTarget("a", "0");
    run(s, 1);
    // The lowest landed hit is 100; Giant's Wrath adds 150.
    expect(spider(s).health).toBe(550);

    const buffed = prayerAt(4, { rows: NEXT_TO, ...bag(["mightPotion", 1]) });
    buffed.queueEat("a", 0);
    run(buffed, 1);
    buffed.togglePrayer("a", "firmGrip");
    buffed.queueTarget("a", "0");
    // Drinking holds the next swing back a few ticks; the land and damage rolls come after.
    run(buffed, EAT_SWING_DELAY_TICKS - 1);
    const rolls = [0, 0];
    Object.assign(buffed, { random: () => rolls.shift() ?? MISS });
    run(buffed, 1);
    expect(spider(buffed).health).toBe(800 - 100 - MIGHT_POTION_HIT - 50);
  });

  test("an Accuracy prayer lands a shot and a cast that would have missed", () => {
    const archer = {
      rows: IN_REACH,
      weapon: "birchBow",
      weaponCount: 1,
      ammo: "copperArrow",
      ammoCount: 10,
    };
    const mage = {
      rows: IN_REACH,
      weapon: "birchStaff",
      weaponCount: 1,
      combatSpell: "airDart",
      ...bag(["airRune", 10], ["focusRune", 10]),
    };
    for (const [kit, hitOfKit, style] of [
      [archer, rangedHitOf, "ranged"],
      [mage, magicHitOf, "magic"],
    ] as const) {
      // Five points above the plain chance against a melee Spider misses, and lands with Far Sight's ten.
      const roll =
        landChanceOf(hitOfKit(me(prayerAt(20, kit))).chance, style, "melee") +
        0.05;
      const missed = prayerAt(20, kit, roll, 0);
      missed.queueTarget("a", "0");
      run(missed, 1);
      expect(spider(missed).health).toBe(800);

      const s = prayerAt(20, kit, roll, 0);
      s.togglePrayer("a", "farSight");
      s.queueTarget("a", "0");
      run(s, 1);
      expect(spider(s).health).toBeLessThan(800);
    }
  });

  test("an Avoidance prayer makes an enemy's swing miss that would have hit", () => {
    // The Spider swings 4 ticks after the player; it lands below 0.35, and Mist Walker's 10
    // points bring that to 0.25.
    const hitRolls = [MISS, 0.3, 0];
    const plain = prayerAt(25, { rows: NEXT_TO }, ...hitRolls);
    plain.queueTarget("a", "0");
    run(plain, 5);
    expect(me(plain).health).toBeLessThan(1000);

    const s = prayerAt(25, { rows: NEXT_TO }, ...hitRolls);
    s.togglePrayer("a", "mistWalker");
    s.queueTarget("a", "0");
    run(s, 5);
    expect(me(s).health).toBe(1000);
  });
});

describe("switching off", () => {
  test("prayers switch off on death", () => {
    const s = prayerAt(25, { rows: NEXT_TO, health: 100 }, MISS, 0, 0.99);
    s.togglePrayer("a", "sureHand");
    s.queueTarget("a", "0");
    run(s, 5);
    expect(me(s).dead).toBe(true);
    expect(active(s)).toEqual([]);
  });

  test("prayers switch off on logout, so a returning player logs in with none on", () => {
    const s = prayerAt(4);
    s.togglePrayer("a", "sureHand");
    const saved = s.saveOf("a")!;
    s.removePlayer("a");
    s.addPlayer("a", saved);
    expect(active(s)).toEqual([]);
    run(s, 20);
    expect(me(s).prayerPoints).toBe(40);
  });

  test("a dead player can't turn a prayer on", () => {
    const s = prayerAt(25, { rows: NEXT_TO, health: 100 }, MISS, 0, 0.99);
    s.queueTarget("a", "0");
    run(s, 5);
    expect(me(s).dead).toBe(true);
    s.togglePrayer("a", "sureHand");
    expect(active(s)).toEqual([]);
  });
});
