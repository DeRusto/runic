import { describe, expect, test } from "vitest";
import { ENEMIES, type EnemyKind } from "./enemies.ts";
import {
  playerStyleOf,
  TRIANGLE_POINTS,
  trianglePointsOf,
  type Style,
} from "./triangle.ts";

describe("a player's style", () => {
  test("is melee with a sword or bare hands", () => {
    expect(playerStyleOf({ weapon: "copperSword" })).toBe("melee");
    expect(playerStyleOf({})).toBe("melee");
    expect(playerStyleOf({ weapon: "" })).toBe("melee");
  });

  test("is ranged with a bow or throwing knives", () => {
    expect(playerStyleOf({ weapon: "birchBow" })).toBe("ranged");
    expect(playerStyleOf({ weapon: "copperThrowingKnife" })).toBe("ranged");
  });

  test("ignores arrows in the ammo slot while a sword is in hand", () => {
    expect(playerStyleOf({ weapon: "copperSword", ammo: "copperArrow" })).toBe(
      "melee",
    );
  });
});

describe("every enemy's style", () => {
  test("is ranged for the Skeleton Mage and melee for every other enemy", () => {
    const kinds = Object.keys(ENEMIES) as EnemyKind[];
    for (const kind of kinds)
      expect(ENEMIES[kind].style).toBe(
        kind === "skeletonMage" ? "ranged" : "melee",
      );
  });
});

describe("the combat triangle", () => {
  test.each<[Style, Style, number]>([
    ["melee", "ranged", TRIANGLE_POINTS],
    ["ranged", "magic", TRIANGLE_POINTS],
    ["magic", "melee", TRIANGLE_POINTS],
    ["ranged", "melee", -TRIANGLE_POINTS],
    ["magic", "ranged", -TRIANGLE_POINTS],
    ["melee", "magic", -TRIANGLE_POINTS],
    ["melee", "melee", 0],
    ["ranged", "ranged", 0],
    ["magic", "magic", 0],
  ])("%s against %s moves the chance to land by %i points", (a, b, points) => {
    expect(trianglePointsOf(a, b)).toBe(points);
  });

  test("is worth 10 points (#271)", () => {
    expect(TRIANGLE_POINTS).toBe(10);
  });
});
