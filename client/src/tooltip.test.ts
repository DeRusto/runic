import { describe, expect, test } from "vitest";
import { tipPosition } from "./tooltip.ts";

describe("the tooltip's placement (spec §5)", () => {
  const size = { width: 100, height: 20 };
  const window = { width: 1000, height: 700 };

  test("sits up and to the right of the cursor, 12 px off", () => {
    expect(tipPosition({ x: 50, y: 600 }, size, window)).toEqual({
      left: 62,
      top: 568,
    });
  });

  test("flips to the left of the cursor at the window's right edge", () => {
    expect(tipPosition({ x: 950, y: 600 }, size, window)).toEqual({
      left: 838,
      top: 568,
    });
  });

  test("flips below the cursor at the window's top edge", () => {
    expect(tipPosition({ x: 50, y: 20 }, size, window)).toEqual({
      left: 62,
      top: 32,
    });
  });

  test("flips both ways in the top right corner", () => {
    expect(tipPosition({ x: 950, y: 20 }, size, window)).toEqual({
      left: 838,
      top: 32,
    });
  });
});
