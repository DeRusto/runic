import { expect, test } from "vitest";
import { armourPercentOf, GEAR, gearOf, gearRefusal } from "./gear.ts";
import { xpForLevel } from "./skills.ts";

const combat = (combatXp: number) => ({ combatXp, defenseXp: 0 });

test("swords add 100, 150, 200, 250 and 300 by tier", () => {
  expect(GEAR.get("copperSword")?.hitBonus).toBe(100);
  expect(GEAR.get("bronzeSword")?.hitBonus).toBe(150);
  expect(GEAR.get("ironSword")?.hitBonus).toBe(200);
  expect(GEAR.get("steelSword")?.hitBonus).toBe(250);
  expect(GEAR.get("emberiteSword")?.hitBonus).toBe(300);
});

test("each tier's sword is gated at its Combat level", () => {
  expect(gearRefusal("copperSword", combat(0))).toBeUndefined();
  expect(gearRefusal("bronzeSword", combat(xpForLevel(4)))).toBe(
    "You need Combat 5 to equip this.",
  );
  expect(gearRefusal("bronzeSword", combat(xpForLevel(5)))).toBeUndefined();
  expect(gearRefusal("steelSword", combat(xpForLevel(14)))).toBe(
    "You need Combat 15 to equip this.",
  );
  expect(gearRefusal("steelSword", combat(xpForLevel(15)))).toBeUndefined();
  expect(gearRefusal("ironSword", combat(4049))).toBe(
    "You need Combat 10 to equip this.",
  );
  expect(gearRefusal("ironSword", combat(4050))).toBeUndefined();
  expect(gearRefusal("emberiteSword", combat(18049))).toBe(
    "You need Combat 20 to equip this.",
  );
  expect(gearRefusal("emberiteSword", combat(18050))).toBeUndefined();
});

test("shields start at 10%, 15%, 20%, 25% and 30% by tier", () => {
  expect(GEAR.get("copperShield")?.blockChance).toBe(0.1);
  expect(GEAR.get("bronzeShield")?.blockChance).toBe(0.15);
  expect(GEAR.get("ironShield")?.blockChance).toBe(0.2);
  expect(GEAR.get("steelShield")?.blockChance).toBe(0.25);
  expect(GEAR.get("emberiteShield")?.blockChance).toBe(0.3);
});

test("each tier's shield is gated at its Defense level, whatever the Combat level", () => {
  const defense = (defenseXp: number) => ({ combatXp: 18050, defenseXp });
  expect(gearRefusal("copperShield", defense(0))).toBeUndefined();
  expect(gearRefusal("bronzeShield", defense(xpForLevel(4)))).toBe(
    "You need Defense 5 to equip this.",
  );
  expect(gearRefusal("steelShield", defense(xpForLevel(14)))).toBe(
    "You need Defense 15 to equip this.",
  );
  expect(gearRefusal("steelShield", defense(xpForLevel(15)))).toBeUndefined();
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
    does: "Adds 200 to your minimum and maximum hit",
  });
});

test("armour takes 2/4/2% up to 6/12/6% by tier, for 8%, 12%, 16%, 20% and 24% a set", () => {
  const set = (tier: string) => ({
    head: `${tier}Helmet`,
    body: `${tier}Chestplate`,
    legs: `${tier}Leggings`,
  });
  expect(armourPercentOf(set("copper"))).toBe(8);
  expect(armourPercentOf(set("bronze"))).toBe(12);
  expect(armourPercentOf(set("iron"))).toBe(16);
  expect(armourPercentOf(set("steel"))).toBe(20);
  expect(armourPercentOf(set("emberite"))).toBe(24);
  expect(GEAR.get("ironChestplate")).toMatchObject({
    slot: "body",
    level: 10,
    does: "Takes 8% off each hit you take",
  });
});

test("each tier's armour is gated at its Defense level", () => {
  const defense = (defenseXp: number) => ({ combatXp: 0, defenseXp });
  expect(gearRefusal("copperHelmet", defense(0))).toBeUndefined();
  expect(gearRefusal("bronzeHelmet", defense(xpForLevel(4)))).toBe(
    "You need Defense 5 to equip this.",
  );
  expect(gearRefusal("steelLeggings", defense(xpForLevel(14)))).toBe(
    "You need Defense 15 to equip this.",
  );
  expect(
    gearRefusal("steelChestplate", defense(xpForLevel(15))),
  ).toBeUndefined();
  expect(gearRefusal("ironLeggings", defense(4049))).toBe(
    "You need Defense 10 to equip this.",
  );
  expect(gearRefusal("emberiteChestplate", defense(18049))).toBe(
    "You need Defense 20 to equip this.",
  );
  expect(gearRefusal("emberiteChestplate", defense(18050))).toBeUndefined();
});

test("an improved piece has its common form's base stats and gate", () => {
  expect(gearOf("copperChestplate:rare:fortitude")).toBe(
    GEAR.get("copperChestplate"),
  );
  expect(gearRefusal("ironSword:uncommon:might", combat(0))).toBe(
    "You need Combat 10 to equip this.",
  );
  expect(
    armourPercentOf({
      head: "copperHelmet:uncommon:avoidance",
      body: "copperChestplate",
    }),
  ).toBe(6);
});
