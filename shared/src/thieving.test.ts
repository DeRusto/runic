import { describe, expect, test } from "vitest";
import { INVENTORY_SLOTS } from "./index.ts";
import { xpForLevel } from "./skills.ts";
import {
  MARKS,
  NO_FAIL_LEVELS_ABOVE,
  PICKPOCKETS,
  thievingFailPercent,
  pickpocketRefusal,
  rollPickpocket,
  thievingXpAt,
} from "./thieving.ts";

/** Rolls from a fixed list, in order, then 0.99s. */
const rolls = (...values: number[]) => {
  let i = 0;
  return () => values[i++] ?? 0.99;
};

const pockets = (
  thievingXp = 0,
  inventory = Array<string>(INVENTORY_SLOTS).fill(""),
) => ({
  thievingXp,
  inventory,
  inventoryCounts: inventory.map((item) => (item ? 1 : 0)),
});

describe("the drunk", () => {
  test("is a level-1 mark outside the inn, with a name of his own", () => {
    expect(MARKS.drunk.name).toBe("Pell");
    expect(PICKPOCKETS.drunk.name).toBe("Pell");
    expect(PICKPOCKETS.drunk.level).toBe(1);
  });
});

describe("thievingXpAt", () => {
  test("pays 8 at level 1, as a level-1 tree does, and more the higher the target", () => {
    expect(thievingXpAt(1)).toBe(8);
    expect(thievingXpAt(20)).toBe(32);
    expect(thievingXpAt(55)).toBe(76);
    expect(PICKPOCKETS.drunk.xp).toBe(thievingXpAt(1));
  });
});

describe("thievingFailPercent", () => {
  test("fails 40% of the time at the level needed, falling to none a set number of levels above it", () => {
    expect(thievingFailPercent(1, 1)).toBe(40);
    expect(thievingFailPercent(1, 11)).toBe(20);
    expect(NO_FAIL_LEVELS_ABOVE).toBe(20);
    expect(thievingFailPercent(1, 20)).toBe(2);
    expect(thievingFailPercent(1, 21)).toBe(0);
    expect(thievingFailPercent(1, 99)).toBe(0);
  });
});

describe("pickpocketRefusal", () => {
  test("lets a new player at the drunk", () => {
    expect(pickpocketRefusal(PICKPOCKETS.drunk, pockets())).toBeUndefined();
  });

  test("refuses a player with no room for the coins", () => {
    const full = Array<string>(INVENTORY_SLOTS).fill("herb");
    expect(pickpocketRefusal(PICKPOCKETS.drunk, pockets(0, full))).toBe(
      "Your inventory is full.",
    );
    const coinsHeld = [...full];
    coinsHeld[3] = "coins";
    expect(
      pickpocketRefusal(PICKPOCKETS.drunk, pockets(0, coinsHeld)),
    ).toBeUndefined();
  });

  test("refuses a player below a target's level, naming both", () => {
    const higher = { ...PICKPOCKETS.drunk, level: 10 };
    expect(pickpocketRefusal(higher, pockets(xpForLevel(9)))).toBe(
      "You need Thieving 10 to pickpocket Pell.",
    );
    expect(pickpocketRefusal(higher, pockets(xpForLevel(10)))).toBeUndefined();
  });
});

describe("rollPickpocket", () => {
  test("a roll under the fail chance is caught, for a small hit", () => {
    expect(rollPickpocket(PICKPOCKETS.drunk, 1, rolls(0.39))).toEqual({
      caught: true,
      damage: 100,
    });
  });

  test("a roll at or over it pays coins from the range, and the experience", () => {
    // Fail roll, coins roll, rare-item roll.
    expect(rollPickpocket(PICKPOCKETS.drunk, 1, rolls(0.4, 0, 0.99))).toEqual({
      caught: false,
      coins: 1,
      items: [],
      xp: 8,
    });
    expect(
      rollPickpocket(PICKPOCKETS.drunk, 1, rolls(0.4, 0.99, 0.99)),
    ).toEqual({
      caught: false,
      coins: 5,
      items: [],
      xp: 8,
    });
  });

  test("now and then the drunk has food on him too", () => {
    expect(
      rollPickpocket(PICKPOCKETS.drunk, 1, rolls(0.4, 0, 0.09)),
    ).toMatchObject({
      caught: false,
      items: ["cookedPerch"],
    });
    expect(
      rollPickpocket(PICKPOCKETS.drunk, 1, rolls(0.4, 0, 0.1)),
    ).toMatchObject({
      items: [],
    });
  });

  test("a player the set number of levels above the target is never caught", () => {
    expect(
      rollPickpocket(PICKPOCKETS.drunk, 21, rolls(0, 0, 0.99)),
    ).toMatchObject({
      caught: false,
    });
  });
});
