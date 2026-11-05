import { parseRegion } from "@runic/shared";
import { expect, test } from "vitest";
import { pathNextTo, findPath } from "./pathfinding.ts";

const region = (...rows: string[]) => parseRegion(rows.join("\n"));

const OPEN = region("TTTTTTT", "T.....T", "T.....T", "T.....T", "TTTTTTT");

test("walks a straight line one tile at a time, not counting the start", () => {
  expect(findPath(OPEN, { x: 1, y: 1 }, { x: 4, y: 1 })).toEqual([
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ]);
});

test("a diagonal costs the same as a straight step", () => {
  expect(findPath(OPEN, { x: 1, y: 1 }, { x: 3, y: 3 })).toEqual([
    { x: 2, y: 2 },
    { x: 3, y: 3 },
  ]);
});

test("a click on the player's own tile gives no path", () => {
  expect(findPath(OPEN, { x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([]);
});

test("never cuts past a blocked corner", () => {
  const tiles = region("TTTT", "T..T", "TT.T", "TTTT");
  expect(findPath(tiles, { x: 1, y: 1 }, { x: 2, y: 2 })).toEqual([
    { x: 2, y: 1 },
    { x: 2, y: 2 },
  ]);
  expect(findPath(tiles, { x: 2, y: 2 }, { x: 1, y: 1 })).toEqual([
    { x: 2, y: 1 },
    { x: 1, y: 1 },
  ]);
});

test("goes around a wall", () => {
  const tiles = region("TTTTT", "T.T.T", "T.T.T", "T...T", "TTTTT");
  const path = findPath(tiles, { x: 1, y: 1 }, { x: 3, y: 1 });
  // Down, along and up; the corner rule rules out both diagonals at the wall's foot.
  expect(path).toHaveLength(6);
  expect(path.at(-1)).toEqual({ x: 3, y: 1 });
});

const SPLIT = region("TTTTTTT", "T..T..T", "T..T..T", "TTTTTTT");

test("a click on an unreachable tile walks to the nearest reachable one", () => {
  expect(findPath(SPLIT, { x: 1, y: 2 }, { x: 5, y: 1 }).at(-1)).toEqual({
    x: 2,
    y: 1,
  });
});

test("a click on a blocked tile walks next to it", () => {
  expect(findPath(SPLIT, { x: 1, y: 2 }, { x: 3, y: 2 })).toEqual([
    { x: 2, y: 2 },
  ]);
});

test("between equally near tiles, takes the one fewest steps away", () => {
  const tiles = region("TTTTT", "T...T", "T.T.T", "T...T", "TTTTT");
  expect(findPath(tiles, { x: 1, y: 1 }, { x: 2, y: 2 })).toHaveLength(1);
});

test("stays put when the start is already the nearest reachable tile", () => {
  expect(findPath(SPLIT, { x: 2, y: 1 }, { x: 3, y: 1 })).toEqual([]);
});

// A bush at (2,2), with a tree on its north side.
const BUSH = { x: 2, y: 2 };
const NEXT_TO = region("TTTTT", "T.T.T", "T.b.T", "T...T", "TTTTT");

test("next to a blocking tile: a diagonal past a blocked corner doesn't count", () => {
  expect(pathNextTo(NEXT_TO, { x: 1, y: 1 }, BUSH)).toEqual([{ x: 1, y: 2 }]);
});

test("next to a blocking tile: a clear diagonal counts, so no step is needed", () => {
  expect(pathNextTo(NEXT_TO, { x: 1, y: 3 }, BUSH)).toEqual([]);
});

test("next to a blocking tile: none reachable gives no path", () => {
  const walled = region("TTTTTT", "T.TbTT", "TTTTTT");
  expect(pathNextTo(walled, { x: 1, y: 1 }, { x: 3, y: 1 })).toBeUndefined();
});
