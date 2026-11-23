import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  OUT_OF_ARROWS_LINE,
  parseRegion,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

const MISS = 0.99;

// The respawn tile is (1,1). The Spider's home is 6 tiles off at (7,1), in reach of a bow.
const IN_REACH = ["TTTTTTTTTTTT", "TR.....S...T", "TTTTTTTTTTTT"];
// The Spider is 8 tiles off at (9,1), so a bow must walk 2 tiles closer.
const OUT_OF_REACH = ["TTTTTTTTTTTT", "TR.......S.T", "TTTTTTTTTTTT"];
// The Spider is 2 tiles off at (3,1), inside its leash, so it comes and fights.
const CLOSE = ["TTTTTTTTTTTT", "TR.S.......T", "TTTTTTTTTTTT"];

type Start = Partial<PlayerSave> & { rows?: string[]; held?: string[] };

/** One archer, "a", at (1,1) with a birch bow and 10 copper arrows unless told otherwise. Rolls come in order, then everything misses. */
function archer(
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
    weapon: "birchBow",
    weaponCount: 1,
    ammo: "copperArrow",
    ammoCount: 10,
    inventory: [
      ...held,
      ...Array<string>(INVENTORY_SLOTS - held.length).fill(EMPTY_SLOT),
    ],
    ...fields,
  });
  return s;
}

const me = (s: Simulation) => s.state.players.get("a")!;
const spider = (s: Simulation) => s.state.enemies.get("0")!;

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

const shotTicks = (events: ReturnType<typeof run>) =>
  events.filter((e) => e.type === "playerSwing").map((e) => e.tick);
const told = (events: ReturnType<typeof run>) =>
  events.flatMap((e) => (e.type === "told" ? [e.line] : []));

describe("reach", () => {
  test("a bow shoots an enemy 6 tiles away without walking", () => {
    const s = archer({});
    s.queueTarget("a", "0");
    const events = run(s, 1);
    expect(shotTicks(events)).toEqual([1]);
    expect(me(s)).toMatchObject({ x: 1, y: 1 });
  });

  test("a bow walks into reach of an enemy further off, then shoots on arriving", () => {
    const s = archer({ rows: OUT_OF_REACH });
    s.queueTarget("a", "0");
    const events = run(s, 4);
    expect(me(s).x).toBe(3);
    expect(shotTicks(events)).toEqual([3]);
  });

  test("a sword still walks next to the enemy", () => {
    const s = archer({ weapon: "copperSword", ammo: "", ammoCount: 0 });
    s.queueTarget("a", "0");
    const events = run(s, 10);
    expect(me(s).x).toBe(6);
    expect(shotTicks(events)).toEqual([9]);
  });
});

describe("fire rate", () => {
  test("a bow fires every 8 ticks", () => {
    const s = archer({});
    s.queueTarget("a", "0");
    expect(shotTicks(run(s, 17))).toEqual([1, 9, 17]);
  });
});

describe("a shot", () => {
  test("rolls on Ranged and the arrow, and pays Ranged and Hitpoints 6 per 100 damage", () => {
    // Lands, rolls the bottom of the range (100), no crit: 100 plus the copper arrow's 100.
    const s = archer({}, 0, 0, MISS);
    s.queueTarget("a", "0");
    const events = run(s, 1);
    expect(events.find((e) => e.type === "playerSwing")).toMatchObject({
      damage: 200,
    });
    expect(me(s)).toMatchObject({
      rangedXp: 12,
      hitpointsXp: 4062,
      attackXp: 0,
      strengthXp: 0,
    });
  });

  test("a better arrow hits harder", () => {
    const s = archer({ ammo: "emberiteArrow", rangedXp: 18050 }, 0, 0, MISS);
    s.queueTarget("a", "0");
    expect(run(s, 1).find((e) => e.type === "playerSwing")).toMatchObject({
      damage: 400,
    });
  });

  test("overkill pays nothing", () => {
    const s = archer({}, 0, 0, MISS);
    spider(s).health = 50;
    s.queueTarget("a", "0");
    run(s, 1);
    expect(me(s).rangedXp).toBe(3);
  });
});

describe("spending arrows", () => {
  test("each shot spends one arrow, hit or miss", () => {
    const s = archer({}, 0, 0, MISS);
    s.queueTarget("a", "0");
    run(s, 9);
    expect(me(s).ammoCount).toBe(8);
  });

  test("the last arrow's shot refills the slot with up to 20 of the same arrow from the inventory, and the fight carries on", () => {
    const s = archer({
      ammoCount: 1,
      held: ["bronzeArrow", "copperArrow", "copperArrow"],
      inventoryCounts: [5, 15, 10],
    });
    s.queueTarget("a", "0");
    const events = run(s, 9);
    expect(shotTicks(events)).toEqual([1, 9]);
    // 20 came in after the first shot, and the second spent one.
    expect(me(s)).toMatchObject({ ammo: "copperArrow", ammoCount: 19 });
    expect([...me(s).inventory.slice(0, 3)]).toEqual([
      "bronzeArrow",
      EMPTY_SLOT,
      "copperArrow",
    ]);
    expect([...me(s).inventoryCounts.slice(0, 3)]).toEqual([5, 0, 5]);
  });

  test("with no arrows left anywhere, the attack stops and the chat says so", () => {
    const s = archer({
      ammoCount: 1,
      held: ["bronzeArrow"],
      inventoryCounts: [5],
    });
    s.queueTarget("a", "0");
    const events = run(s, 17);
    expect(shotTicks(events)).toEqual([1]);
    expect(told(events)).toEqual([OUT_OF_ARROWS_LINE]);
    expect(me(s)).toMatchObject({
      ammo: "",
      ammoCount: 0,
      action: "",
      target: "",
    });
  });

  test("the enemy keeps fighting a player who ran out", () => {
    const s = archer({ rows: CLOSE, ammoCount: 1 });
    s.queueTarget("a", "0");
    const events = run(s, 13);
    expect(shotTicks(events)).toEqual([1]);
    expect(events.filter((e) => e.type === "enemySwing").length).toBe(2);
    expect(spider(s).target).toBe("a");
    // Being hit doesn't start a fight back with nothing to fire.
    expect(told(events)).toEqual([OUT_OF_ARROWS_LINE]);
  });

  test("a bow with an empty ammo slot can't attack, and the chat says so", () => {
    const s = archer({ rows: OUT_OF_REACH, ammo: "", ammoCount: 0 });
    s.queueTarget("a", "0");
    const events = run(s, 9);
    expect(shotTicks(events)).toEqual([]);
    expect(told(events)).toEqual([OUT_OF_ARROWS_LINE]);
    expect(me(s)).toMatchObject({ x: 1, action: "" });
  });
});

describe("fighting back", () => {
  test("an idle archer who is hit shoots back under the same rules", () => {
    const s = archer({ rows: CLOSE });
    // The Spider starts the fight as though it had noticed them.
    s.queueTarget("a", "0");
    run(s, 1);
    s.queueWalk("a", { x: 1, y: 1 });
    const events = run(s, 16);
    // The Spider's swing on tick 5 finds them idle; they reply 4 ticks later and every 8.
    expect(shotTicks(events)).toEqual([9, 17]);
    expect(me(s).ammoCount).toBe(7);
  });
});

// A tree at (3,1) walls the archer off from the Spider at (8,1), 7 tiles away: one step to (2,1) puts it in reach.
const WALLED_OFF = ["TTTTTTTTTTTT", "TR.T....S..T", "TTTTTTTTTTTT"];
// A Tarn Ox, which never moves or fights back, 6 tiles off at (7,1), in a long corridor.
const OX = ["TTTTTTTTTTTTTTTTT", "TR.....X........T", "TTTTTTTTTTTTTTTTT"];

describe("walking into reach", () => {
  test("an archer walled off from the enemy steps to the nearest tile in reach and shoots", () => {
    const s = archer({ rows: WALLED_OFF });
    s.queueTarget("a", "0");
    const events = run(s, 3);
    expect(me(s).x).toBe(2);
    expect(shotTicks(events)).toEqual([1]);
  });

  test("a target that moves out of reach mid-fight is walked back into reach before the next shot, spending nothing on the way", () => {
    const s = archer({ rows: OX });
    s.queueTarget("a", "0");
    run(s, 1);
    expect(me(s).ammoCount).toBe(9);
    // It is now 13 tiles off: 7 steps, a tile per 2 ticks, puts it back in reach on tick 14.
    spider(s).x = 14;
    const walking = run(s, 12);
    expect(shotTicks(walking)).toEqual([]);
    expect(me(s)).toMatchObject({ ammoCount: 9, rangedXp: 0, x: 7 });
    expect(shotTicks(run(s, 1))).toEqual([14]);
    expect(me(s)).toMatchObject({ ammoCount: 8, x: 8 });
  });
});

describe("the check before each shot", () => {
  test("a target killed by someone else before the shot ends the attack, with no arrow spent and no experience", () => {
    // "b" swings a copper sword beside the Tarn Ox: a miss on tick 1, then 200 on tick 9, which kills it.
    const s = archer({ rows: OX }, MISS, MISS, 0, 0, MISS);
    s.addPlayer("b", {
      x: 6,
      y: 1,
      defenseXp: 0,
      herblawXp: 0,
      hitpointsXp: 4050,
      health: 1000,
      weapon: "copperSword",
      inventory: [],
    });
    s.queueTarget("b", "0");
    run(s, 1);
    // The archer's shots fall on ticks 2 and 10; the Tarn Ox dies on tick 9.
    s.queueTarget("a", "0");
    const events = run(s, 12);
    expect(events.filter((e) => e.type === "playerSwing")).toMatchObject([
      { player: "a", tick: 2 },
      { player: "b", tick: 9 },
    ]);
    expect(me(s)).toMatchObject({ ammoCount: 9, rangedXp: 0, action: "" });
  });

  test("a bow taken off mid-fight stops the attack rather than swinging bare-handed", () => {
    const s = archer({}, MISS, 0, 0, MISS);
    s.queueTarget("a", "0");
    run(s, 1);
    s.takeOff("a", "weapon");
    const events = run(s, 9);
    expect(shotTicks(events)).toEqual([]);
    expect(me(s)).toMatchObject({
      ammoCount: 9,
      attackXp: 0,
      strengthXp: 0,
      action: "",
    });
  });

  test("arrows taken off mid-fight stop the attack with nothing spent, and the chat says why", () => {
    const s = archer({});
    s.queueTarget("a", "0");
    run(s, 1);
    s.takeOff("a", "ammo");
    const events = run(s, 9);
    expect(shotTicks(events)).toEqual([]);
    expect(told(events)).toEqual([OUT_OF_ARROWS_LINE]);
    expect(me(s).inventoryCounts[0]).toBe(9);
    expect(me(s).action).toBe("");
  });
});

describe("repeated attack intents", () => {
  test("never shoot, spend or pay more than once a tick, nor faster than the bow fires", () => {
    // Every roll is 0.2: each shot lands for 220 with no crit, paying 13 Ranged.
    const s = archer({}, ...Array<number>(200).fill(0.2));
    const events: ReturnType<typeof run> = [];
    for (let tick = 0; tick < 9; tick++) {
      s.queueTarget("a", "0");
      s.queueTarget("a", "0");
      s.queueTarget("a", "0");
      events.push(...run(s, 1));
    }
    expect(shotTicks(events)).toEqual([1, 9]);
    expect(me(s)).toMatchObject({ ammoCount: 8, rangedXp: 26 });
  });
});
