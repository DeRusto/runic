import { describe, expect, it } from "vitest";
import { parseRegion, respawnTile } from "./region.ts";
import { loadRegion } from "./regionMap.ts";

const property = (name: string, value: unknown) => ({ name, value });
const TILESET = {
  tiles: [
    { id: 0, properties: [property("ground", "grass")] },
    { id: 1, properties: [property("ground", "path")] },
    {
      id: 2,
      properties: [property("prop", "tree"), property("blocks", true)],
    },
    { id: 3, properties: [property("prop", "tuft")] },
    {
      id: 4,
      properties: [property("vein", "copper"), property("blocks", true)],
    },
  ],
};
const at = (x: number, y: number) => ({ x: x * 16, y: y * 16 });
const respawn = { type: "respawn", ...at(0, 0) };

/** A 3×2 region: path then grass, with a tree, a tuft and a vein. gids are local ids + 1. */
const mapWith = (changes: object = {}, objects: object[] = [respawn]) => ({
  width: 3,
  height: 2,
  tilewidth: 16,
  tileheight: 16,
  tilesets: [{ firstgid: 1, source: "region.tsj" }],
  layers: [
    { name: "ground", data: [2, 1, 1, 1, 1, 1] },
    { name: "features", data: [0, 3, 4, 5, 0, 0] },
    { name: "placements", objects },
  ],
  ...changes,
});
const load = (map: object, tileset: object = TILESET) =>
  loadRegion(JSON.stringify(map), JSON.stringify(tileset));
const pool = (active: number, size = { width: 32, height: 16 }) => ({
  type: "sitePool",
  ...at(1, 1),
  ...size,
  properties: [
    property("site", "vein"),
    property("kind", "iron"),
    property("active", active),
  ],
});
const spot = (x: number, y: number) => ({
  type: "siteSpot",
  ...at(x, y),
  point: true,
});
const withLayer = (name: string, data: unknown) => ({
  layers: mapWith().layers.map((l) => (l.name === name ? { name, data } : l)),
});

describe("loadRegion", () => {
  it("merges ground, features and placements into one tile each", () => {
    const { tiles } = load(
      mapWith({}, [
        respawn,
        {
          type: "enemyHome",
          ...at(1, 1),
          properties: [property("enemy", "spider")],
        },
        { type: "npc", name: "marta", ...at(2, 1) },
      ]),
    );
    expect(tiles).toEqual([
      [
        { ground: "path", respawn: true, blocks: false },
        { ground: "grass", prop: "tree", blocks: true },
        { ground: "grass", prop: "tuft", blocks: false },
      ],
      [
        { ground: "grass", vein: "copper", blocks: true },
        { ground: "grass", enemy: "spider", blocks: false },
        { ground: "grass", villager: "marta", blocks: true },
      ],
    ]);
  });

  it("loads what the grid shorthand parses, so test fixtures mean the same", () => {
    const { tiles } = load(mapWith());
    expect(tiles[0]![0]).toEqual(parseRegion("R")[0]![0]);
    expect(tiles[0]![1]).toEqual(parseRegion("T")[0]![0]);
    expect(tiles[1]![0]).toEqual(parseRegion("c")[0]![0]);
    expect(respawnTile(tiles)).toEqual({ x: 0, y: 0 });
  });

  it("reads a site pool and its spots, which stay plain ground", () => {
    const { tiles, pools } = load(
      mapWith({}, [respawn, pool(1), spot(1, 1), spot(2, 1)]),
    );
    expect(pools).toEqual([
      {
        skill: "mining",
        kind: "iron",
        active: 1,
        spots: [
          { x: 1, y: 1 },
          { x: 2, y: 1 },
        ],
      },
    ]);
    expect(tiles[1]![1]).toEqual({ ground: "grass", blocks: false });
  });

  it("reports no pools for a map without any", () => {
    expect(load(mapWith()).pools).toEqual([]);
  });

  it.each([
    [
      "an unknown layer",
      mapWith({ layers: [...mapWith().layers, { name: "notes" }] }),
      "notes",
    ],
    [
      "a second tileset",
      mapWith({ tilesets: [{ firstgid: 1 }, { firstgid: 9 }] }),
      "one tileset",
    ],
    [
      "two layers with one name",
      mapWith({ layers: [...mapWith().layers, mapWith().layers[1]] }),
      'exactly one "features"',
    ],
    [
      "a moved tile layer",
      mapWith({
        layers: mapWith().layers.map((l) =>
          l.name === "features" ? { ...l, offsetx: 16 } : l,
        ),
      }),
      "offset",
    ],
    [
      "a moved object layer",
      mapWith({
        layers: mapWith().layers.map((l) =>
          l.name === "placements" ? { ...l, offsety: 16 } : l,
        ),
      }),
      "offset",
    ],
    [
      "a missing layer",
      mapWith({ layers: mapWith().layers.slice(1) }),
      "ground",
    ],
    ["a compressed layer", mapWith(withLayer("ground", "eJw=")), "ground"],
    ["a short layer", mapWith(withLayer("features", [0])), "features"],
    [
      "a gap in the ground",
      mapWith(withLayer("ground", [0, 1, 1, 1, 1, 1])),
      "no ground at 0,0",
    ],
    [
      "a feature on the ground layer",
      mapWith(withLayer("ground", [3, 1, 1, 1, 1, 1])),
      "no ground at 0,0",
    ],
    [
      "ground on the features layer",
      mapWith(withLayer("features", [1, 0, 0, 0, 0, 0])),
      "ground tile",
    ],
    [
      "a tile the tileset lacks",
      mapWith(withLayer("features", [99, 0, 0, 0, 0, 0])),
      "0,0",
    ],
    [
      "a flipped tile",
      mapWith(withLayer("features", [0x80000003, 0, 0, 0, 0, 0])),
      "flipped",
    ],
    ["no respawn", mapWith({}, []), "one respawn"],
    [
      "two respawns",
      mapWith({}, [respawn, { type: "respawn", ...at(1, 1) }]),
      "one respawn",
    ],
    [
      "an unknown class",
      mapWith({}, [respawn, { type: "chest", ...at(1, 1) }]),
      "chest",
    ],
    [
      "an unknown enemy",
      mapWith({}, [
        respawn,
        {
          type: "enemyHome",
          ...at(1, 1),
          properties: [property("enemy", "dragon")],
        },
      ]),
      "dragon",
    ],
    [
      "an unknown NPC",
      mapWith({}, [respawn, { type: "npc", name: "Bob", ...at(1, 1) }]),
      "Bob",
    ],
    [
      "a placement off the grid",
      mapWith({}, [respawn, { type: "respawn", x: 20, y: 16 }]),
      "off the grid",
    ],
    [
      "a placement outside the map",
      mapWith({}, [{ type: "respawn", ...at(9, 9) }]),
      "off the grid",
    ],
    [
      "a placement on a blocking tile",
      mapWith({}, [{ type: "respawn", ...at(1, 0) }]),
      "blocking",
    ],
    [
      "two placements on one tile",
      mapWith({}, [respawn, { type: "npc", name: "odo", ...at(0, 0) }]),
      "share",
    ],
    [
      "a spot outside every pool",
      mapWith({}, [
        respawn,
        pool(1, { width: 16, height: 16 }),
        spot(1, 1),
        spot(2, 1),
      ]),
      "outside every pool",
    ],
    [
      "a spot inside two pools",
      mapWith({}, [respawn, pool(1), pool(1), spot(1, 1)]),
      "inside two pools",
    ],
    [
      "a pool with fewer spots than it keeps active",
      mapWith({}, [respawn, pool(3), spot(1, 1), spot(2, 1)]),
      "fewer spots",
    ],
    [
      "a pool of an unknown site",
      mapWith({}, [
        respawn,
        {
          ...pool(1),
          properties: [
            property("site", "tree"),
            property("kind", "oak"),
            property("active", 1),
          ],
        },
        spot(1, 1),
      ]),
      "tree",
    ],
    [
      "a pool of an unknown kind",
      mapWith({}, [
        respawn,
        {
          ...pool(1),
          properties: [
            property("site", "vein"),
            property("kind", "gold"),
            property("active", 1),
          ],
        },
        spot(1, 1),
      ]),
      "gold",
    ],
    [
      "a pool that keeps no site active",
      mapWith({}, [respawn, pool(0), spot(1, 1)]),
      "active",
    ],
    [
      "a spot on a blocking tile",
      mapWith({}, [
        respawn,
        { ...pool(1), ...at(0, 0), width: 48 },
        spot(1, 0),
      ]),
      "blocking",
    ],
  ])("refuses %s", (_, map, message) => {
    expect(() => load(map)).toThrow(message);
  });

  it.each([
    [
      "an unknown property",
      { tiles: [{ id: 0, properties: [property("colour", "red")] }] },
      "colour",
    ],
    [
      "an unknown ground",
      { tiles: [{ id: 0, properties: [property("ground", "lava")] }] },
      "lava",
    ],
    [
      "an unknown prop",
      { tiles: [{ id: 0, properties: [property("prop", "statue")] }] },
      "statue",
    ],
    [
      "a tile that's two kinds of thing",
      {
        tiles: [
          {
            id: 0,
            properties: [
              property("bush", "berryBush"),
              property("vein", "copper"),
            ],
          },
        ],
      },
      "more than one kind",
    ],
    [
      "a ground tile that blocks",
      {
        tiles: [
          {
            id: 0,
            properties: [property("ground", "grass"), property("blocks", true)],
          },
        ],
      },
      "can't block",
    ],
    [
      "a blocks that isn't a yes or no",
      { tiles: [{ id: 0, properties: [property("blocks", "yes")] }] },
      "blocks",
    ],
  ])("refuses a tileset with %s", (_, tileset, message) => {
    expect(() => load(mapWith(), tileset)).toThrow(message);
  });
});
