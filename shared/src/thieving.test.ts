import { expect, test } from "vitest";
import { xpForLevel } from "./skills.ts";
import {
  FAIL_PERCENT_AT_REQUIREMENT,
  MARKS,
  PICKPOCKETS,
  SURE_HANDED_LEVELS,
  failPercent,
  pickpocketFails,
  pickpocketLoot,
  pickpocketRefusal,
} from "./thieving.ts";

test("a pickpocket fails half the time at the target's level", () => {
  expect(FAIL_PERCENT_AT_REQUIREMENT).toBe(50);
  expect(failPercent(1, 1)).toBe(50);
});

test("the chance to fail falls with each level above the requirement", () => {
  expect(failPercent(11, 1)).toBe(25);
  expect(failPercent(6, 1)).toBeLessThan(failPercent(5, 1));
});

test("no pickpocket fails a set number of levels above the requirement", () => {
  expect(SURE_HANDED_LEVELS).toBe(20);
  expect(failPercent(21, 1)).toBe(0);
  expect(failPercent(99, 1)).toBe(0);
});

test("a roll under the failure chance fails, and one at or over it succeeds", () => {
  expect(pickpocketFails("drunk", 0, () => 0.49)).toBe(true);
  expect(pickpocketFails("drunk", 0, () => 0.5)).toBe(false);
  expect(pickpocketFails("drunk", xpForLevel(21), () => 0)).toBe(false);
});

test("the drunk is a level 1 mark outside the inn's door", () => {
  expect(MARKS.drunk.name).toBe("Drunk");
  expect(PICKPOCKETS.drunk.level).toBe(1);
});

test("the drunk's pocket holds coins, and now and then food", () => {
  const { coins, rare } = PICKPOCKETS.drunk;
  expect(pickpocketLoot("drunk", () => 0.99)).toEqual({
    item: "coins",
    count: coins.most,
  });
  expect(pickpocketLoot("drunk", () => 0.5).item).toBe("coins");
  expect(pickpocketLoot("drunk", () => 0)).toEqual({
    item: rare.item,
    count: 1,
  });
});

test("coins come in every amount from the fewest to the most", () => {
  const { coins, rare } = PICKPOCKETS.drunk;
  const rareShare = rare.chancePercent / 100;
  // The first roll skips the rare item; the second picks the amount.
  const amountAt = (fraction: number) => {
    const rolls = [rareShare, fraction];
    return pickpocketLoot("drunk", () => rolls.shift()!).count;
  };
  expect(amountAt(0)).toBe(coins.fewest);
  expect(amountAt(0.999)).toBe(coins.most);
});

test("a player below the target's level is refused, with the level they need", () => {
  const target = { ...PICKPOCKETS.drunk, level: 10 };
  expect(pickpocketRefusal(target, 0)).toBe(
    "You need Thieving 10 to pickpocket the drunk.",
  );
  expect(pickpocketRefusal(target, xpForLevel(10))).toBe(undefined);
});
