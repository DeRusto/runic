import { parseRegion, xpForLevel, type CombatSpell } from "@runic/shared";
import { expect, test } from "vitest";
import { Simulation } from "./simulation.ts";

/** A mage with one of each casting rune, against one enemy in a straight corridor. */
function mage(
  spell: CombatSpell,
  distance = 1,
  roll: number | (() => number) = 0.42,
  kind = "K",
) {
  const s = new Simulation(
    parseRegion(
      [
        "TTTTTTTTTTTTTT",
        `TR${".".repeat(distance - 1)}${kind}${".".repeat(11 - distance)}T`,
        "TTTTTTTTTTTTTT",
      ].join("\n"),
    ),
    typeof roll === "number" ? () => roll : roll,
  );
  s.addPlayer("mage", {
    x: 1,
    y: 1,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: xpForLevel(99),
    health: 9900,
    magicXp: xpForLevel(30),
    weapon: "birchStaff",
    weaponCount: 1,
    combatSpell: spell,
    inventory: ["airRune", "waterRune", "earthRune", "focusRune", "furyRune"],
    inventoryCounts: [20, 20, 20, 1, 1],
  });
  return s;
}

function until(s: Simulation, tick: number) {
  s.events.length = 0;
  while (s.state.tick < tick) s.tick();
  return s.events;
}

const enemy = (s: Simulation) => s.state.enemies.get("0")!;

test.each(["airDart", "airSurge"] as const)(
  "%s weakens the Skeleton for twenty ticks",
  (spell) => {
    const s = mage(spell, 1, spell === "airDart" ? 0.42 : 0.38);
    s.queueTarget("mage", "0");
    until(s, 1);
    expect(enemy(s).air).toBe(true);
    s.queueWalk("mage", { x: 1, y: 1 });
    expect(until(s, 5)).toContainEqual(
      expect.objectContaining({ type: "enemySwing", damage: 0 }),
    );
    until(s, 20);
    expect(enemy(s).air).toBe(true);
    until(s, 21);
    expect(enemy(s).air).toBe(false);
    expect(until(s, 29)).toContainEqual(
      expect.objectContaining({
        type: "enemySwing",
        damage: expect.any(Number),
      }),
    );
    expect(
      s.events.find((e) => e.type === "enemySwing" && e.damage > 0),
    ).toBeDefined();
  },
);

test.each(["airDart", "waterDart", "earthDart"] as const)(
  "a missed %s applies no effect",
  (spell) => {
    const s = mage(spell, 1, 0.99);
    s.queueTarget("mage", "0");
    expect(until(s, 1)).toContainEqual(
      expect.objectContaining({ type: "playerSwing", damage: 0 }),
    );
    expect(enemy(s)).toMatchObject({ air: false, water: false, earth: false });
  },
);

test.each([
  ["waterDart", 9],
  ["waterSurge", 13],
] as const)(
  "%s delays the next swing once and the Skeleton resumes its regular pace",
  (spell, firstSwing) => {
    const s = mage(spell);
    s.queueTarget("mage", "0");
    until(s, firstSwing - 1);
    expect(enemy(s).water).toBe(true);
    expect(s.events.some((e) => e.type === "enemySwing")).toBe(false);
    expect(until(s, firstSwing).some((e) => e.type === "enemySwing")).toBe(
      true,
    );
    expect(enemy(s).water).toBe(false);
    expect(until(s, firstSwing + 7).some((e) => e.type === "enemySwing")).toBe(
      false,
    );
    expect(until(s, firstSwing + 8).some((e) => e.type === "enemySwing")).toBe(
      true,
    );
  },
);

test.each([
  ["earthDart", 6],
  ["earthSurge", 12],
] as const)(
  "%s keeps the Skeleton on its tile until the hold ends",
  (spell, ticks) => {
    const s = mage(spell, 4);
    s.queueTarget("mage", "0");
    until(s, ticks);
    expect(enemy(s)).toMatchObject({ x: 5, earth: true });
    until(s, ticks + 1);
    expect(enemy(s)).toMatchObject({ x: 4, earth: false });
  },
);

test("a held Skeleton attacks a mage within reach", () => {
  const s = mage("earthDart");
  s.queueTarget("mage", "0");
  expect(until(s, 5).some((e) => e.type === "enemySwing")).toBe(true);
  expect(enemy(s).earth).toBe(true);
});

test.each([
  ["airSurge", "airDart", "air", 31],
  ["waterSurge", "waterDart", "water", 19],
  ["earthSurge", "earthDart", "earth", 23],
] as const)(
  "a dart refreshes %s at surge strength",
  (surge, dart, effect, endTick) => {
    const s = mage(surge);
    s.queueTarget("mage", "0");
    until(s, 1);
    s.pickSpell("mage", dart);
    s.queueTarget("mage", "0");
    until(s, endTick - 1);
    expect(enemy(s)[effect]).toBe(true);
    until(s, endTick);
    expect(enemy(s)[effect]).toBe(false);
    if (effect === "water") {
      expect(s.events).toContainEqual(
        expect.objectContaining({ type: "enemySwing" }),
      );
    }
  },
);

test("a target that dies loses every running effect", () => {
  const s = mage("airSurge");
  s.queueTarget("mage", "0");
  until(s, 1);
  s.pickSpell("mage", "earthDart");
  s.queueTarget("mage", "0");
  until(s, 10);
  expect(enemy(s).air).toBe(true);
  // A second mage kills it on the same tick the first one's earth dart lands.
  enemy(s).health = 400;
  const save = s.saveOf("mage")!;
  s.addPlayer("second", { ...save, combatSpell: "waterDart" });
  s.queueTarget("second", "0");
  until(s, 11);
  expect(enemy(s)).toMatchObject({
    state: "dead",
    air: false,
    water: false,
    earth: false,
  });
  until(s, 211);
  expect(enemy(s)).toMatchObject({
    state: "idle",
    air: false,
    water: false,
    earth: false,
  });
});

test("a held Skeleton waits to walk home and loses its remaining effects on arrival", () => {
  const s = mage("airSurge", 3);
  s.queueTarget("mage", "0");
  until(s, 1);
  s.pickSpell("mage", "earthDart");
  s.queueTarget("mage", "0");
  until(s, 11);
  expect(enemy(s)).toMatchObject({ x: 2, air: true, earth: true });
  s.removePlayer("mage");
  until(s, 16);
  expect(enemy(s)).toMatchObject({
    x: 2,
    state: "going home",
    air: true,
    earth: true,
  });
  until(s, 19);
  expect(enemy(s)).toMatchObject({
    x: 4,
    state: "idle",
    air: false,
    earth: false,
  });
});

test("a spell affects a docile Tarn Ox without provoking it", () => {
  const s = mage("earthDart", 2, 0.42, "X");
  // Give the ox enough health to survive the dart and show its hold.
  enemy(s).health = 1000;
  s.queueTarget("mage", "0");
  until(s, 6);
  expect(enemy(s)).toMatchObject({ x: 3, earth: true, state: "idle" });
  until(s, 7);
  expect(enemy(s).earth).toBe(false);
});

test("an elite Skeleton can be held after it returns", () => {
  let roll = 0.42;
  const s = mage("airDart", 1, () => roll);
  enemy(s).health = 100;
  s.queueTarget("mage", "0");
  until(s, 1);
  expect(enemy(s).state).toBe("dead");
  s.removePlayer("mage");
  until(s, 200);
  roll = 0;
  until(s, 201);
  expect(enemy(s)).toMatchObject({ state: "idle", elite: true });
  s.addPlayer("second", {
    x: 1,
    y: 1,
    defenseXp: 0,
    herblawXp: 0,
    hitpointsXp: xpForLevel(99),
    health: 9900,
    magicXp: xpForLevel(10),
    weapon: "birchStaff",
    weaponCount: 1,
    inventory: ["airRune", "earthRune", "focusRune"],
    inventoryCounts: [1, 2, 1],
    combatSpell: "earthDart",
  });
  roll = 0.42;
  s.queueTarget("second", "0");
  until(s, 202);
  expect(enemy(s)).toMatchObject({
    state: "fighting",
    elite: true,
    earth: true,
  });
});
