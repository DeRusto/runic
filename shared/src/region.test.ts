import { describe, expect, it } from "vitest";
import { parseRegion, REGION_GRID, tileHash, TILE_KINDS } from "./index.ts";

const lines = REGION_GRID.trim().split("\n");
const region = parseRegion(REGION_GRID);
const blocks = (x: number, y: number) => region[y]![x]!.blocks;
const key = (x: number, y: number) => `${x},${y}`;

/** Every tile a player can walk to from (x, y): 8 ways, no cutting past blocked corners (spec §4). */
function reachableFrom(startX: number, startY: number) {
  const seen = new Set([key(startX, startY)]);
  const queue = [[startX, startY] as const];
  for (const [x, y] of queue) {
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        const nx = x + dx;
        const ny = y + dy;
        if (seen.has(key(nx, ny)) || blocks(nx, ny)) continue;
        if (blocks(nx, y) || blocks(x, ny)) continue;
        seen.add(key(nx, ny));
        queue.push([nx, ny]);
      }
    }
  }
  return seen;
}

function tilesOf(char: string) {
  return lines.flatMap((line, y) =>
    [...line].flatMap((c, x) => (c === char ? [[x, y] as const] : [])),
  );
}

describe("the region", () => {
  it("is exactly 64×64", () => {
    expect(lines.map((line) => line.length)).toEqual(Array(64).fill(64));
  });

  it("uses only known characters", () => {
    expect([...lines.join("")].filter((c) => !(c in TILE_KINDS))).toEqual([]);
  });

  it("has one respawn tile, 12 berry bushes, 6 herb bushes and 8 Spider homes", () => {
    expect(tilesOf("R")).toHaveLength(1);
    expect(tilesOf("b")).toHaveLength(12);
    expect(tilesOf("h")).toHaveLength(6);
    expect(tilesOf("S")).toHaveLength(8);
  });

  it("has an outer ring of blocks", () => {
    for (let i = 0; i < 64; i++) {
      expect([
        blocks(i, 0),
        blocks(i, 63),
        blocks(0, i),
        blocks(63, i),
      ]).toEqual(Array(4).fill(true));
    }
  });

  it("lets a player walk from the respawn tile to every Spider home and next to every bush", () => {
    const [respawn] = tilesOf("R");
    const reachable = reachableFrom(respawn![0], respawn![1]);

    expect(tilesOf("S").filter(([x, y]) => !reachable.has(key(x, y)))).toEqual(
      [],
    );

    // Next to means one legal step away, with the same corner rule (spec §4, D1).
    const nextToReachable = ([x, y]: readonly [number, number]) =>
      [-1, 0, 1].some((dx) =>
        [-1, 0, 1].some((dy) => {
          if (!reachable.has(key(x + dx, y + dy))) return false;
          return !blocks(x + dx, y) && !blocks(x, y + dy);
        }),
      );
    expect(
      [...tilesOf("b"), ...tilesOf("h")].filter(
        (bush) => !nextToReachable(bush),
      ),
    ).toEqual([]);
  });
});

describe("parseRegion", () => {
  it("gives each tile its kind, indexed by y then x", () => {
    const tiles = parseRegion("T.\nb=");
    expect(tiles[0]![0]).toMatchObject({
      ground: "grass",
      prop: "tree",
      blocks: true,
    });
    expect(tiles[0]![1]).toMatchObject({ ground: "grass", blocks: false });
    expect(tiles[1]![0]).toMatchObject({
      ground: "thicket",
      prop: "berryBush",
      blocks: true,
    });
    expect(tiles[1]![1]).toMatchObject({ ground: "path", blocks: false });
  });

  it("refuses an unknown character", () => {
    expect(() => parseRegion("T?")).toThrow('"?"');
  });
});

describe("tileHash", () => {
  it("never changes for a tile, so a reload looks the same", () => {
    expect([
      tileHash(0, 0),
      tileHash(1, 0),
      tileHash(0, 1),
      tileHash(63, 63),
    ]).toEqual([0, 2026918245, 1177811925, 3577061499]);
  });

  it("spreads over a whole region: colour, variant and rotation bits all vary", () => {
    const hashes = Array.from({ length: 4096 }, (_, i) =>
      tileHash(i % 64, i >> 6),
    );
    expect(new Set(hashes).size).toBeGreaterThan(4000);
    for (const shift of [0, 8, 16]) {
      const seen = new Set(hashes.map((h) => (h >>> shift) & 255));
      expect(seen.size).toBeGreaterThan(200);
    }
  });
});
