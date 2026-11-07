import { ENEMIES } from "./enemies.ts";
import { BUSHES } from "./foraging.ts";
import { VEINS } from "./mining.ts";
import type { TileKind } from "./region.ts";

type TiledProperty = { name: string; value: unknown };
type TiledObject = {
  type: string;
  name?: string;
  x: number;
  y: number;
  properties?: TiledProperty[];
};
type TiledLayer = {
  name: string;
  data?: unknown;
  objects?: TiledObject[];
  offsetx?: number;
  offsety?: number;
};
type TiledMap = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  tilesets: { firstgid: number }[];
  layers: TiledLayer[];
};
type TiledTileset = {
  tiles?: { id: number; properties?: TiledProperty[] }[];
};
type TileProperties = Partial<Omit<TileKind, "enemy" | "blacksmith">>;

const LAYERS = ["ground", "features", "placements"];

/** The values a tile may give each field. A new kind in region.ts won't typecheck until it's listed here. */
const FEATURE_VALUES = {
  prop: {
    tree: 1,
    rock: 1,
    tuft: 1,
    well: 1,
    lamp: 1,
    barrel: 1,
    crate: 1,
  } satisfies Record<NonNullable<TileKind["prop"]>, 1>,
  bush: BUSHES,
  vein: VEINS,
  station: { furnace: 1, anvil: 1 } satisfies Record<
    NonNullable<TileKind["station"]>,
    1
  >,
  house: { wall: 1, door: 1 } satisfies Record<
    NonNullable<TileKind["house"]>,
    1
  >,
};
const GROUND_VALUES = {
  grass: 1,
  thicket: 1,
  path: 1,
  ashen: 1,
} satisfies Record<TileKind["ground"], 1>;

const fail = (message: string): never => {
  throw new Error(`Region map: ${message}`);
};

const propertiesOf = (of: { properties?: TiledProperty[] }) =>
  Object.fromEntries((of.properties ?? []).map((p) => [p.name, p.value]));

/** What each tile in the tileset means, by its local id. */
function readTiles(tileset: TiledTileset) {
  const tiles = new Map<number, TileProperties>();
  for (const tile of tileset.tiles ?? []) {
    const properties = propertiesOf(tile);
    for (const [name, value] of Object.entries(properties)) {
      const values =
        name === "ground"
          ? GROUND_VALUES
          : FEATURE_VALUES[name as keyof typeof FEATURE_VALUES];
      if (name === "blocks" ? typeof value !== "boolean" : !values)
        fail(`tile ${tile.id} has a bad property "${name}"`);
      if (values && !Object.hasOwn(values, String(value)))
        fail(`tile ${tile.id} has an unknown ${name} "${String(value)}"`);
    }
    if (Object.keys(properties).filter((n) => n !== "blocks").length > 1)
      fail(`tile ${tile.id} is more than one kind of thing`);
    if ("ground" in properties && "blocks" in properties)
      fail(`ground tile ${tile.id} can't block; put a feature on it`);
    tiles.set(tile.id, properties);
  }
  return tiles;
}

/** A tile layer's local tile ids row by row, or undefined for an empty cell. */
function readCells(map: TiledMap, name: string, tiles: Set<number>) {
  const layer = map.layers.find((l) => l.name === name);
  if (!layer) return fail(`no "${name}" layer`);
  const { data } = layer;
  if (!Array.isArray(data) || data.length !== map.width * map.height)
    return fail(`layer "${name}" must be a ${map.width}×${map.height} array`);
  const firstGid = map.tilesets[0]!.firstgid;
  return Array.from({ length: map.height }, (_, y) =>
    Array.from({ length: map.width }, (_, x) => {
      const gid = data[y * map.width + x] as number;
      if (gid === 0) return undefined;
      // A flipped or rotated tile sets high bits in its gid, so it isn't found either; rotation comes from tileHash.
      if (!tiles.has(gid - firstGid))
        fail(`unknown, flipped or rotated tile at ${x},${y} in "${name}"`);
      return gid - firstGid;
    }),
  );
}

function place(tile: TileKind, object: TiledObject) {
  if (tile.blocks) fail(`"${object.type}" stands on a blocking tile`);
  if (object.type === "respawn") tile.respawn = true;
  else if (object.type === "enemyHome") {
    const { enemy } = propertiesOf(object);
    if (!Object.hasOwn(ENEMIES, String(enemy)))
      fail(`unknown enemy "${String(enemy)}"`);
    tile.enemy = enemy as TileKind["enemy"];
  } else if (object.type === "npc") {
    if (object.name !== "Blacksmith")
      fail(`unknown NPC "${String(object.name)}"`);
    tile.blacksmith = true;
    tile.blocks = true;
  } else fail(`unknown placement class "${object.type}"`);
}

/** The region's tiles from a Tiled map and its tileset, indexed [y][x]. Throws on anything the game couldn't use. */
export function loadRegion(mapText: string, tilesetText: string): TileKind[][] {
  const map = JSON.parse(mapText) as TiledMap;
  if (map.tilesets.length !== 1) fail("needs exactly one tileset");
  for (const { name, offsetx, offsety } of map.layers) {
    if (!LAYERS.includes(name)) fail(`unknown layer "${name}"`);
    if (offsetx || offsety) fail(`layer "${name}" has an offset`);
  }
  for (const name of LAYERS)
    if (map.layers.filter((l) => l.name === name).length !== 1)
      fail(`needs exactly one "${name}" layer`);

  const properties = readTiles(JSON.parse(tilesetText) as TiledTileset);
  const ids = new Set(properties.keys());
  const features = readCells(map, "features", ids);
  const tiles = readCells(map, "ground", ids).map((row, y) =>
    row.map((groundId, x) => {
      const { ground } = properties.get(groundId ?? -1) ?? {};
      if (!ground) return fail(`no ground at ${x},${y}`);
      const featureId = features[y]![x];
      const feature = featureId === undefined ? {} : properties.get(featureId)!;
      if (featureId !== undefined && Object.keys(feature).length === 0)
        fail(`tile ${featureId} in "features" means nothing`);
      if ("ground" in feature) fail(`ground tile in "features" at ${x},${y}`);
      return { ground, blocks: false, ...feature } as TileKind;
    }),
  );

  const placements = map.layers.find((l) => l.name === "placements");
  if (!placements?.objects) return fail(`no "placements" object layer`);
  const taken = new Set<string>();
  for (const object of placements.objects) {
    const x = object.x / map.tilewidth;
    const y = object.y / map.tileheight;
    const tile = tiles[y]?.[x];
    if (!tile) return fail(`"${object.type}" is off the grid at ${x},${y}`);
    if (taken.has(`${x},${y}`)) fail(`two placements share ${x},${y}`);
    taken.add(`${x},${y}`);
    place(tile, object);
  }
  if (placements.objects.filter((o) => o.type === "respawn").length !== 1)
    fail("needs exactly one respawn");
  return tiles;
}
