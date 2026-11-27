import { describe, expect, test } from "vitest";
import {
  armourPercentOf,
  baseAvoidanceTenthsOf,
  canBeImproved,
  GEAR,
  gearOf,
  gateOf,
  GEAR_SLOTS,
  gearRefusal,
  STACKING_GEAR_SLOTS,
  wornAccuracyOf,
} from "./gear.ts";
import {
  capeOfGossamer,
  variantAvoidanceOf,
  variantDoes,
  virtueDoes,
  virtueOf,
} from "./virtues.ts";
import { TIERS } from "./region.ts";
import { MAX_XP, xpForLevel } from "./skills.ts";

const attack = (attackXp: number) => ({ attackXp, defenseXp: 0, rangedXp: 0 });
const ranged = (rangedXp: number) => ({ attackXp: 0, defenseXp: 0, rangedXp });
const defense = (defenseXp: number, attackXp = 0) => ({
  attackXp,
  defenseXp,
  rangedXp: 0,
});

test("swords add 100, 150, 200, 250 and 300 by tier", () => {
  expect(GEAR.get("copperSword")?.hitBonus).toBe(100);
  expect(GEAR.get("bronzeSword")?.hitBonus).toBe(150);
  expect(GEAR.get("ironSword")?.hitBonus).toBe(200);
  expect(GEAR.get("steelSword")?.hitBonus).toBe(250);
  expect(GEAR.get("emberiteSword")?.hitBonus).toBe(300);
});

test("each tier's sword is gated at its Attack level", () => {
  expect(gearRefusal("copperSword", attack(0))).toBeUndefined();
  expect(gearRefusal("bronzeSword", attack(xpForLevel(4)))).toBe(
    "You need Attack 5 to equip this.",
  );
  expect(gearRefusal("bronzeSword", attack(xpForLevel(5)))).toBeUndefined();
  expect(gearRefusal("steelSword", attack(xpForLevel(14)))).toBe(
    "You need Attack 15 to equip this.",
  );
  expect(gearRefusal("steelSword", attack(xpForLevel(15)))).toBeUndefined();
  expect(gearRefusal("ironSword", attack(4049))).toBe(
    "You need Attack 10 to equip this.",
  );
  expect(gearRefusal("ironSword", attack(4050))).toBeUndefined();
  expect(gearRefusal("emberiteSword", attack(18049))).toBe(
    "You need Attack 20 to equip this.",
  );
  expect(gearRefusal("emberiteSword", attack(18050))).toBeUndefined();
});

test("shields start at 10%, 15%, 20%, 25% and 30% by tier", () => {
  expect(GEAR.get("copperShield")?.blockChance).toBe(0.1);
  expect(GEAR.get("bronzeShield")?.blockChance).toBe(0.15);
  expect(GEAR.get("ironShield")?.blockChance).toBe(0.2);
  expect(GEAR.get("steelShield")?.blockChance).toBe(0.25);
  expect(GEAR.get("emberiteShield")?.blockChance).toBe(0.3);
});

test("each tier's shield is gated at its Defense level, whatever the Attack level", () => {
  // Attack 20 opens every sword, and still no shield.
  const defenseWithAttack = (defenseXp: number) => defense(defenseXp, 18050);
  expect(gearRefusal("copperShield", defenseWithAttack(0))).toBeUndefined();
  expect(gearRefusal("bronzeShield", defenseWithAttack(xpForLevel(4)))).toBe(
    "You need Defense 5 to equip this.",
  );
  expect(gearRefusal("steelShield", defenseWithAttack(xpForLevel(14)))).toBe(
    "You need Defense 15 to equip this.",
  );
  expect(
    gearRefusal("steelShield", defenseWithAttack(xpForLevel(15))),
  ).toBeUndefined();
  expect(gearRefusal("ironShield", defenseWithAttack(4049))).toBe(
    "You need Defense 10 to equip this.",
  );
  expect(gearRefusal("ironShield", defenseWithAttack(4050))).toBeUndefined();
  expect(gearRefusal("emberiteShield", defenseWithAttack(18049))).toBe(
    "You need Defense 20 to equip this.",
  );
  expect(
    gearRefusal("emberiteShield", defenseWithAttack(18050)),
  ).toBeUndefined();
});

test("a shield goes in the shield slot and says what it does", () => {
  expect(GEAR.get("ironShield")).toMatchObject({
    slot: "shield",
    does: "Starts at a 20% chance to block a hit",
  });
});

test("what isn't gear is never refused", () => {
  expect(gearRefusal("berry", attack(0))).toBeUndefined();
  expect(gearRefusal("", attack(0))).toBeUndefined();
});

test("a sword goes in the weapon slot and says what it does", () => {
  expect(GEAR.get("ironSword")).toMatchObject({
    slot: "weapon",
    does: "Adds 200 to your minimum and maximum hit",
  });
});

test("bows gate on Ranged at 1, 10 and 20 and add 5, 10 and 15 points of Accuracy, with no hit bonus (Ranged spec §2)", () => {
  expect(GEAR.get("birchBow")).toMatchObject({
    slot: "weapon",
    accuracy: 5,
    does: "Adds 5 points to your chance to hit",
  });
  expect(GEAR.get("oakBow")?.accuracy).toBe(10);
  expect(GEAR.get("charwoodBow")?.accuracy).toBe(15);
  for (const bow of ["birchBow", "oakBow", "charwoodBow"])
    expect(GEAR.get(bow)?.hitBonus).toBeUndefined();
  expect(gearRefusal("birchBow", ranged(0))).toBeUndefined();
  expect(gearRefusal("oakBow", ranged(xpForLevel(9)))).toBe(
    "You need Ranged 10 to equip this.",
  );
  expect(gearRefusal("oakBow", ranged(xpForLevel(10)))).toBeUndefined();
  expect(gearRefusal("charwoodBow", ranged(xpForLevel(19)))).toBe(
    "You need Ranged 20 to equip this.",
  );
  expect(gearRefusal("charwoodBow", ranged(xpForLevel(20)))).toBeUndefined();
  // Attack no longer opens a bow, and Ranged doesn't open a sword: the weapon slot gates per item.
  expect(gearRefusal("charwoodBow", attack(MAX_XP))).toBe(
    "You need Ranged 20 to equip this.",
  );
  expect(gearRefusal("emberiteSword", ranged(MAX_XP))).toBe(
    "You need Attack 20 to equip this.",
  );
  expect(gateOf("oakBow")).toEqual({
    skill: "Ranged",
    xp: "rangedXp",
    level: 10,
  });
});

test("arrows go in the ammo slot, gate on Ranged 1, 5, 10, 15 and 20, and add 100 to 300 to a hit (Ranged spec §2)", () => {
  const arrows = [
    ["copperArrow", 1, 100],
    ["bronzeArrow", 5, 150],
    ["ironArrow", 10, 200],
    ["steelArrow", 15, 250],
    ["emberiteArrow", 20, 300],
  ] as const;
  for (const [arrow, level, hitBonus] of arrows) {
    expect(GEAR.get(arrow)).toMatchObject({ slot: "ammo", level, hitBonus });
    expect(gateOf(arrow)).toMatchObject({ skill: "Ranged", level });
    expect(gearRefusal(arrow, ranged(xpForLevel(level)))).toBeUndefined();
  }
  expect(gearRefusal("bronzeArrow", ranged(xpForLevel(4)))).toBe(
    "You need Ranged 5 to equip this.",
  );
  expect(gearRefusal("emberiteArrow", attack(MAX_XP))).toBe(
    "You need Ranged 20 to equip this.",
  );
  expect(GEAR.get("ironArrow")?.does).toBe(
    "Adds 200 to a bow shot's minimum and maximum hit",
  );
});

test("throwing knives go in the weapon slot, gate on Ranged 1, 5, 10, 15 and 20, add 100 to 300 to a hit and no Accuracy, and reach 4 tiles every 6 ticks (#279)", () => {
  const knives = [
    ["copperThrowingKnife", 1, 100],
    ["bronzeThrowingKnife", 5, 150],
    ["ironThrowingKnife", 10, 200],
    ["steelThrowingKnife", 15, 250],
    ["emberiteThrowingKnife", 20, 300],
  ] as const;
  for (const [knife, level, hitBonus] of knives) {
    expect(GEAR.get(knife)).toMatchObject({
      slot: "weapon",
      level,
      hitBonus,
      reachTiles: 4,
      intervalTicks: 6,
    });
    expect(gateOf(knife)).toMatchObject({ skill: "Ranged", level });
    expect(gearRefusal(knife, ranged(xpForLevel(level)))).toBeUndefined();
    expect(wornAccuracyOf({ weapon: knife })).toBe(0);
    expect(canBeImproved(knife)).toBe(false);
  }
  expect(gearRefusal("steelThrowingKnife", ranged(xpForLevel(14)))).toBe(
    "You need Ranged 15 to equip this.",
  );
  expect(gearRefusal("emberiteThrowingKnife", attack(MAX_XP))).toBe(
    "You need Ranged 20 to equip this.",
  );
  expect(GEAR.get("ironThrowingKnife")?.does).toBe(
    "Adds 200 to a throw's minimum and maximum hit",
  );
  // Bows and swords still roll improved.
  expect(canBeImproved("birchBow")).toBe(true);
  expect(canBeImproved("ironSword")).toBe(true);
});

test("the gear set has eleven slots, the ammo slot last, and only the weapon and ammo slots hold a stack (Ranged spec §2)", () => {
  expect(GEAR_SLOTS).toHaveLength(11);
  expect(GEAR_SLOTS.at(-1)).toBe("ammo");
  expect(STACKING_GEAR_SLOTS).toEqual(["weapon", "ammo"]);
});

test("arrows in the ammo slot add nothing to Accuracy or armour", () => {
  expect(wornAccuracyOf({ ammo: "emberiteArrow" })).toBe(0);
  expect(armourPercentOf({ ammo: "emberiteArrow" })).toBe(0);
  expect(wornAccuracyOf({ weapon: "charwoodBow", ring: "copperRing" })).toBe(
    20,
  );
});

test("a bow's Virtue sizes like the metal tier its wood's gate matches (#228)", () => {
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
  expect(gearRefusal("ironSword:uncommon:might", attack(0))).toBe(
    "You need Attack 10 to equip this.",
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

  test("a common cape carries its Virtue on #217's ½-uncommon ladder, uncommon at full and rare at double", () => {
    const worn = (tier: string, quality: string) => ({
      cape: `${tier}MightCape:${quality}:might`,
    });
    // Might: half of 3×tier, rounded down, and always strictly below uncommon.
    expect(virtueOf(worn("copper", "common"), "might")).toBe(1);
    expect(virtueOf(worn("bronze", "common"), "might")).toBe(3);
    expect(virtueOf(worn("iron", "common"), "might")).toBe(4);
    expect(virtueOf(worn("steel", "common"), "might")).toBe(6);
    expect(virtueOf(worn("emberite", "common"), "might")).toBe(7);
    expect(virtueOf(worn("copper", "uncommon"), "might")).toBe(3);
    expect(virtueOf(worn("emberite", "rare"), "might")).toBe(30);
    // Fortitude: exactly half of 20×tier.
    expect(
      virtueOf({ cape: "ironFortitudeCape:common:fortitude" }, "fortitude"),
    ).toBe(30);
    // Avoidance: half of tier tenths, rounded up, so a cape never carries less than 1 tenth.
    expect(
      virtueOf({ cape: "copperAvoidanceCape:common:avoidance" }, "avoidance"),
    ).toBe(1);
    expect(
      virtueOf({ cape: "steelAvoidanceCape:common:avoidance" }, "avoidance"),
    ).toBe(2);
    expect(
      virtueOf({ cape: "emberiteAvoidanceCape:rare:avoidance" }, "avoidance"),
    ).toBe(10);
  });
});

describe("hands and feet (#238)", () => {
  test("the hands take 1–5% and the feet 2–6% off by tier, on the helmet's line (#217)", () => {
    for (const [tier, hands, feet] of [
      ["copper", 1, 2],
      ["bronze", 2, 3],
      ["iron", 3, 4],
      ["steel", 4, 5],
      ["emberite", 5, 6],
    ] as const) {
      expect(GEAR.get(`${tier}Gloves`)).toMatchObject({
        slot: "hands",
        does: `Takes ${hands}% off each hit you take`,
      });
      expect(GEAR.get(`${tier}Boots`)).toMatchObject({
        slot: "feet",
        does: `Takes ${feet}% off each hit you take`,
      });
    }
    expect(
      armourPercentOf({ hands: "emberiteGloves", feet: "emberiteBoots" }),
    ).toBe(11);
  });

  test("each tier's hands and feet are gated at its Defense level", () => {
    expect(gearRefusal("copperGloves", defense(0))).toBeUndefined();
    expect(gearRefusal("bronzeBoots", defense(xpForLevel(4)))).toBe(
      "You need Defense 5 to equip this.",
    );
    expect(gearRefusal("steelGloves", defense(xpForLevel(15)))).toBeUndefined();
    expect(gearRefusal("emberiteBoots", defense(18049))).toBe(
      "You need Defense 20 to equip this.",
    );
  });
});

describe("necks and rings (#238)", () => {
  test("the amulets carry 5/8/10/13/16 tenths of Avoidance by tier", () => {
    for (const [tier, tenths] of [
      ["copper", 5],
      ["bronze", 8],
      ["iron", 10],
      ["steel", 13],
      ["emberite", 16],
    ] as const) {
      expect(GEAR.get(`${tier}Amulet`)).toMatchObject({
        slot: "neck",
        avoidanceTenths: tenths,
        does: `Takes ${tenths / 10} points off an enemy's chance to hit you.`,
      });
    }
  });

  test("the rings carry 5/8/10/13/16 points of Accuracy by tier, which add to the wearer's chance to hit", () => {
    for (const [tier, accuracy] of [
      ["copper", 5],
      ["bronze", 8],
      ["iron", 10],
      ["steel", 13],
      ["emberite", 16],
    ] as const) {
      expect(GEAR.get(`${tier}Ring`)).toMatchObject({
        slot: "ring",
        accuracy,
        does: `Adds ${accuracy} points to your chance to hit`,
      });
    }
    expect(GEAR.get("copperRing")?.hitBonus).toBeUndefined();
  });

  test("each tier's amulet and ring are gated at its Defense level", () => {
    expect(gearRefusal("copperAmulet", defense(0))).toBeUndefined();
    expect(gearRefusal("bronzeRing", defense(xpForLevel(4)))).toBe(
      "You need Defense 5 to equip this.",
    );
    expect(gearRefusal("steelAmulet", defense(xpForLevel(15)))).toBeUndefined();
    expect(gearRefusal("emberiteRing", defense(18049))).toBe(
      "You need Defense 20 to equip this.",
    );
  });
});

describe("starter clothes", () => {
  const worn = { body: "leafTunic", legs: "brownPants", feet: "burlapBoots" };

  test("go on the body, legs and feet with no gate and no bonuses", () => {
    expect(
      Object.values(worn).map((item) => [
        gearOf(item)?.slot,
        gateOf(item)?.level,
      ]),
    ).toEqual([
      ["body", 1],
      ["legs", 1],
      ["feet", 1],
    ]);
    expect(armourPercentOf(worn)).toBe(0);
    expect(baseAvoidanceTenthsOf(worn)).toBe(0);
    expect(wornAccuracyOf(worn)).toBe(0);
  });
});
