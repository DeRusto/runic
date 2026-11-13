import { describe, expect, test } from "vitest";
import {
  armourPercentOf,
  capeOfGossamer,
  GEAR,
  gearOf,
  gearRefusal,
  variantAvoidanceOf,
  variantDoes,
  virtueDoes,
  virtueOf,
} from "./gear.ts";
import { TIERS } from "./region.ts";
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

test("the bows are the first weapons without a blade, and mirror the sword ladder's hit bonuses (#228)", () => {
  expect(GEAR.get("birchBow")?.hitBonus).toBe(100);
  expect(GEAR.get("oakBow")?.hitBonus).toBe(200);
  expect(GEAR.get("charwoodBow")?.hitBonus).toBe(300);
  expect(GEAR.get("birchBow")).toMatchObject({
    slot: "weapon",
    does: "Adds 100 to your minimum and maximum hit",
  });
  // The gate is Combat for now, at the levels their woods' gates sit at: Phase 8 re-gates on Ranged and tunes.
  expect(gearRefusal("birchBow", combat(0))).toBeUndefined();
  expect(gearRefusal("oakBow", combat(4049))).toBe(
    "You need Combat 10 to equip this.",
  );
  expect(gearRefusal("oakBow", combat(4050))).toBeUndefined();
  expect(gearRefusal("charwoodBow", combat(18049))).toBe(
    "You need Combat 20 to equip this.",
  );
  expect(gearRefusal("charwoodBow", combat(18050))).toBeUndefined();
});

test("a bow's Virtue sizes like the metal tier its Combat gate matches (#228)", () => {
  expect(virtueOf({ weapon: "birchBow:uncommon:fortitude" }, "fortitude")).toBe(
    20,
  );
  expect(virtueOf({ weapon: "oakBow:uncommon:might" }, "might")).toBe(9);
  expect(virtueOf({ weapon: "charwoodBow:rare:avoidance" }, "avoidance")).toBe(
    10,
  );
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

test.each([
  ["fortitude", [20, 40, 60, 80, 100]],
  ["might", [3, 6, 9, 12, 15]],
  ["avoidance", [1, 2, 3, 4, 5]],
] as const)(
  "%s is its unit × the tier on an uncommon piece, doubled on a rare",
  (virtue, sizes) => {
    TIERS.forEach((tier, i) => {
      for (const piece of ["Sword", "Shield", "Helmet", "Chestplate"]) {
        const worn = (quality: string) => ({
          body: `${tier}${piece}:${quality}:${virtue}`,
        });
        expect(virtueOf(worn("uncommon"), virtue)).toBe(sizes[i]!);
        expect(virtueOf(worn("rare"), virtue)).toBe(2 * sizes[i]!);
      }
    });
  },
);

test("worn Virtues add up, and only the asked-for one counts", () => {
  const worn = {
    weapon: "ironSword:uncommon:fortitude",
    head: "copperHelmet:rare:fortitude",
    body: "emberiteChestplate:rare:might",
    legs: "steelLeggings",
  };
  expect(virtueOf(worn, "fortitude")).toBe(100);
  expect(virtueOf(worn, "might")).toBe(30);
  expect(virtueOf(worn, "avoidance")).toBe(0);
  expect(virtueOf({}, "fortitude")).toBe(0);
});

test("the Gear tab line gives the Virtue at its size, and nothing for a common piece", () => {
  expect(virtueDoes("copperChestplate:uncommon:fortitude")).toBe(
    "Adds 20 to your max health.",
  );
  expect(virtueDoes("emberiteSword:rare:might")).toBe(
    "Adds 30 to your minimum and maximum hit.",
  );
  expect(virtueDoes("ironHelmet:rare:avoidance")).toBe(
    "Takes 0.6 points off an enemy's chance to hit you.",
  );
  expect(virtueDoes("ironHelmet")).toBeUndefined();
  expect(virtueDoes("")).toBeUndefined();
});

describe("capes (#217)", () => {
  const defense = (defenseXp: number) => ({ combatXp: 0, defenseXp });

  test("a cape is small armour on the hands' line, in the cape slot, gated at its Defense level", () => {
    expect(GEAR.get("copperMightCape")).toMatchObject({
      slot: "cape",
      level: 1,
      does: "Takes 1% off each hit you take",
    });
    expect(GEAR.get("emberiteFortitudeCape")).toMatchObject({
      slot: "cape",
      level: 20,
      does: "Takes 5% off each hit you take",
    });
    expect(gearRefusal("bronzeAvoidanceCape", defense(xpForLevel(4)))).toBe(
      "You need Defense 5 to equip this.",
    );
    expect(
      gearRefusal("bronzeAvoidanceCape", defense(xpForLevel(5))),
    ).toBeUndefined();
  });

  test("a gossamer cloak is its cape's gear", () => {
    expect(gearOf("copperMightCape:uncommon:fortitude:gossamer")).toBe(
      GEAR.get("copperMightCape"),
    );
    expect(capeOfGossamer("copperMightCape:gossamer")).toBe("copperMightCape");
    expect(capeOfGossamer("copperMightCape")).toBeUndefined();
    expect(variantAvoidanceOf({ cape: "steelFortitudeCape:gossamer" })).toBe(2);
    expect(variantAvoidanceOf({ cape: "steelFortitudeCape" })).toBe(0);
  });

  test("the cloak's bonus reads as the Avoidance Virtue's wording, and a plain cape says nothing", () => {
    expect(variantDoes("copperMightCape:uncommon:fortitude:gossamer")).toBe(
      "Takes 0.2 points off an enemy's chance to hit you.",
    );
    expect(variantDoes("copperMightCape")).toBeUndefined();
  });
});
