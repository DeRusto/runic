import { expect, test } from "vitest";
import { GEMS } from "./items.ts";
import { xpForLevel } from "./skills.ts";
import { STALLS } from "./stalls.ts";
import {
  STRONGBOXES,
  isStrongboxKind,
  strongboxFails,
  strongboxLoot,
  strongboxName,
  strongboxRefusal,
} from "./strongboxes.ts";
import { PICKPOCKETS } from "./thieving.ts";

const RUNES = ["airRune", "waterRune", "earthRune", "fireRune"];

test("the Boneyard strongbox needs Thieving 40, and the Runestone Hollow strongbox 55", () => {
  expect(STRONGBOXES.boneyard.level).toBe(40);
  expect(STRONGBOXES.hollow.level).toBe(55);
});

test("each strongbox is named for where it stands", () => {
  expect(strongboxName("boneyard")).toBe("the Boneyard strongbox");
  expect(strongboxName("hollow")).toBe("the Runestone Hollow strongbox");
});

test("a strongbox is refused a level below its requirement, and allowed at it", () => {
  expect(strongboxRefusal("boneyard", xpForLevel(39))).toBe(
    "You need Thieving 40 to open the Boneyard strongbox.",
  );
  expect(strongboxRefusal("boneyard", xpForLevel(40))).toBeUndefined();
  expect(strongboxRefusal("hollow", xpForLevel(54))).toBe(
    "You need Thieving 55 to open the Runestone Hollow strongbox.",
  );
  expect(strongboxRefusal("hollow", xpForLevel(55))).toBeUndefined();
});

test("a strongbox fails on the same curve as a pickpocket: half the time at its level, never 20 above", () => {
  expect(strongboxFails("boneyard", xpForLevel(40), () => 0.49)).toBe(true);
  expect(strongboxFails("boneyard", xpForLevel(40), () => 0.5)).toBe(false);
  expect(strongboxFails("hollow", xpForLevel(75), () => 0)).toBe(false);
});

test("opening a strongbox gives coins, a gem and runes, every time", () => {
  for (const kind of ["boneyard", "hollow"] as const)
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      const [coins, gem, runes] = strongboxLoot(kind, () => roll);
      const box = STRONGBOXES[kind];
      expect(coins!.item).toBe("coins");
      expect(coins!.count).toBeGreaterThanOrEqual(box.coins.fewest);
      expect(coins!.count).toBeLessThanOrEqual(box.coins.most);
      expect(GEMS).toContain(gem!.item);
      expect(RUNES).toContain(runes!.item);
      expect(runes!.count).toBeGreaterThanOrEqual(1);
    }
});

test("each strongbox's gem and rune rolls pick by weight: a low roll takes the first row, a high one the last", () => {
  const [, lowGem, lowRunes] = strongboxLoot("boneyard", () => 0);
  expect(lowGem!.item).toBe(STRONGBOXES.boneyard.gems[0].item);
  expect(lowRunes!.item).toBe(STRONGBOXES.boneyard.runes[0].item);
  const [, highGem, highRunes] = strongboxLoot("hollow", () => 0.99);
  expect(highGem!.item).toBe(STRONGBOXES.hollow.gems.at(-1)!.item);
  expect(highRunes!.item).toBe(STRONGBOXES.hollow.runes.at(-1)!.item);
});

test("only the two strongbox kinds are strongboxes, whatever string comes off the network", () => {
  expect(isStrongboxKind("hollow")).toBe(true);
  expect(isStrongboxKind("toString")).toBe(false);
  expect(isStrongboxKind("gem")).toBe(false);
});

test("a strongbox's trap hits harder than any failed pickpocket", () => {
  const hardestPickpocket = Math.max(
    ...Object.values(PICKPOCKETS).map(({ failHit }) => failHit),
  );
  for (const { trapHit } of Object.values(STRONGBOXES))
    expect(trapHit).toBeGreaterThan(hardestPickpocket);
});

test("a strongbox stays empty far longer than any stall", () => {
  const longestStall = Math.max(
    ...Object.values(STALLS).map(({ emptyTicks }) => emptyTicks),
  );
  for (const { emptyTicks } of Object.values(STRONGBOXES))
    expect(emptyTicks).toBeGreaterThan(longestStall * 10);
});
