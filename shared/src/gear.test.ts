import { expect, test } from "vitest";
import { GEAR, gearRefusal } from "./gear.ts";

const combat = (combatXp: number) => ({ combatXp, defenseXp: 0 });

test("swords add 1, 2 and 3 by tier", () => {
  expect(GEAR.get("copperSword")?.hitBonus).toBe(1);
  expect(GEAR.get("ironSword")?.hitBonus).toBe(2);
  expect(GEAR.get("emberiteSword")?.hitBonus).toBe(3);
});

test("each tier's sword is gated at its Combat level", () => {
  expect(gearRefusal("copperSword", combat(0))).toBeUndefined();
  expect(gearRefusal("ironSword", combat(4049))).toBe(
    "You need Combat 10 to equip this.",
  );
  expect(gearRefusal("ironSword", combat(4050))).toBeUndefined();
  expect(gearRefusal("emberiteSword", combat(18049))).toBe(
    "You need Combat 20 to equip this.",
  );
  expect(gearRefusal("emberiteSword", combat(18050))).toBeUndefined();
});

test("shields start at 10%, 20% and 30% by tier", () => {
  expect(GEAR.get("copperShield")?.blockChance).toBe(0.1);
  expect(GEAR.get("ironShield")?.blockChance).toBe(0.2);
  expect(GEAR.get("emberiteShield")?.blockChance).toBe(0.3);
});

test("each tier's shield is gated at its Defense level, whatever the Combat level", () => {
  const defense = (defenseXp: number) => ({ combatXp: 18050, defenseXp });
  expect(gearRefusal("copperShield", defense(0))).toBeUndefined();
  expect(gearRefusal("ironShield", defense(4049))).toBe(
    "You need Defense 10 to equip this.",
  );
  expect(gearRefusal("ironShield", defense(4050))).toBeUndefined();
  expect(gearRefusal("emberiteShield", defense(18049))).toBe(
    "You need Defense 20 to equip this.",
  );
  expect(gearRefusal("emberiteShield", defense(18050))).toBeUndefined();
});

test("a shield goes in the shield slot and says what it does", () => {
  expect(GEAR.get("ironShield")).toMatchObject({
    slot: "shield",
    does: "Starts at a 20% chance to block a hit",
  });
});

test("what isn't gear is never refused", () => {
  expect(gearRefusal("berry", combat(0))).toBeUndefined();
  expect(gearRefusal("", combat(0))).toBeUndefined();
});

test("a sword goes in the weapon slot and says what it does", () => {
  expect(GEAR.get("ironSword")).toMatchObject({
    slot: "weapon",
    does: "Adds 2 to your minimum and maximum hit",
  });
});
