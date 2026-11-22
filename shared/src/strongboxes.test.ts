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

test.each([
  ["boneyard", 0, { coins: 25, gem: "ashstone", rune: "airRune", runes: 2 }],
  [
    "boneyard",
    0.99,
    { coins: 60, gem: "heartflame", rune: "fireRune", runes: 5 },
  ],
  ["hollow", 0, { coins: 50, gem: "ashstone", rune: "airRune", runes: 4 }],
  [
    "hollow",
    0.99,
    { coins: 120, gem: "heartflame", rune: "fireRune", runes: 10 },
  ],
] as const)(
  "the %s strongbox rolling %d pays its fewest or most coins, and its first or last gem and rune by weight",
  (kind, roll, { coins, gem, rune, runes }) => {
    expect(strongboxLoot(kind, () => roll)).toEqual([
      { item: "coins", count: coins },
      { item: gem, count: 1 },
      { item: rune, count: runes },
    ]);
  },
);

test("the Hollow strongbox weights cinderglass most, where the Boneyard's weights ashstone most", () => {
  // Boneyard ashstone 6 of 10, cinderglass 3, heartflame 1; Hollow ashstone 2, cinderglass 5, heartflame 3.
  expect(strongboxLoot("boneyard", () => 0.59)[1]!.item).toBe("ashstone");
  expect(strongboxLoot("boneyard", () => 0.6)[1]!.item).toBe("cinderglass");
  expect(strongboxLoot("boneyard", () => 0.9)[1]!.item).toBe("heartflame");
  expect(strongboxLoot("hollow", () => 0.19)[1]!.item).toBe("ashstone");
  expect(strongboxLoot("hollow", () => 0.2)[1]!.item).toBe("cinderglass");
  expect(strongboxLoot("hollow", () => 0.7)[1]!.item).toBe("heartflame");
});

test("only the two strongbox kinds are strongboxes, whatever string comes off the network", () => {
  expect(isStrongboxKind("hollow")).toBe(true);
  expect(isStrongboxKind("toString")).toBe(false);
  expect(isStrongboxKind("gem")).toBe(false);
});

test("a strongbox's trap hits at least twice as hard as any failed pickpocket", () => {
  const hardestPickpocket = Math.max(
    ...Object.values(PICKPOCKETS).map(({ failHit }) => failHit),
  );
  for (const { trapHit } of Object.values(STRONGBOXES))
    expect(trapHit).toBeGreaterThanOrEqual(hardestPickpocket * 2);
});

test("a strongbox stays empty far longer than any stall", () => {
  const longestStall = Math.max(
    ...Object.values(STALLS).map(({ emptyTicks }) => emptyTicks),
  );
  for (const { emptyTicks } of Object.values(STRONGBOXES))
    expect(emptyTicks).toBeGreaterThan(longestStall * 10);
});
