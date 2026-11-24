import {
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  parseRegion,
  type WorldEvent,
} from "@runic/shared";
import { describe, expect, test } from "vitest";
import type { PlayerSave } from "./saves.ts";
import { Simulation } from "./simulation.ts";

/**
 * Every roll. A fresh player with a sword lands 40% of the time and a birch bow 45%, so 0.38
 * lands a swing and, with the triangle's 10 points off, misses a shot. A Spider hits 35% of the
 * time, so 0.38 misses a melee player and, with the triangle's 10 points on, hits a ranged one.
 * It never wanders (10%), and a missed shot's arrow is recovered (50%).
 */
const ROLL = 0.38;

// The respawn tile is (1,1), and the Spider stands 2 tiles off at (3,1).
const ROWS = ["TTTTTTTTTTTT", "TR.S.......T", "TTTTTTTTTTTT"];

/** One fighter, "a", at (1,1) with a birch bow and 10 copper arrows unless told otherwise, and `held` in the first inventory slots. */
function fighter(
  { held = [], ...fields }: Partial<PlayerSave> & { held?: string[] },
  roll = ROLL,
) {
  const s = new Simulation(parseRegion(ROWS.join("\n")), () => roll);
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

const SWORD = { weapon: "copperSword", ammo: "", ammoCount: 0 };

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

const playerDamage = (events: ReturnType<typeof run>) =>
  events.flatMap((e) => (e.type === "playerSwing" ? [e.damage] : []));
const enemyDamage = (events: ReturnType<typeof run>) =>
  events.flatMap((e) => (e.type === "enemySwing" ? [e.damage] : []));

describe("the combat triangle in a fight (#271)", () => {
  test("a Spider hits a player with a bow more often, and the bow lands less often on it", () => {
    const s = fighter({});
    s.queueTarget("a", "0");
    const events = run(s, 20);
    expect(playerDamage(events).length).toBeGreaterThan(1);
    expect(playerDamage(events).every((damage) => damage === 0)).toBe(true);
    expect(enemyDamage(events).length).toBeGreaterThan(1);
    expect(enemyDamage(events).every((damage) => damage > 0)).toBe(true);
  });

  test("a Spider against a player with a sword hits and is hit as before", () => {
    const s = fighter(SWORD);
    s.queueTarget("a", "0");
    const events = run(s, 20);
    expect(playerDamage(events).length).toBeGreaterThan(1);
    expect(playerDamage(events).every((damage) => damage > 0)).toBe(true);
    expect(enemyDamage(events).length).toBeGreaterThan(1);
    expect(enemyDamage(events).every((damage) => damage === 0)).toBe(true);
  });

  test("bare hands fight in melee, so a Spider hits them as before", () => {
    const s = fighter({ weapon: "", weaponCount: 0, ammo: "", ammoCount: 0 });
    s.queueTarget("a", "0");
    const events = run(s, 20);
    expect(enemyDamage(events).length).toBeGreaterThan(1);
    expect(enemyDamage(events).every((damage) => damage === 0)).toBe(true);
  });

  test("the style is the weapon in hand when the hit resolves: a sword swapped for a bow mid-fight is hit as a ranged player", () => {
    const s = fighter({ ...SWORD, held: ["birchBow"] });
    s.queueTarget("a", "0");
    const before = run(s, 3);
    expect(playerDamage(before)).toEqual([expect.any(Number)]);
    expect(enemyDamage(before)).toEqual([]);
    s.equip("a", 0);
    const after = run(s, 12);
    expect(s.state.players.get("a")!.weapon).toBe("birchBow");
    expect(enemyDamage(after).length).toBeGreaterThan(0);
    expect(enemyDamage(after).every((damage) => damage > 0)).toBe(true);
  });

  test("the style is the weapon in hand when the hit resolves: a bow swapped for a sword mid-fight is hit as a melee player", () => {
    const s = fighter({ held: ["copperSword"] });
    s.queueTarget("a", "0");
    const before = run(s, 1);
    expect(playerDamage(before)).toEqual([0]);
    s.equip("a", 0);
    const after = run(s, 12);
    expect(s.state.players.get("a")!.weapon).toBe("copperSword");
    expect(enemyDamage(after).length).toBeGreaterThan(0);
    expect(enemyDamage(after).every((damage) => damage === 0)).toBe(true);
  });

  test("the triangle never changes how hard a hit lands: a ranged player takes what a melee player would", () => {
    // A roll of 0 lands every swing at the bottom of the range, whatever the style.
    const sword = fighter(SWORD, 0);
    const bow = fighter({}, 0);
    sword.queueTarget("a", "0");
    bow.queueTarget("a", "0");
    expect(enemyDamage(run(bow, 20))).toEqual(enemyDamage(run(sword, 20)));
  });
});
