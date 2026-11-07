// Run once: turns REGION_GRID into maps/region.tmj, region.tsj and the stand-in region.png (#74).
import { writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";
import {
  parseRegion,
  REGION_GRID,
  type TileKind,
} from "../shared/src/region.ts";

const SIZE = 16;
type Rgb = [number, number, number];

/** Each tile's properties and flat stand-in colour. Tiled shows a plain grid; the game draws the real look. */
const GROUNDS: [string, Rgb][] = [
  ["grass", [96, 150, 72]],
  ["thicket", [52, 104, 60]],
  ["path", [176, 150, 104]],
  ["ashen", [96, 90, 90]],
];
const FEATURES: [keyof TileKind, string, boolean, Rgb][] = [
  ["prop", "tree", true, [20, 70, 30]],
  ["prop", "rock", true, [130, 130, 130]],
  ["prop", "tuft", false, [140, 190, 90]],
  ["prop", "well", true, [60, 110, 190]],
  ["prop", "lamp", true, [250, 210, 90]],
  ["prop", "barrel", true, [130, 85, 45]],
  ["prop", "crate", true, [170, 125, 70]],
  ["bush", "berryBush", true, [190, 50, 90]],
  ["bush", "herbBush", true, [120, 220, 170]],
  ["vein", "copper", true, [205, 120, 60]],
  ["vein", "iron", true, [170, 180, 195]],
  ["vein", "emberite", true, [240, 80, 30]],
  ["station", "furnace", true, [90, 30, 20]],
  ["station", "anvil", true, [50, 50, 60]],
  ["house", "wall", true, [150, 110, 90]],
  ["house", "door", true, [80, 50, 30]],
];
const COUNT = GROUNDS.length + FEATURES.length;
const groundId = (ground: string) => GROUNDS.findIndex(([g]) => g === ground);
const featureId = (tile: TileKind) =>
  FEATURES.findIndex(([field, value]) => tile[field] === value);

const string = (name: string, value: string) => ({
  name,
  type: "string",
  value,
});
const tilesetTiles = [
  ...GROUNDS.map(([ground], id) => ({
    id,
    properties: [string("ground", ground)],
  })),
  ...FEATURES.map(([field, value, blocks], i) => ({
    id: GROUNDS.length + i,
    properties: [
      ...(blocks ? [{ name: "blocks", type: "bool", value: true }] : []),
      string(field, value),
    ],
  })),
];

const tiles = parseRegion(REGION_GRID);
const height = tiles.length;
const width = tiles[0]!.length;
const objects = tiles
  .flatMap((row, y) =>
    row.flatMap((tile, x) => {
      const at = {
        x: x * SIZE,
        y: y * SIZE,
        width: 0,
        height: 0,
        rotation: 0,
        visible: true,
      };
      if (tile.respawn)
        return [{ ...at, type: "respawn", name: "", point: true }];
      if (tile.blacksmith)
        return [{ ...at, type: "npc", name: "Blacksmith", point: true }];
      if (tile.enemy)
        return [
          {
            ...at,
            type: "enemyHome",
            name: "",
            point: true,
            properties: [string("enemy", tile.enemy)],
          },
        ];
      return [];
    }),
  )
  .map((object, i) => ({ id: i + 1, ...object }));

function png(w: number, h: number, rgbAt: (x: number, y: number) => Rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      raw.set(rgbAt(x, y), y * (w * 3 + 1) + 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Grounds fill their tile; features are a square on a transparent-looking neutral background.
const BACKDROP: Rgb = [40, 40, 40];
writeFileSync(
  "maps/region.png",
  png(SIZE * COUNT, SIZE, (x, y) => {
    const id = Math.floor(x / SIZE);
    if (id < GROUNDS.length) return GROUNDS[id]![1];
    const inside = x % SIZE >= 3 && x % SIZE < 13 && y >= 3 && y < 13;
    return inside ? FEATURES[id - GROUNDS.length]![3] : BACKDROP;
  }),
);
writeFileSync(
  "maps/region.tsj",
  JSON.stringify({
    type: "tileset",
    version: "1.10",
    tiledversion: "1.12.2",
    name: "region",
    image: "region.png",
    imagewidth: SIZE * COUNT,
    imageheight: SIZE,
    transparentcolor: "#282828",
    tilewidth: SIZE,
    tileheight: SIZE,
    tilecount: COUNT,
    columns: COUNT,
    margin: 0,
    spacing: 0,
    tiles: tilesetTiles,
  }),
);
const layer = { x: 0, y: 0, width, height, opacity: 1, visible: true };
writeFileSync(
  "maps/region.tmj",
  JSON.stringify({
    type: "map",
    version: "1.10",
    tiledversion: "1.12.2",
    orientation: "orthogonal",
    renderorder: "right-down",
    infinite: false,
    width,
    height,
    tilewidth: SIZE,
    tileheight: SIZE,
    nextlayerid: 4,
    nextobjectid: objects.length + 1,
    tilesets: [{ firstgid: 1, source: "region.tsj" }],
    layers: [
      {
        ...layer,
        id: 1,
        name: "ground",
        type: "tilelayer",
        data: tiles.flat().map((tile) => groundId(tile.ground) + 1),
      },
      {
        ...layer,
        id: 2,
        name: "features",
        type: "tilelayer",
        data: tiles.flat().map((tile) => {
          const id = featureId(tile);
          return id < 0 ? 0 : GROUNDS.length + id + 1;
        }),
      },
      {
        id: 3,
        name: "placements",
        type: "objectgroup",
        draworder: "topdown",
        x: 0,
        y: 0,
        opacity: 1,
        visible: true,
        objects,
      },
    ],
  }),
);
console.log({ width, height, tiles: COUNT, objects: objects.length });
