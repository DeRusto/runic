import { describe, expect, test, vi } from "vitest";
import { INVENTORY_SLOTS } from "./index.ts";
import {
  attackRefusal,
  castOf,
  COMBAT_SPELLS,
  combatSpellsInGateOrder,
  isCombatSpell,
  magicAttackRefusal,
  magicHit,
  magicHitOf,
  NO_SPELL_LINE,
  OUT_OF_RUNES_LINE,
  runesLine,
  spellPickRefusal,
  type CombatSpell,
} from "./magic.ts";
import { OUT_OF_ARROWS_LINE } from "./ranged.ts";
import { levelFor, xpForLevel } from "./skills.ts";
import { playerStyleOf, type Style } from "./triangle.ts";

/** Hands out these rolls in order, then fails the test if asked for more. */
const rolls = (...values: number[]) =>
  vi.fn(() => {
    if (!values.length) throw new Error("rolled too often");
    return values.shift()!;
  });

/** A bag holding these stacks first, then empty slots. */
const bag = (...stacks: [string, number][]) => ({
  inventory: [
    ...stacks.map(([item]) => item),
    ...Array<string>(INVENTORY_SLOTS - stacks.length).fill(""),
  ],
  inventoryCounts: [
    ...stacks.map(([, count]) => count),
    ...Array<number>(INVENTORY_SLOTS - stacks.length).fill(0),
  ],
});

/** A fresh mage with a birch staff (+5 Accuracy), air dart picked, and runes for it. */
const mage = {
  magicXp: 0,
  agilityXp: 0,
  weapon: "birchStaff",
  combatSpell: "airDart",
  ...bag(["airRune", 10], ["focusRune", 10]),
};

describe("the combat spells (#318)", () => {
  test("eight spells, in gate order, with the spec's gates, hit bonuses, experience and runes", () => {
    expect(
      combatSpellsInGateOrder().map((spell) => {
        const { gate, hitBonus, baseXp, runes } = COMBAT_SPELLS[spell];
        return [spell, gate, hitBonus, baseXp, runes];
      }),
    ).toEqual([
      ["airDart", 1, 100, 2, { airRune: 1, focusRune: 1 }],
      ["waterDart", 5, 150, 3, { waterRune: 1, airRune: 1, focusRune: 1 }],
      ["earthDart", 10, 200, 4, { earthRune: 2, airRune: 1, focusRune: 1 }],
      ["airSurge", 15, 250, 5, { airRune: 1, furyRune: 1 }],
      ["fireDart", 20, 300, 6, { fireRune: 3, airRune: 2, focusRune: 1 }],
      ["waterSurge", 25, 350, 7, { waterRune: 1, airRune: 1, furyRune: 1 }],
      ["earthSurge", 30, 400, 8, { earthRune: 2, airRune: 1, furyRune: 1 }],
      ["fireSurge", 35, 450, 9, { fireRune: 3, airRune: 2, furyRune: 1 }],
    ]);
  });

  test("names each spell's runes in a line", () => {
    expect(runesLine("fireDart")).toBe("3 fire, 2 air, 1 focus");
  });

  test("only a spell's id is a combat spell", () => {
    expect(isCombatSpell("airDart")).toBe(true);
    expect(isCombatSpell("toString")).toBe(false);
    expect(isCombatSpell(7)).toBe(false);
  });
});

describe("picking a spell", () => {
  test("is refused below the spell's Magic gate, and allowed at it", () => {
    expect(spellPickRefusal({ magicXp: 0 }, "airDart")).toBeUndefined();
    expect(spellPickRefusal({ magicXp: 0 }, "waterDart")).toBe(
      "You need Magic level 5 to cast Water dart.",
    );
    expect(
      spellPickRefusal({ magicXp: xpForLevel(5) }, "waterDart"),
    ).toBeUndefined();
  });
});

describe("a staff in hand (#317)", () => {
  test("fights in the magic style, and a bow and a sword do not", () => {
    expect(playerStyleOf({ weapon: "oakStaff" })).toBe("magic");
    expect(playerStyleOf({ weapon: "birchBow" })).toBe("ranged");
    expect(playerStyleOf({ weapon: "copperSword" })).toBe("melee");
  });

  test("casts from 8 tiles every 10 ticks; anything else does not cast", () => {
    expect(castOf({ weapon: "charwoodStaff" })).toEqual({
      reachTiles: 8,
      intervalTicks: 10,
    });
    expect(castOf({ weapon: "birchBow" })).toBeUndefined();
    expect(castOf({})).toBeUndefined();
  });
});

describe("refusing a cast", () => {
  test("with no spell picked", () => {
    expect(magicAttackRefusal({ ...mage, combatSpell: "" })).toBe(
      NO_SPELL_LINE,
    );
    expect(NO_SPELL_LINE).toBe("Choose a combat spell first.");
  });

  test("without every rune the spell spends", () => {
    expect(magicAttackRefusal(mage)).toBeUndefined();
    expect(magicAttackRefusal({ ...mage, ...bag(["airRune", 10]) })).toBe(
      OUT_OF_RUNES_LINE,
    );
    const earth = { ...mage, combatSpell: "earthDart" };
    expect(
      magicAttackRefusal({
        ...earth,
        ...bag(["earthRune", 1], ["airRune", 1], ["focusRune", 1]),
      }),
    ).toBe(OUT_OF_RUNES_LINE);
    // Runes across two stacks count together.
    expect(
      magicAttackRefusal({
        ...earth,
        ...bag(
          ["earthRune", 1],
          ["airRune", 1],
          ["focusRune", 1],
          ["earthRune", 1],
        ),
      }),
    ).toBeUndefined();
    expect(OUT_OF_RUNES_LINE).toBe("You have run out of runes.");
  });

  test("never for a sword or bow, whatever is picked", () => {
    expect(
      magicAttackRefusal({ ...mage, weapon: "copperSword", combatSpell: "" }),
    ).toBeUndefined();
  });

  test("the attack refusal covers a bow's arrows and a staff's spell", () => {
    expect(attackRefusal({ weapon: "birchBow", ammo: "" })).toBe(
      OUT_OF_ARROWS_LINE,
    );
    expect(attackRefusal({ ...mage, combatSpell: "" })).toBe(NO_SPELL_LINE);
    expect(attackRefusal({ weapon: "copperSword" })).toBeUndefined();
  });
});

describe("magicHit", () => {
  test("lands at 40% plus the staff's Accuracy, from 100 plus the spell's hit bonus", () => {
    // 45% with the birch staff at Magic 1.
    expect(magicHit(mage, "magic", 0, 800, rolls(0.4499, 0, 0.99)).damage).toBe(
      200,
    );
    expect(magicHit(mage, "magic", 0, 800, rolls(0.4501)).damage).toBe(0);
  });

  test("tops out at the Magic max plus the spell's bonus and Might", () => {
    // Magic 20: max 300; earth dart adds 200, a Might potion 50.
    const strong = {
      ...mage,
      magicXp: xpForLevel(20),
      combatSpell: "earthDart",
    };
    expect(levelFor(strong.magicXp)).toBe(20);
    expect(magicHitOf(strong)).toMatchObject({ max: 300, gear: 200 });
    expect(
      magicHit(strong, "magic", 50, 1000, rolls(0, 0.99999, 0.99)).damage,
    ).toBe(550);
  });

  test("can crit for 1.5 times on Agility's chance", () => {
    expect(magicHit(mage, "magic", 0, 800, rolls(0, 0, 0))).toMatchObject({
      damage: 300,
      critical: true,
    });
  });

  test("the triangle moves the chance only: magic beats melee and loses to ranged", () => {
    const cast = (target: Style, roll: number) =>
      magicHit(mage, target, 0, 800, rolls(roll, 0, 0.99)).damage;
    expect(cast("melee", 0.5499)).toBe(200);
    expect(cast("melee", 0.5501)).toBe(0);
    expect(cast("ranged", 0.3499)).toBe(200);
    expect(cast("ranged", 0.3501)).toBe(0);
  });

  test("a miss pays the spell's base experience to Magic only", () => {
    expect(magicHit(mage, "magic", 0, 800, rolls(0.99)).xp).toEqual([
      ["magicXp", 2],
      ["hitpointsXp", 0],
    ]);
  });

  test("a hit pays base plus 6 per 100 damage to Magic, and the damage part to Hitpoints", () => {
    expect(magicHit(mage, "magic", 0, 800, rolls(0, 0, 0.99)).xp).toEqual([
      ["magicXp", 14],
      ["hitpointsXp", 12],
    ]);
  });

  test("overkill pays nothing beyond the health the enemy had", () => {
    const { damage, xp } = magicHit(mage, "magic", 0, 50, rolls(0, 0, 0.99));
    expect(damage).toBe(50);
    expect(xp).toEqual([
      ["magicXp", 5],
      ["hitpointsXp", 3],
    ]);
  });

  test("every spell's bonus reaches the hit", () => {
    for (const spell of Object.keys(COMBAT_SPELLS) as CombatSpell[])
      expect(magicHitOf({ ...mage, combatSpell: spell }).gear).toBe(
        COMBAT_SPELLS[spell].hitBonus,
      );
  });
});
