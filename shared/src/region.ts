import type { VillagerId } from "./dialogue.ts";
import type { EnemyKind } from "./enemies.ts";
import type { FishingSpotKind } from "./fishing.ts";
import type { BushKind } from "./herblaw.ts";
import type { TreeKind } from "./woodcutting.ts";

export type GroundKind = "grass" | "thicket" | "path" | "ashen" | "water";
/** Water can never be walked on, with or without a site on it. */
export const groundBlocks = (ground: GroundKind) => ground === "water";
export type PropKind =
  "tree" | "rock" | "tuft" | "well" | "lamp" | "barrel" | "crate";
/** The five metals, lowest first. Each tier's item ids start with it (`bronzeSword`). */
export const TIERS = ["copper", "bronze", "iron", "steel", "emberite"] as const;
export type Tier = (typeof TIERS)[number];
/** The tiers that have veins: Bronze and Steel are smelted from another tier's ore and a find. */
export type VeinTier = Exclude<Tier, "bronze" | "steel">;
/** A furnace smelts ore, an anvil makes gear, and a range cooks food (#221). */
export type StationKind = "furnace" | "anvil" | "range";
export type TileKind = {
  ground: GroundKind;
  prop?: PropKind;
  bush?: BushKind;
  vein?: VeinTier;
  tree?: TreeKind;
  fishingSpot?: FishingSpotKind;
  station?: StationKind;
  villager?: VillagerId;
  house?: "wall" | "door";
  enemy?: EnemyKind;
  respawn?: true;
  blocks: boolean;
};
export type Tile = { x: number; y: number };

/** Shorthand for writing small regions in tests: what each character means. The world itself is in maps/. */
export const TILE_KINDS = {
  ".": { ground: "grass", blocks: false },
  ",": { ground: "thicket", blocks: false },
  "=": { ground: "path", blocks: false },
  T: { ground: "grass", prop: "tree", blocks: true },
  t: { ground: "thicket", prop: "tree", blocks: true },
  o: { ground: "grass", prop: "rock", blocks: true },
  '"': { ground: "grass", prop: "tuft", blocks: false },
  b: { ground: "thicket", bush: "berryBush", blocks: true },
  h: { ground: "thicket", bush: "herbBush", blocks: true },
  S: { ground: "grass", enemy: "spider", blocks: false },
  R: { ground: "path", respawn: true, blocks: false },
  a: { ground: "ashen", blocks: false },
  A: { ground: "ashen", prop: "tree", blocks: true },
  K: { ground: "ashen", enemy: "skeleton", blocks: false },
  c: { ground: "grass", vein: "copper", blocks: true },
  i: { ground: "grass", vein: "iron", blocks: true },
  e: { ground: "ashen", vein: "emberite", blocks: true },
  g: { ground: "thicket", tree: "birch", blocks: true },
  k: { ground: "grass", tree: "oak", blocks: true },
  C: { ground: "ashen", tree: "charwood", blocks: true },
  F: { ground: "grass", station: "furnace", blocks: true },
  N: { ground: "grass", station: "anvil", blocks: true },
  G: { ground: "grass", station: "range", blocks: true },
  B: { ground: "grass", villager: "odo", blocks: true },
  M: { ground: "grass", villager: "marta", blocks: true },
  $: { ground: "grass", villager: "aldous", blocks: true },
  f: { ground: "thicket", villager: "bram", blocks: true },
  Y: { ground: "grass", villager: "tamsin", blocks: true },
  "~": { ground: "water", blocks: true },
  H: { ground: "grass", house: "wall", blocks: true },
  D: { ground: "grass", house: "door", blocks: true },
  W: { ground: "path", prop: "well", blocks: true },
  l: { ground: "grass", prop: "lamp", blocks: true },
  r: { ground: "grass", prop: "barrel", blocks: true },
  x: { ground: "grass", prop: "crate", blocks: true },
} as const satisfies Record<string, TileKind>;

/** The region's tiles, indexed [y][x]. Each is the very object in TILE_KINDS. */
export function parseRegion(grid: string): TileKind[][] {
  return grid
    .trim()
    .split("\n")
    .map((line) =>
      [...line].map((char) => {
        const kind = (TILE_KINDS as Record<string, TileKind>)[char];
        if (!kind) throw new Error(`Unknown region character "${char}"`);
        return kind;
      }),
    );
}

export function respawnTile(tiles: TileKind[][]): Tile {
  const y = tiles.findIndex((row) => row.some((tile) => tile.respawn));
  return { x: tiles[y]!.findIndex((tile) => tile.respawn), y };
}

/** Distance in 8-way tiles. */
export const tilesApart = (a: Tile, b: Tile) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/** The 8 tiles around `tile`, whether or not they're on the grid. */
export const neighbours = ({ x, y }: Tile): Tile[] =>
  DIRECTIONS.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));

/** A stable 32-bit hash of a tile, for its colour, model variant and rotation. */
export function tileHash(x: number, y: number): number {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}
