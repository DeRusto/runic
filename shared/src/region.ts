import type { EnemyKind } from "./enemies.ts";
import type { BushKind } from "./foraging.ts";

export type GroundKind = "grass" | "thicket" | "path";
export type PropKind = "tree" | "rock" | "tuft";
export type TileKind = {
  ground: GroundKind;
  prop?: PropKind;
  bush?: BushKind;
  enemy?: EnemyKind;
  blocks: boolean;
};
export type Tile = { x: number; y: number };

/** What each character of the text grid means (spec §3). Look a tile up here to ask what it is. */
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
  R: { ground: "path", blocks: false },
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
  const y = tiles.findIndex((row) => row.includes(TILE_KINDS.R));
  return { x: tiles[y]!.indexOf(TILE_KINDS.R), y };
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

/** First draft: village south-west, thicket north-east, field south-east, joined by paths. */
export const REGION_GRID = `
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTT.TT".T.TT.TT..T..........."..T....T.........................T
TTTTT...T"...T....T.........".."..".........."..........T.T."..T
T.T..T....TT.TT.TTT.."..................T"..."..T....T.....""..T
T.T....TT....T"..T.T............................T.o."..........T
TT..TT....T.T...TT.T.........."..........,t,,,,,,,,,....o."....T
T.T.T...TTT..T..T.TT...................t,,,,,,,,t,,,,,o...T....T
TTTT..TTT..T.TT..T.TT.................,,t,b,,,,,,,t,,,,....."..T
TT.T.......T.ToTT..........T"....T..,,,,t,,,,,,b,,,,,,,,,......T
T.TT.T.T.TT".T....TT...T...........T,,b,,,,t,,,,,,,,,,h,t......T
TT.T.T..T.T."T...T.........o.......,,,,,,,,,,,,,,,,,,,,,,t.....T
TTTTT.TT.....T.T.."T......."......tt,,,b,,,,b,,,,b,,b,,,,,,....T
TTT.TT...T..TT..T.To..............,t,t,,,,,,,,t,,,,,,,,,,,,....T
TTT.TT.T..".TT..T.T.........T.....,,,,,,,t,,,,,,,,,,,,,h,,,...TT
TTTTT...TTTTTT............o.....T==============,tt,,,,,,,t,....T
T...T.T....TT..T...To........."."==============,,,,,,,,,,,,To..T
TT.TTT.."T.TTTTTT...o...T....T.T.==,,,,tt,,,,,,t,,t,,,,,,t,....T
ToT."...TTT.....".T...T..T".....T==,,,,,,,,tt,,,,,t,,h,,,,,....T
T.T.T..TTT.T"..o............".T.T==,,,,,,,,,,,,t,,,,,,,,h,,.T..T
T"...TT..TTTT........o........T..==,,b,,,b,,,,,t,b,,,,,,,,t....T
T.........T...."o...T"..."T......==,,,,,,,,,,b,,,,,,,,,,,,...."T
T.o.................T.....T......==.,,,,,,,,,,,,,,,,,,,t,......T
T..........".....o...".."......".==.,,,,,,,,,,,t,,,h,,,,t......T
To........."....."....T..""......==...,,,,b,,,,,,,,,,,t..."....T
T......."........."".............==."..,,,,,,,,h,,,,,,.......".T
T.T...................o..........==.T....t,t,,,,,,,,.......T...T
T.......o............."..........==......................."....T
T...............TT...............==...o".......................T
T...T....T.T.........."....."."".==....o."...."..""............T
T...o..........T......T"T...T....==.T.."........"T.........".T.T
T".......".".........."..........==......."..".................T
T................".........".....==..............T.............T
T......"".......".........T......==.........."....T..........."T
T................................==....."....T.."....".....T...T
T..............................".==............"..T.T".........T
T......".........................==......T..................T..T
T..T.....".."..............".....==.."....".................""oT
T....T.................."....."..=="....."......"......".......T
T........"...................T.T.==.........S.............o....T
T.....T........=======...........==............................T
T..............=======...........==".....o..".....S............T
T....".......".=======.....T."T..==................"..."S......T
T.".==============R==============================..............T
T...=============================================..............T
T.oT...........=======....."..TT."........"............o.......T
T..."..........=======......T".T...............................T
T.................==..."......o.T............."........"......TT
T.........."......==.........T.....".......................".."T
T..o....."........==....."..............S............".......o.T
T.....T.."........==........"........"........"......".........T
T.T....TT.........==............"."....."............S.........T
TTTT.TT..T........==...."..o.T.o................."...."......"oT
TT..T.TTTTT.T.....==......".."...."...o......."".....".".......T
T.TT....TT........==."..........T.T...........S............".T.T
TT.TT...T...TTT...==...T..TT..."..................."......S....T
TT.TT..TTTT...T...==...."..........T...........................T
T.TTT..TT..TT"..".==............"..............o...............T
T....TTT.TT.T...."........"..............S....................oT
T.......T.TT.T......."..............................o..........T
T.TTT.oT.T..TT."...............T.............................".T
T.T.T...TTT...T.o..T..............."...........................T
T.T.T"T.TTTTTTT.T.............T........."............."........T
T..T.TTT.T.T..............................o".................".T
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
`;
