import type { EnemyKind } from "./enemies.ts";
import type { BushKind } from "./foraging.ts";

export type GroundKind = "grass" | "thicket" | "path" | "ashen";
export type PropKind =
  "tree" | "rock" | "tuft" | "well" | "lamp" | "barrel" | "crate";
export type Tier = "copper" | "iron" | "emberite";
export type StationKind = "furnace" | "anvil";
export type TileKind = {
  ground: GroundKind;
  prop?: PropKind;
  bush?: BushKind;
  vein?: Tier;
  station?: StationKind;
  blacksmith?: true;
  house?: "wall" | "door";
  enemy?: EnemyKind;
  respawn?: true;
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
  R: { ground: "path", respawn: true, blocks: false },
  a: { ground: "ashen", blocks: false },
  A: { ground: "ashen", prop: "tree", blocks: true },
  K: { ground: "ashen", enemy: "skeleton", blocks: false },
  c: { ground: "grass", vein: "copper", blocks: true },
  i: { ground: "grass", vein: "iron", blocks: true },
  e: { ground: "ashen", vein: "emberite", blocks: true },
  F: { ground: "grass", station: "furnace", blocks: true },
  N: { ground: "grass", station: "anvil", blocks: true },
  B: { ground: "grass", blacksmith: true, blocks: true },
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

/** First draft: village south-west with the Smithy, thicket north-east, field south-east, joined by paths; the road runs on east to the Boneyard's gap, and the Emberite pocket is behind it. */
export const REGION_GRID = `
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
TTT.TT".T.TT.TT..T..........."..T....T.........................T.........T..T....T...T.."....."T
TTTTT...T"...T....T.........".."..".........."..........T.T."..TT......T..T...."..........".T..T
T.T..T....TT.TT.TTT.."..................T"..."..T....T.....""..T......"T......................"T
T.T....TT....T"..T.T............................T.o."..........T.....""..........o.............T
TT..TT....T.T...TT.T.........."..........,t,,,,,,,,,....o."....T..................."...........T
T.T.T...TTT..T..T.TT...................t,,,,,,,,t,,,,,o...T....TTo............T.........T......T
TTTT..TTT..T.TT..T.TT.................,,t,b,,,,,,,t,,,,....."..T...T.........T.".TT...........TT
TT.T.......T.ToTT..........T"....T..,,,,t,,,,,,b,,,,,,,,,..i.i.T...o...T..............o..To.T..T
T.TT.T.T.TT".T....TT...T...........T,,b,,,,t,,,,,,,,,,h,t......T...."T..oT..."..T..T...T.......T
TT.T.T..T.T."T...T.........o.......,,,,,,,,,,,,,,,,,,,,,,t..i..T...............T.o...".........T
TTTTT.TT.....T.T.."T......."......tt,,,b,,,,b,,,,b,,b,,,,,,....T............T.............T...TT
TTT.TT...T..TT..T.To..............,t,t,,,,,,,,t,,,,,,,,,,,,..i.T..."....TT.....................T
TTT.TT.T..".TT..T.T.........T.....,,,,,,,t,,,,,,,,,,,,,h,,,...TT......T..T..T...".........T....T
TTTTT...TTTTTT............o.....T==============,tt,,,,,,,t,....T...T.....T....................TT
T...T.T....TT..T...To........."."==============,,,,,,,,,,,,To..T.....T....................T....T
TT.TTT.."T.TTTTTT...o...T....T.T.==,,,,tt,,,,,,t,,t,,,,,,t,....TT.T................"".T...T....T
ToT."...TTT.....".T...T..T".....T==,,,,,,,,tt,,,,,t,,h,,,,,....T."..................T..........T
T.T.T..TTT.T"..o............".T.T==,,,,,,,,,,,,t,,,,,,,,h,,.T..T...................T..".....".TT
T"...TT..TTTT........o........T..==,,b,,,b,,,,,t,b,,,,,,,,t....T...T..T..T.T......"............T
T.........T.c.c"o.c.T".c."T......==,,,,,,,,,,b,,,,,,,,,,,,...."T.......o...T......TT...........T
T.o................cT...c.T......==.,,,,,,,,,,,,,,,,,,,t,......T...T......".........T..........T
T..........".....o...".."......".==.,,,,,,,,,,,t,,,h,,,,t......T.T.......TT..".................T
To........."....."....T..""......==...,,,,b,,,,,,,,,,,t..."....T............".......T..........T
T......."........."".............==."..,,,,,,,,h,,,,,,.......".T....To........T.....o".........T
T.T...................o..........==.T....t,t,,,,,,,,.......T...T.....T....o..o...............".T
T.......o............."..........==......................."....T....T..."..o.."..............T.T
T...............TT...............==...o".......................T.""...............T............T
T...T....T.T.........."....."."".==....o."...."..""............TT.............".......T..T."...T
T...o..........T......T"T...T....==.T.."........"T.........".T.T......AAAAAAAAAAAAAAAAAAAAAAAAAA
T".......".".........."..........==......."..".................T......AaaaaaaaaaaaaaaaaaAaaaaaaA
T................".........".....==..............T.............T......AaaaaaaaaaaaaaaaAaAaaaaaaA
T......"".......".........T......==.........."....T..........."T..."TTAaaaaaaaaaaaaaaaaaaaaaaAaA
T................................==....."....T.."....".....T...T......AaaaaaaAaaaaaaaaAaaaaaaaaA
T..............................".==............"..T.T".........T.....TAaaaaaaaaaKaaaaaaaAaaaaaaA
T......".........................==......T..................T..T..."..AaaAaaaaaaaaaaaaaaAaaaaaaA
T..T.....".."..............".....==.."....".................""oT......AaaaaaaaaaaaaaaaaaAaaaeaaA
T....T............F.N.B."....."..=="....."......"......".......T......AaaaKaaaaaaaaaaaAaAaaaaaaA
T........"...................T.T.==.........S.............o....T..TT..AaaaaaaaaaaaaaaaaaAaaaaaaA
T.....T..HHHHr.=======..HHHH.....==............................T......AaaaaaaaaaaaaaaaaaAaaaaeaA
T........HDHHr.=W=====.rHDHH.....==".....o..".....S............T......AAaaaaaaaaaaaaaaaaAaaaaaaA
T...."....=.."l=======l..=.T."T..==................"..."S......T......AaaaaaaaaaaaaaaaaaAaaeaaaA
T.".==============R====================================================aaaaaaaaaaaaaaaaaAaaaaaaA
T...===================================================================aaaaaaKaaKaaaaaaaAaAaaaaA
T.oT......=...l=======l..=."..TT."........"............o.......T......AaaaaaaaaaaaaaaaaaAaaaaaaA
T..."...xHDH...=======..HDHxT".T...............................T.oT...AaaaaaaaaaaaaaaaaaAAaaaaaA
T.......xHHH......==..."HHHr..o.T............."........"......TT......AaaaaaaaaaaAaaaaaaAaaaaaaA
T.........."......==.........T.....".......................".."T.o....AaaaaaaaaaaaaaaaaaAaaaaaaA
T..o.....".....HH.==.HH.."..............S............".......o.T..T..oAaaaKaaaaaaaaaaaaaAaaaaaaA
T.....T..".....HD====DH....."........"........"......".........T....."AaaaaaaaaaaaaaaaaaAaaaaaAA
T.T....TT......HHr==xHH........."."....."............S.........T......AaaaaaaaaaaaaaaaaaAaaaaaaA
TTTT.TT..T........==...."..o.T.o................."...."......"oT......AaaaaaaaaaaAaaaaaaAaaaaaAA
TT..T.TTTTT.T.....==......".."...."...o......."".....".".......TT."...AaaaaaaaaaKaaaaaaaAaaaaaaA
T.TT....TT........==."..........T.T...........S............".T.TT.....AaaaaaaaaaaaaaaAaaAaAaaaaA
TT.TT...T...TTT...==...T..TT..."..................."......S....T......AaaaAaaaaaaaaaaaaaAaaaaaaA
TT.TT..TTTT...T...==...."..........T...........................T......AaaaaaAaaaaaaaaaaaAaaaaaaA
T.TTT..TT..TT"..".==............"..............o...............T......AAAAAAAAAAAAAAAAAAAAAAAAAA
T....TTT.TT.T...."........"..............S....................oT........T............o.......T.T
T.......T.TT.T......."..............................o..........T........T........""............T
T.TTT.oT.T..TT."...............T.............................".TT..TT........................".T
T.T.T...TTT...T.o..T..............."...........................T........................T..".."T
T.T.T"T.TTTTTTT.T.............T........."............."........TT.....T........."...T.........TT
T..T.TTT.T.T..............................o".................".T.o.T.T.........ToT.T...........T
TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT
`;
