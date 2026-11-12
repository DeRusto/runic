import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  loadRegion,
  TREES as TREES_TABLE,
  neighbours,
  parseRegion,
  tileHash,
  tilesApart,
  type TileKind,
} from "./index.ts";

const read = (name: string) =>
  readFileSync(new URL(`../../maps/${name}`, import.meta.url), "utf8");
const { tiles: region, pools } = loadRegion(
  read("region.tmj"),
  read("region.tsj"),
);
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
  birch: (tile) => tile.tree === "birch",
  oak: (tile) => tile.tree === "oak",
  charwood: (tile) => tile.tree === "charwood",
  forester: (tile) => tile.villager === "bram",
  fisher: (tile) => tile.villager === "tamsin",
  water: (tile) => tile.ground === "water",
  path: (tile) => tile.ground === "path",
  furnace: (tile) => tile.station === "furnace",
  anvil: (tile) => tile.station === "anvil",
  range: (tile) => tile.station === "range",
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
/** Every spot of the pools of these kinds. */
const spotsOf = (...kinds: string[]) =>
  pools
    .filter(({ kind }) => kinds.includes(kind))
    .flatMap(({ spots }) => spots.map(({ x, y }) => [x, y] as const));

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

/** The fewest steps in `from` to stand next to any spot of `kind`. */
const nearestSteps = (kind: string, from: Map<string, number>) =>
  Math.min(
    ...spotsOf(kind).flatMap((spot) =>
      tilesNextTo(spot).map(([x, y]) => from.get(key(x, y)) ?? Infinity),
    ),
  );

const key2 = ([x, y]: readonly [number, number]) => key(x, y);
const asTile = ([x, y]: readonly [number, number]) => ({ x, y });
const VEINS = ["copper", "iron", "emberite"] as const;
const BUSHES = ["berryBush", "herbBush"] as const;
const STATIONS_AND_BLACKSMITH = [
  "furnace",
  "anvil",
  "range",
  "blacksmith",
] as const;
const TREES = ["birch", "oak", "charwood"] as const;

describe("the region", () => {
  const respawn = tilesOf("respawn")[0]!;
  const reachable = stepsFrom(respawn);
  /** Every tile a player can walk to from the respawn tile without setting foot on ashen ground. */
  const withoutAshen = stepsFrom(
    respawn,
    (x, y) => blocks(x, y) || region[y]![x]!.ground === "ashen",
  );

  it("is exactly 96×64", () => {
    expect(region.map((row) => row.length)).toEqual(Array(64).fill(96));
  });

  it.each([
    ["respawn", 1],
    ["spider", 8],
    ["skeleton", 6],
    ["furnace", 4],
    ["anvil", 1],
    ["range", 1],
    ["blacksmith", 1],
    ["forester", 1],
    ["fisher", 1],
    ["villager", 5],
  ] as const)("has the right number of %s", (kind, count) => {
    expect(tilesOf(kind)).toHaveLength(count);
  });

  it.each([
    ["copper", "mining", 9, 18],
    ["iron", "mining", 6, 12],
    ["emberite", "mining", 5, 9],
    ["berryBush", "herblaw", 12, 24],
    ["herbBush", "herblaw", 6, 12],
  ] as const)(
    "keeps %s in one %s pool, %i active of %i spots, and none fixed",
    (kind, skill, active, spots) => {
      expect(
        pools
          .filter((pool) => pool.kind === kind)
          .map((pool) => [pool.skill, pool.active, pool.spots.length]),
      ).toEqual([[skill, active, spots]]);
      expect(tilesOf(kind)).toEqual([]);
    },
  );

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

  it("lets a player walk next to every spot, station and villager", () => {
    expect(
      [
        ...tilesOf(...STATIONS_AND_BLACKSMITH, "villager", ...TREES),
        ...spotsOf(...VEINS, ...BUSHES, "shore"),
      ].filter(
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
    const tooNear = (safe: (readonly [number, number])[], reach: number) =>
      tilesOf("skeleton").flatMap((home) =>
        safe.filter((tile) => tilesApart(asTile(home), asTile(tile)) <= reach),
      );
    expect(
      tooNear(
        [
          ...tilesOf(
            "respawn",
            "thicket",
            "forester",
            "birch",
            ...STATIONS_AND_BLACKSMITH,
          ),
          ...spotsOf(...VEINS),
        ],
        10,
      ),
    ).toEqual([]);
    expect(tooNear(tilesOf("spider"), 15)).toEqual([]);
  });

  it("grows every bush spot in the Thicket, with no two side by side, so bushes never wall one another in", () => {
    const spots = spotsOf(...BUSHES);
    expect(spots.filter(([x, y]) => !IS.thicket(region[y]![x]!))).toEqual([]);
    expect(
      spots.filter((spot, i) =>
        spots.some(
          (other, j) => i !== j && tilesApart(asTile(spot), asTile(other)) < 2,
        ),
      ),
    ).toEqual([]);
  });

  it("puts the nearest berry spot nearer the village than the nearest herb spot", () => {
    expect(nearestSteps("berryBush", reachable)).toBeLessThan(
      nearestSteps("herbBush", reachable),
    );
  });

  it("paints the Lake in the north-west, and makes every water tile at its bank a spot of one fishing pool, 3 active", () => {
    const water = tilesOf("water");
    expect(water.length).toBeGreaterThan(0);
    for (const [x, y] of water) {
      expect([x >= 5 && x <= 27, y >= 2 && y <= 12]).toEqual([true, true]);
    }
    const bank = water.filter((tile) => tilesNextTo(tile).length > 0);
    expect(
      pools
        .filter((pool) => pool.skill === "fishing")
        .map((pool) => [pool.kind, pool.active]),
    ).toEqual([["shore", 3]]);
    expect(spotsOf("shore").map(key2).sort()).toEqual(bank.map(key2).sort());
  });

  it("stands the Fisher on the bank where a path reaches the shore", () => {
    const fisher = asTile(tilesOf("fisher")[0]!);
    const near = (kind: keyof typeof IS) =>
      tilesOf(kind).some((tile) => tilesApart(asTile(tile), fisher) <= 1);
    expect([near("water"), near("path")]).toEqual([true, true]);
  });

  it("puts the nearest fishing spot 30 to 35 steps from the respawn tile", () => {
    const nearest = nearestSteps("shore", reachable);
    expect([nearest >= 30, nearest <= 35]).toEqual([true, true]);
  });

  it.each([
    ["birch", 1],
    ["oak", 10],
    ["charwood", 20],
  ] as const)("places fixed %s trees, Woodcutting %i", (kind, level) => {
    expect(tilesOf(kind).length).toBeGreaterThanOrEqual(3);
    expect(pools.filter((pool) => pool.kind === kind)).toEqual([]);
    expect(TREES_TABLE[kind].level).toBe(level);
  });

  it("puts the Birch trees at the Thicket's edge beside the Forester, Oak in the east field and Charwood in the Boneyard", () => {
    const forester = asTile(tilesOf("forester")[0]!);
    const thicketNear = (x: number, y: number) =>
      tilesOf("thicket").some(
        (tile) => tilesApart(asTile(tile), { x, y }) <= 1,
      );
    expect(thicketNear(forester.x, forester.y)).toBe(true);
    for (const [x, y] of tilesOf("birch")) {
      expect(thicketNear(x, y)).toBe(true);
      expect(tilesApart({ x, y }, forester)).toBeLessThanOrEqual(8);
    }
    for (const [x, y] of tilesOf("oak")) {
      expect([x >= 64, y <= 28]).toEqual([true, true]);
    }
    for (const [x, y] of tilesOf("charwood"))
      expect(region[y]![x]!.ground).toBe("ashen");
  });

  it("makes the Boneyard the only route to every Charwood tree", () => {
    expect(
      tilesOf("charwood").filter((tree) =>
        tilesNextTo(tree).some(([x, y]) => withoutAshen.has(key(x, y))),
      ),
    ).toEqual([]);
  });

  it("makes the Boneyard the only route to every Emberite spot", () => {
    expect(
      spotsOf("emberite").filter((spot) =>
        [spot, ...tilesNextTo(spot)].some(([x, y]) =>
          withoutAshen.has(key(x, y)),
        ),
      ),
    ).toEqual([]);
  });

  it("puts the nearest Copper spot nearer the Smithy than the nearest Iron spot, and that nearer than the nearest Emberite spot", () => {
    const fromSmithy = stepsFrom(tilesNextTo(tilesOf("furnace")[0]!)[0]!);
    const nearest = (kind: (typeof VEINS)[number]) =>
      nearestSteps(kind, fromSmithy);
    expect(nearest("copper")).toBeLessThan(nearest("iron"));
    expect(nearest("iron")).toBeLessThan(nearest("emberite"));
  });

  it.each([
    ["marta", 11, 41],
    ["aldous", 26, 41],
  ] as const)("stands %s at %i,%i", (villager, x, y) => {
    expect(region[y]![x]!.villager).toBe(villager);
  });

  it("stands the furnace, anvil and Blacksmith at the crossroads' north-east corner", () => {
    for (const [x, y] of tilesOf(...STATIONS_AND_BLACKSMITH)) {
      expect(x).toBeGreaterThanOrEqual(36);
      expect(x).toBeLessThanOrEqual(40);
      expect(y).toBeGreaterThanOrEqual(37);
      expect(y).toBeLessThanOrEqual(40);
    }
  });

  it("draws the furnace on a 2×2 footprint", () => {
    const [[x, y]] = tilesOf("furnace") as [[number, number]];
    expect(tilesOf("furnace")).toEqual([
      [x, y],
      [x + 1, y],
      [x, y + 1],
      [x + 1, y + 1],
    ]);
  });

  it("stands the range beside the furnace's north-east corner (#221)", () => {
    const [[x, y]] = tilesOf("furnace") as [[number, number]];
    expect(tilesOf("range")).toEqual([[x + 3, y]]);
  });

  it("hides none of the smithy from the default camera, which looks north-west", () => {
    const isTall = (tile: TileKind) =>
      !!tile.house ||
      tile.station !== undefined ||
      ["tree", "well", "lamp"].includes(tile.prop ?? "");
    const stations = new Set(
      tilesOf(...STATIONS_AND_BLACKSMITH).map(([x, y]) => key(x, y)),
    );
    for (const [x, y] of tilesOf(...STATIONS_AND_BLACKSMITH)) {
      for (let dx = 0; dx <= 4; dx++) {
        for (let dy = 0; dy <= 4; dy++) {
          if (stations.has(key(x + dx, y + dy))) continue;
          if (dx || dy) expect(isTall(region[y + dy]![x + dx]!)).toBe(false);
        }
      }
    }
  });

  it("leaves the old smithy at (18–22, 37) as grass", () => {
    for (let x = 18; x <= 22; x++) {
      expect(region[37]![x]).toEqual({ ground: "grass", blocks: false });
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
    ["G", { ground: "grass", station: "range", blocks: true }],
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
