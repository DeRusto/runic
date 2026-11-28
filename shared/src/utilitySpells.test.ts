import { describe, expect, test } from "vitest";
import { EMPTY_SLOT, INVENTORY_SLOTS } from "./index.ts";
import { parseRegion } from "./region.ts";
import { xpForLevel } from "./skills.ts";
import {
  coinTurnPrice,
  coinTurnRefusal,
  hollowTeleportTile,
  isUtilitySpell,
  UTILITY_SPELLS,
  utilityRunesLine,
  utilitySpellRefusal,
  utilitySpellsInGateOrder,
  villageTeleportTile,
} from "./utilitySpells.ts";

/** A bag holding these stacks first, then empty slots. */
const bag = (...stacks: [string, number][]) => ({
  inventory: [
    ...stacks.map(([item]) => item),
    ...Array<string>(INVENTORY_SLOTS - stacks.length).fill(EMPTY_SLOT),
  ],
  inventoryCounts: [
    ...stacks.map(([, count]) => count),
    ...Array<number>(INVENTORY_SLOTS - stacks.length).fill(0),
  ],
});

/** A caster at Magic `level` holding `stacks`, with Hollis's quest done if `hollisDone`. */
const caster = (
  level: number,
  stacks: [string, number][],
  hollisDone = false,
) => ({
  magicXp: xpForLevel(level),
  ...bag(...stacks),
  quests: hollisDone ? ["hollisRunes"] : [],
  questStages: hollisDone ? ["done"] : [],
});

const TELEPORT_RUNES: [string, number][] = [
  ["airRune", 3],
  ["furyRune", 1],
  ["earthRune", 3],
];

describe("the utility spells", () => {
  test("open with Village teleport, Coin-turn and Hollow teleport, in gate order, with #319's gates, runes and experience", () => {
    expect(utilitySpellsInGateOrder()).toEqual([
      "villageTeleport",
      "coinTurn",
      "hollowTeleport",
    ]);
    expect(UTILITY_SPELLS.villageTeleport).toMatchObject({
      name: "Village teleport",
      gate: 12,
      xp: 15,
      runes: { airRune: 3, furyRune: 1 },
    });
    expect(UTILITY_SPELLS.coinTurn).toMatchObject({
      name: "Coin-turn",
      gate: 20,
      xp: 10,
      runes: { fireRune: 3, focusRune: 1 },
    });
    expect(UTILITY_SPELLS.hollowTeleport).toMatchObject({
      name: "Hollow teleport",
      gate: 28,
      xp: 25,
      runes: { earthRune: 3, airRune: 1, furyRune: 1 },
    });
  });

  test("a spell's runes read as the Spellbook tab shows them", () => {
    expect(utilityRunesLine("hollowTeleport")).toBe("3 earth, 1 air, 1 fury");
  });

  test("only a utility spell's id off the network counts as one", () => {
    expect(isUtilitySpell("coinTurn")).toBe(true);
    expect(isUtilitySpell("airDart")).toBe(false);
    expect(isUtilitySpell("toString")).toBe(false);
    expect(isUtilitySpell(12)).toBe(false);
  });
});

describe("utilitySpellRefusal", () => {
  test("refuses a caster below the spell's Magic gate, naming the gate", () => {
    expect(
      utilitySpellRefusal(caster(11, TELEPORT_RUNES), "villageTeleport"),
    ).toBe("You need Magic level 12 to cast Village teleport.");
  });

  test("refuses a caster without the spell's runes, naming the spell", () => {
    expect(
      utilitySpellRefusal(caster(12, [["airRune", 3]]), "villageTeleport"),
    ).toBe("You don't have the runes to cast Village teleport.");
  });

  test("lets a caster with the level and runes cast", () => {
    expect(
      utilitySpellRefusal(caster(12, TELEPORT_RUNES), "villageTeleport"),
    ).toBeUndefined();
  });

  test("refuses Hollow teleport until Hollis's quest is done", () => {
    expect(
      utilitySpellRefusal(caster(28, TELEPORT_RUNES), "hollowTeleport"),
    ).toBe("You must finish Hollis's quest to cast Hollow teleport.");
    expect(
      utilitySpellRefusal(caster(28, TELEPORT_RUNES, true), "hollowTeleport"),
    ).toBeUndefined();
  });

  test("refuses a teleport while the combat lock runs, in the style of the logout refusal", () => {
    const line = "You can't teleport until 10 seconds after a fight.";
    expect(
      utilitySpellRefusal(caster(12, TELEPORT_RUNES), "villageTeleport", true),
    ).toBe(line);
    expect(
      utilitySpellRefusal(
        caster(28, TELEPORT_RUNES, true),
        "hollowTeleport",
        true,
      ),
    ).toBe(line);
  });

  test("lets Coin-turn cast during the combat lock, since it is no escape", () => {
    expect(
      utilitySpellRefusal(
        caster(20, [
          ["fireRune", 3],
          ["focusRune", 1],
        ]),
        "coinTurn",
        true,
      ),
    ).toBeUndefined();
  });
});

describe("Coin-turn", () => {
  const RUNES: [string, number][] = [
    ["fireRune", 3],
    ["focusRune", 1],
  ];

  test("pays the general store's buy price for one item", () => {
    // A birch log is worth 3, and the store pays 40% of value, never under 1.
    expect(coinTurnPrice("birchLog")).toBe(1);
    expect(coinTurnPrice("ironOre")).toBe(3);
  });

  test("turns an item the store buys", () => {
    expect(
      coinTurnRefusal(caster(20, [...RUNES, ["birchLog", 1]]), 2),
    ).toBeUndefined();
  });

  test("refuses coins, which the store doesn't buy", () => {
    expect(coinTurnRefusal(caster(20, [...RUNES, ["coins", 50]]), 2)).toBe(
      "The store doesn't buy coins.",
    );
  });

  test.each([
    "copperEssence",
    "ironEssence",
    "emberiteEssence",
    "hollowEssence",
    "boneSigil",
  ])("refuses the quest item %s", (item) => {
    expect(coinTurnRefusal(caster(20, [...RUNES, [item, 1]]), 2)).toBe(
      "Coin-turn can't turn a quest item.",
    );
  });

  test("refuses below Magic 20 and without its runes before reading the item", () => {
    expect(coinTurnRefusal(caster(19, [...RUNES, ["coins", 5]]), 2)).toBe(
      "You need Magic level 20 to cast Coin-turn.",
    );
    expect(coinTurnRefusal(caster(20, [["birchLog", 1]]), 0)).toBe(
      "You don't have the runes to cast Coin-turn.",
    );
  });

  test("counts the turned item against the runes, so the last fire rune can't pay for its own turn", () => {
    expect(coinTurnRefusal(caster(20, RUNES), 0)).toBe(
      "You don't have the runes to cast Coin-turn.",
    );
    expect(
      coinTurnRefusal(
        caster(20, [
          ["fireRune", 4],
          ["focusRune", 1],
        ]),
        0,
      ),
    ).toBeUndefined();
  });

  test("refuses when a full bag has no room for the coins", () => {
    const full = caster(20, [
      ...RUNES.map(([rune]): [string, number] => [rune, 5]),
      ...Array.from({ length: INVENTORY_SLOTS - 2 }, (): [string, number] => [
        "birchLog",
        1,
      ]),
    ]);
    // Turning a single log frees its slot for the coins.
    expect(coinTurnRefusal(full, 2)).toBeUndefined();
    // Turning one of a stack of runes leaves no slot for them.
    expect(coinTurnRefusal(full, 0)).toBe("You don't have room for the coins.");
  });

  test("an empty slot asks for nothing to turn", () => {
    expect(coinTurnRefusal(caster(20, RUNES), 5)).toBe(
      "Choose an item to turn into coins.",
    );
  });
});

describe("the teleports' landing tiles", () => {
  const tiles = parseRegion(
    ["TTTTTT", "TR...T", "T..L.T", "TTTTTT"].join("\n"),
  );

  test("Village teleport lands on the respawn tile in the village square", () => {
    expect(villageTeleportTile(tiles)).toEqual({ x: 1, y: 1 });
  });

  test("Hollow teleport lands beside Hollis, on the gap's side", () => {
    expect(hollowTeleportTile(tiles)).toEqual({ x: 2, y: 2 });
  });
});
