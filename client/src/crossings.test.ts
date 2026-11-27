import { OBSTACLES, TICK_MS, xpForLevel } from "@runic/shared";
import { describe, expect, test } from "vitest";
import { crossingShown } from "./crossings.ts";

const grass = { ground: "grass", blocks: false } as const;
const at = { x: 4, y: 4 };

describe("crossingShown", () => {
  test("heads for the landing on a course obstacle, which never fails", () => {
    expect(crossingShown({ ...grass, obstacle: "balanceBeam" }, at, 0)).toEqual(
      { landing: { x: 6, y: 4 }, ms: OBSTACLES.balanceBeam.ticks * TICK_MS },
    );
  });

  test("stops halfway on a shortcut that can still fail, until the server says how it went", () => {
    expect(
      crossingShown({ ...grass, obstacle: "ridgeStile" }, at, xpForLevel(10)),
    ).toEqual({
      landing: { x: 5, y: 4 },
      ms: OBSTACLES.ridgeStile.ticks * TICK_MS,
    });
    expect(
      crossingShown(
        { ...grass, obstacleEnd: "ridgeStile" },
        { x: 6, y: 4 },
        xpForLevel(10),
      ),
    ).toMatchObject({ landing: { x: 5, y: 4 } });
  });

  test("heads for the landing on a shortcut the player can no longer fail", () => {
    expect(
      crossingShown({ ...grass, obstacle: "ridgeStile" }, at, xpForLevel(20)),
    ).toMatchObject({ landing: { x: 6, y: 4 } });
  });

  test("shows no crossing from a tile with no obstacle", () => {
    expect(crossingShown(grass, at, 0)).toBeUndefined();
  });
});
