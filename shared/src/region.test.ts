import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  loadRegion,
  neighbours,
  parseRegion,
  tileHash,
  tilesApart,
  type TileKind,
} from "./index.ts";

const read = (name: string) =>
  readFileSync(new URL(`../../maps/${name}`, import.meta.url), "utf8");
const region = loadRegion(read("region.tmj"), read("region.tsj"));
const blocks = (x: number, y: number) => region[y]![x]!.blocks;
const key = (x: number, y: number) => `${x},${y}`;

/**
 * The fewest steps to every tile a player can walk to from (x, y): 8 ways, no cutting
 * past blocked corners (spec §4). A diagonal takes as long as a straight step.
 */
function stepsFrom(
  [startX, startY]: readonly [number, number],
  isBlocked = blocks,
) {
  const steps = new Map([[key(startX, startY), 0]]);
  const queue = [[startX, startY] as const];
  for (const [x, y] of queue) {
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        const nx = x + dx;
        const ny = y + dy;
        if (steps.has(key(nx, ny)) || isBlocked(nx, ny)) continue;
        if (isBlocked(nx, y) || isBlocked(x, ny)) continue;
        steps.set(key(nx, ny), steps.get(key(x, y))! + 1);
        queue.push([nx, ny]);
      }
    }
  }
  return steps;
}

/** The kinds of tile these tests ask about. */
const IS = {
  respawn: (tile) => !!tile.respawn,
  thicket: (tile) => tile.ground === "thicket",
  berryBush: (tile) => tile.bush === "berryBush",
  herbBush: (tile) => tile.bush === "herbBush",
  spider: (tile) => tile.enemy === "spider",
  skeleton: (tile) => tile.enemy === "skeleton",
  copper: (tile) => tile.vein === "copper",
  iron: (tile) => tile.vein === "iron",
  emberite: (tile) => tile.vein === "emberite",
  furnace: (tile) => tile.station === "furnace",
  anvil: (tile) => tile.station === "anvil",
  blacksmith: (tile) => tile.villager === "odo",
  villager: (tile) => !!tile.villager,
  house: (tile) => !!tile.house,
} satisfies Record<string, (tile: TileKind) => boolean>;

function tilesOf(...kinds: (keyof typeof IS)[]) {
  return region.flatMap((row, y) =>
    row.flatMap((tile, x) =>
      kinds.some((kind) => IS[kind](tile)) ? [[x, y] as const] : [],
    ),
  );
}
const isHouse = (x: number, y: number) => !!region[y]?.[x]?.house;

/** The tiles one legal step from a tile that may itself block, with the same corner rule (spec §4, D1). */
const tilesNextTo = ([x, y]: readonly [number, number]) =>
  [-1, 0, 1].flatMap((dx) =>
    [-1, 0, 1].flatMap((dy) =>
      (dx || dy) &&
      !blocks(x + dx, y + dy) &&
      (!dx || !dy || (!blocks(x + dx, y) && !blocks(x, y + dy)))
        ? [[x + dx, y + dy] as const]
        : [],
    ),
  );

const asTile = ([x, y]: readonly [number, number]) => ({ x, y });
const VEINS = ["copper", "iron", "emberite"] as const;
const BUSHES = ["berryBush", "herbBush"] as const;
const STATIONS_AND_BLACKSMITH = ["furnace", "anvil", "blacksmith"] as const;

describe("the region", () => {
  const respawn = tilesOf("respawn")[0]!;
  const reachable = stepsFrom(respawn);

  it("is exactly 96×64", () => {
    expect(region.map((row) => row.length)).toEqual(Array(64).fill(96));
  });

  it.each([
    ["respawn", 1],
    ["berryBush", 12],
    ["herbBush", 6],
    ["spider", 8],
    ["copper", 6],
    ["iron", 4],
    ["emberite", 3],
    ["skeleton", 6],
    ["furnace", 1],
    ["anvil", 1],
    ["blacksmith", 1],
    ["villager", 3],
  ] as const)("has the right number of %s", (kind, count) => {
    expect(tilesOf(kind)).toHaveLength(count);
  });

  it("has an outer ring of blocks", () => {
    for (let x = 0; x < 96; x++) {
      expect([blocks(x, 0), blocks(x, 63)]).toEqual([true, true]);
    }
    for (let y = 0; y < 64; y++) {
      expect([blocks(0, y), blocks(95, y)]).toEqual([true, true]);
    }
  });

  it("lets a player walk from the respawn tile to every enemy home", () => {
    expect(
      tilesOf("spider", "skeleton").filter(
        ([x, y]) => !reachable.has(key(x, y)),
      ),
    ).toEqual([]);
  });

  it("lets a player walk next to every bush, vein, station and villager", () => {
    expect(
      tilesOf(
        ...BUSHES,
        ...VEINS,
        ...STATIONS_AND_BLACKSMITH,
        "villager",
      ).filter(
        (tile) => !tilesNextTo(tile).some(([x, y]) => reachable.has(key(x, y))),
      ),
    ).toEqual([]);
  });

  describe("houses", () => {
    const seen = new Set<string>();
    const houses = tilesOf("house").flatMap(([x, y]) => {
      if (seen.has(key(x, y))) return [];
      const tiles: [number, number][] = [[x, y]];
      seen.add(key(x, y));
      for (const [tx, ty] of tiles) {
        for (const [nx, ny] of [
          [tx + 1, ty],
          [tx - 1, ty],
          [tx, ty + 1],
          [tx, ty - 1],
        ] as const) {
          if (!isHouse(nx, ny) || seen.has(key(nx, ny))) continue;
          seen.add(key(nx, ny));
          tiles.push([nx, ny]);
        }
      }
      return [tiles];
    });

    it("are rectangles 2 tiles deep, as houseParts draws them", () => {
      expect(houses.length).toBeGreaterThan(0);
      for (const tiles of houses) {
        const xs = new Set(tiles.map(([x]) => x)).size;
        const ys = new Set(tiles.map(([, y]) => y)).size;
        expect(tiles).toHaveLength(xs * ys);
        expect(Math.min(xs, ys)).toBe(2);
      }
    });

    it("each have one door, off the corners, that a player can walk up to", () => {
      for (const tiles of houses) {
        const doors = tiles.filter(([x, y]) => region[y]![x]!.house === "door");
        expect(doors).toHaveLength(1);
        const [x, y] = doors[0]!;
        const outside = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ].filter(([nx, ny]) => !isHouse(nx!, ny!));
        expect(outside).toHaveLength(1);
        expect(reachable.has(key(outside[0]![0]!, outside[0]![1]!))).toBe(true);
      }
    });
  });

  it("keeps every Skeleton's reach off everything a player must be safe at", () => {
    const tooNear = (safe: (keyof typeof IS)[], reach: number) =>
      tilesOf("skeleton").flatMap((home) =>
        tilesOf(...safe).filter(
          (tile) => tilesApart(asTile(home), asTile(tile)) <= reach,
        ),
      );
    expect(
      tooNear(["respawn", "thicket", ...VEINS, ...STATIONS_AND_BLACKSMITH], 10),
    ).toEqual([]);
    expect(tooNear(["spider"], 15)).toEqual([]);
  });

  it("makes the Boneyard the only route to the Emberite veins", () => {
    const withoutAshen = stepsFrom(
      respawn,
      (x, y) => blocks(x, y) || region[y]![x]!.ground === "ashen",
    );
    expect(
      tilesOf("emberite").filter((tile) =>
        tilesNextTo(tile).some(([x, y]) => withoutAshen.has(key(x, y))),
      ),
    ).toEqual([]);
  });

  it.each([
    ["Copper", "copper", 8, 12],
    ["Iron", "iron", 22, 28],
    ["Emberite", "emberite", 40, 50],
  ] as const)(
    "puts %s veins the right walk from the Smithy",
    (_, vein, minSeconds, maxSeconds) => {
      const fromSmithy = stepsFrom(tilesNextTo(tilesOf("furnace")[0]!)[0]!);
      const seconds = tilesOf(vein).map(
        (vein) =>
          Math.min(
            ...tilesNextTo(vein).map(
              ([x, y]) => fromSmithy.get(key(x, y)) ?? Infinity,
            ),
          ) * 0.6, // A tile takes 0.6 s (spec §3).
      );
      expect(Math.min(...seconds)).toBeGreaterThanOrEqual(minSeconds);
      expect(Math.max(...seconds)).toBeLessThanOrEqual(maxSeconds);
    },
  );

  it.each([
    ["marta", 11, 41],
    ["aldous", 26, 41],
  ] as const)("stands %s at %i,%i", (villager, x, y) => {
    expect(region[y]![x]!.villager).toBe(villager);
  });

  it("stands the furnace, anvil and Blacksmith together at the village's edge", () => {
    const smithy = tilesOf(...STATIONS_AND_BLACKSMITH).map(asTile);
    for (const a of smithy) {
      for (const b of smithy) expect(tilesApart(a, b)).toBeLessThanOrEqual(6);
      expect(tilesApart(a, asTile(respawn))).toBeLessThanOrEqual(10);
    }
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
      bush: "berryBush",
      blocks: true,
    });
    expect(tiles[1]![0]).not.toHaveProperty("prop");
    expect(tiles[1]![1]).toMatchObject({ ground: "path", blocks: false });
  });

  it.each([
    ["a", { ground: "ashen", blocks: false }],
    ["A", { ground: "ashen", prop: "tree", blocks: true }],
    ["K", { ground: "ashen", enemy: "skeleton", blocks: false }],
    ["c", { ground: "grass", vein: "copper", blocks: true }],
    ["i", { ground: "grass", vein: "iron", blocks: true }],
    ["e", { ground: "ashen", vein: "emberite", blocks: true }],
    ["F", { ground: "grass", station: "furnace", blocks: true }],
    ["N", { ground: "grass", station: "anvil", blocks: true }],
    ["B", { ground: "grass", villager: "odo", blocks: true }],
    ["H", { ground: "grass", house: "wall", blocks: true }],
    ["D", { ground: "grass", house: "door", blocks: true }],
    ["W", { ground: "path", prop: "well", blocks: true }],
    ["l", { ground: "grass", prop: "lamp", blocks: true }],
    ["r", { ground: "grass", prop: "barrel", blocks: true }],
    ["x", { ground: "grass", prop: "crate", blocks: true }],
  ])("reads %s from the spec's grid characters", (char, kind) => {
    expect(parseRegion(char)[0]![0]).toEqual(kind);
  });

  it("refuses an unknown character", () => {
    expect(() => parseRegion("T?")).toThrow('"?"');
  });
});

describe("tile math", () => {
  it("measures distance in 8-way tiles, so a diagonal counts as one", () => {
    expect(tilesApart({ x: 1, y: 1 }, { x: 4, y: 3 })).toBe(3);
    expect(tilesApart({ x: 4, y: 3 }, { x: 4, y: 3 })).toBe(0);
  });

  it("gives the 8 tiles around a tile, not the tile itself", () => {
    const around = neighbours({ x: 5, y: 5 }).map(({ x, y }) => key(x, y));
    expect(around.sort()).toEqual(
      ["4,4", "4,5", "4,6", "5,4", "5,6", "6,4", "6,5", "6,6"].sort(),
    );
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
