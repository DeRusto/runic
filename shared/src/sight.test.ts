import { describe, expect, test } from "vitest";
import { parseRegion, TILE_KINDS, type TileKind } from "./region.ts";
import { inSight, isTall } from "./sight.ts";

/** A region from rows of tile characters, so a test reads as the map it draws. */
const region = (...rows: string[]) => parseRegion(rows.join("\n"));

describe("isTall", () => {
  test("house walls, trees, rocks, veins, columns and standing stones are tall", () => {
    const tall: TileKind[] = [
      TILE_KINDS.H,
      TILE_KINDS.T,
      TILE_KINDS.A,
      TILE_KINDS.o,
      TILE_KINDS.c,
      TILE_KINDS.E,
      TILE_KINDS.g,
      TILE_KINDS.k,
      TILE_KINDS.C,
      { ground: "moss", prop: "column", blocks: true },
      { ground: "moss", prop: "standingStone", blocks: true },
    ];
    for (const tile of tall)
      expect(isTall(tile), JSON.stringify(tile)).toBe(true);
  });

  test("every other tile lets a shot pass, doors, water, bushes, the gate and villagers included", () => {
    const tallChars = new Set("HTtAociegkCE");
    for (const [char, tile] of Object.entries(TILE_KINDS))
      if (!tallChars.has(char)) expect(isTall(tile), char).toBe(false);
    expect(isTall({ ground: "path", prop: "gate", blocks: true })).toBe(false);
  });
});

describe("inSight", () => {
  test("a clear line over grass", () => {
    const tiles = region("......", "......", "......");
    expect(inSight(tiles, { x: 0, y: 0 }, { x: 5, y: 2 })).toBe(true);
  });

  test("a line across water and bushes", () => {
    const tiles = region(".~~bh.");
    expect(inSight(tiles, { x: 0, y: 0 }, { x: 5, y: 0 })).toBe(true);
  });

  test("a line through a house wall is blocked, and through its door is not", () => {
    expect(inSight(region("..H..."), { x: 0, y: 0 }, { x: 5, y: 0 })).toBe(
      false,
    );
    expect(inSight(region("..D..."), { x: 0, y: 0 }, { x: 5, y: 0 })).toBe(
      true,
    );
  });

  test("a line through a tree, a rock, a vein or a Woodcutting tree is blocked", () => {
    for (const tall of "ToceEg")
      expect(
        inSight(region(`..${tall}...`), { x: 0, y: 0 }, { x: 5, y: 0 }),
        tall,
      ).toBe(false);
  });

  test("a diagonal past the corner of a tall tile is blocked", () => {
    // The line from (0,0) to (2,2) touches the corners of (1,0) and (0,1).
    expect(
      inSight(region(".H.", "...", "..."), { x: 0, y: 0 }, { x: 2, y: 2 }),
    ).toBe(false);
    expect(
      inSight(region("...", "H..", "..."), { x: 0, y: 0 }, { x: 2, y: 2 }),
    ).toBe(false);
    expect(
      inSight(region("...", "...", "..."), { x: 0, y: 0 }, { x: 2, y: 2 }),
    ).toBe(true);
  });

  test("a shallow line passes a tall tile it does not cross", () => {
    // From (0,0) to (4,1) the line crosses (1,0), (2,0), (2,1) and (3,1), never (1,1) or (3,0).
    const tiles = region(".....", ".H...");
    expect(inSight(tiles, { x: 0, y: 0 }, { x: 4, y: 1 })).toBe(true);
    expect(
      inSight(region(".....", "...H."), { x: 0, y: 0 }, { x: 4, y: 1 }),
    ).toBe(false);
  });

  test("the shooter's and the target's own tiles never block", () => {
    const tiles = region("H...H");
    expect(inSight(tiles, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
  });

  test("gives the same answer with shooter and target swapped", () => {
    const tiles = region(
      "..T.....",
      "....H...",
      ".o......",
      "......c.",
      "...E....",
      "........",
    );
    for (let y1 = 0; y1 < 6; y1++)
      for (let x1 = 0; x1 < 8; x1++)
        for (let y2 = 0; y2 < 6; y2++)
          for (let x2 = 0; x2 < 8; x2++) {
            const a = { x: x1, y: y1 };
            const b = { x: x2, y: y2 };
            expect(inSight(tiles, a, b)).toBe(inSight(tiles, b, a));
          }
  });
});
