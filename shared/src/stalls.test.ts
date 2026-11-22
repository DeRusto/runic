import { expect, test } from "vitest";
import { xpForLevel } from "./skills.ts";
import {
  STALLS,
  STALL_LOCKOUT_TICKS,
  isStallKind,
  stallFails,
  stallLoot,
  stallRefusal,
} from "./stalls.ts";

test("Marta's three stalls need Thieving 5, 15 and 25", () => {
  expect(STALLS.food.level).toBe(5);
  expect(STALLS.fish.level).toBe(15);
  expect(STALLS.gem.level).toBe(25);
});

test("a stall is refused a level below its requirement, and allowed at it", () => {
  expect(stallRefusal("food", xpForLevel(4))).toBe(
    "You need Thieving 5 to steal from the food stall.",
  );
  expect(stallRefusal("food", xpForLevel(5))).toBeUndefined();
  expect(stallRefusal("gem", xpForLevel(24))).toBe(
    "You need Thieving 25 to steal from the gem stall.",
  );
  expect(stallRefusal("gem", xpForLevel(25))).toBeUndefined();
});

test("a stall fails on the same curve as a pickpocket: half the time at its level, never 20 above", () => {
  expect(stallFails("fish", xpForLevel(15), () => 0.49)).toBe(true);
  expect(stallFails("fish", xpForLevel(15), () => 0.5)).toBe(false);
  expect(stallFails("fish", xpForLevel(35), () => 0)).toBe(false);
});

test("a theft takes items, never coins", () => {
  for (const kind of ["food", "fish", "gem"] as const)
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      const loot = stallLoot(kind, () => roll);
      expect(loot.count).toBeGreaterThanOrEqual(1);
      expect(loot.item).not.toBe("coins");
      expect(STALLS[kind].loot.map(({ item }) => item)).toContain(loot.item);
    }
});

test("each stall's loot table picks by weight: a low roll takes the first row, a high one the last", () => {
  expect(stallLoot("food", () => 0).item).toBe("berry");
  expect(stallLoot("food", () => 0.99).item).toBe("cookedPerch");
  expect(stallLoot("fish", () => 0).item).toBe("perch");
  expect(stallLoot("fish", () => 0.99).item).toBe("pike");
  expect(stallLoot("gem", () => 0).item).toBe("ashstone");
  expect(stallLoot("gem", () => 0.99).item).toBe("heartflame");
});

test("only the three stall kinds are stalls, whatever string comes off the network", () => {
  expect(isStallKind("fish")).toBe(true);
  expect(isStallKind("toString")).toBe(false);
  expect(isStallKind("coins")).toBe(false);
});

test("a stall stays empty for a while after a theft, and a failure locks it out for longer", () => {
  for (const { emptyTicks } of Object.values(STALLS)) {
    expect(emptyTicks).toBeGreaterThan(0);
    expect(STALL_LOCKOUT_TICKS).toBeGreaterThan(emptyTicks);
  }
});
