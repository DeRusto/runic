import type { TileKind, VillagerId } from "@runic/shared";

/** The Modular Village model behind each part. A tile is one module wide, and a wall or roof part faces +x before it's turned. */
export const HOUSE_MODELS = {
  wall: "Stucco_Block",
  window: "Stucco_Window_Single_Narrow_Tall",
  doorway: "Stucco_Doorway_Narrow_Tall",
  door: "Wall_Prop_Door_Simple",
  post: "Stucco_Prop_Support_Pillar_1",
  beam: "Stucco_Prop_Support_Beam_1",
  roof: "Roof_Straight_Side_Eave",
  ridge: "Roof_Accent_Ridge",
  chimney: "Roof_Prop_Chimney_Stone",
  // The bank's, inn's and store's own parts.
  stoneDoorway: "Stone_Doorway_Narrow_Tall_1",
  ornateDoor: "Wall_Prop_Door_Ornate",
  stone: "Stone_Wall_1",
  archWindow: "Stucco_Window_Rounded_Narrow",
  doubleWindow: "Stucco_Window_Double_Narrow_Tall",
  lamp: "Wall_Prop_Lamp",
  sign: "Wall_Prop_Sign_1",
  awning: "Canopy_Ramp_Mid",
  barrel: "Prop_Barrel_2",
  openBarrel: "Prop_Barrel_1_Open",
  crate: "Prop_Crate_1_Open",
  // The roof in a building's colours: after the colon, its name in BUILDING_LOOKS.
  bankRoof: "Roof_Straight_Side_Eave:bank",
  innRoof: "Roof_Straight_Side_Eave:inn",
  storeRoof: "Roof_Straight_Side_Eave:store",
};
/** `out` and `along` move a part from its tile's middle, in tiles, out from the wall it faces and along it. */
export type HousePart = {
  part: keyof typeof HOUSE_MODELS;
  angle: number;
  height: number;
  out?: number;
  along?: number;
  scale?: number;
  /** A colour the part's own colours are multiplied by. */
  tint?: number;
};

/**
 * Each building's colours: its plaster, which the kit's cream is multiplied by on its walls and
 * its roof's gables, and its roof tiles in place of the kit's red. A plain house keeps the kit's.
 */
export const BUILDING_LOOKS: Record<
  Exclude<Building, "house">,
  { plaster: number; roof: number }
> = {
  bank: { plaster: 0xc4c8d0, roof: 0x5b6573 },
  inn: { plaster: 0xffd9a0, roof: 0x6e4b33 },
  store: { plaster: 0xd2e6c8, roof: 0x587a40 },
};
const PLASTERED = new Set<HousePart["part"]>([
  "wall",
  "window",
  "doubleWindow",
  "archWindow",
  "doorway",
]);

/** The village's three buildings with a look of their own; every other house is plain. */
export type Building = "bank" | "inn" | "store" | "house";
/** Who stands at a building's door, or the station beside it, says which building it is. */
const KEEPERS: Partial<Record<VillagerId, Building>> = {
  aldous: "bank",
  marta: "store",
};

/** The house tile (x, y) is part of: its tiles, door and what kind of building it is. */
export function buildingAt(tiles: TileKind[][], x: number, y: number) {
  const isHouse = (hx: number, hy: number) => !!tiles[hy]?.[hx]?.house;
  const cells: [number, number][] = [[x, y]];
  const seen = new Set([`${x},${y}`]);
  for (let i = 0; i < cells.length; i++) {
    const [cx, cy] = cells[i]!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const key = `${cx + dx},${cy + dy}`;
      if (isHouse(cx + dx, cy + dy) && !seen.has(key)) {
        seen.add(key);
        cells.push([cx + dx, cy + dy]);
      }
    }
  }
  const door = cells.find(([cx, cy]) => tiles[cy]![cx]!.house === "door")!;
  let kind: Building = "house";
  for (const [cx, cy] of cells) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0, 2],
      [0, -2],
    ] as const) {
      const next = tiles[cy + dy]?.[cx + dx];
      if (!next || next.house) continue;
      if (next.villager && KEEPERS[next.villager])
        kind = KEEPERS[next.villager]!;
      if (next.station === "range") kind = "inn";
    }
  }
  return { door, kind };
}

const WALL_HEIGHT = 2;
const ROOF_RISE = 1;
// Each turns a +x-facing part to face that way: +angle takes +x towards -y on the grid.
const EAST = { dx: 1, dy: 0, angle: 0 };
const NORTH = { dx: 0, dy: -1, angle: Math.PI / 2 };
const WEST = { dx: -1, dy: 0, angle: Math.PI };
const SOUTH = { dx: 0, dy: 1, angle: -Math.PI / 2 };

/** What to draw on a house tile, worked out from its neighbours alone, so a house is just its tiles in the grid. A house is a rectangle 2 tiles deep (region.test.ts). */
export function houseParts(
  tiles: TileKind[][],
  x: number,
  y: number,
): HousePart[] {
  const isHouse = (hx: number, hy: number) => !!tiles[hy]?.[hx]?.house;
  const out = (side: typeof EAST) => !isHouse(x + side.dx, y + side.dy);
  const door = tiles[y]![x]!.house === "door";
  const sides = [EAST, NORTH, WEST, SOUTH].filter(out);
  const parts: HousePart[] = [];
  const building = buildingAt(tiles, x, y);
  const { kind } = building;
  const window = kind === "inn" ? "doubleWindow" : "window";

  if (sides.length > 1) {
    parts.push(
      { part: "wall", angle: 0, height: 0 },
      { part: "wall", angle: 0, height: 1 },
    );
  } else {
    const { angle } = sides[0]!;
    if (door) {
      const bank = kind === "bank";
      parts.push(
        { part: bank ? "stoneDoorway" : "doorway", angle, height: 0 },
        { part: bank ? "ornateDoor" : "door", angle, height: 0 },
      );
    } else if (kind === "bank") {
      // A stone ground floor under arched windows.
      parts.push(
        { part: "wall", angle, height: 0 },
        { part: "archWindow", angle, height: 1 },
      );
    } else {
      parts.push({ part: window, angle, height: 0 });
    }
  }
  if (kind === "bank") {
    for (const { angle } of sides) {
      if (!door)
        parts.push({ part: "stone", angle: angle + Math.PI, height: 0 });
    }
  }
  parts.push(...frontParts(tiles, x, y, building));
  const plaster = kind === "house" ? undefined : BUILDING_LOOKS[kind].plaster;
  if (plaster) {
    for (const part of parts) if (PLASTERED.has(part.part)) part.tint = plaster;
  }
  for (const { angle } of sides) {
    // Both timbers stand on the part's -x side, so they turn to face the other way.
    const back = angle + Math.PI;
    parts.push(
      { part: "post", angle: back, height: 0 },
      { part: "post", angle: back, height: 1 },
      { part: "beam", angle: back, height: WALL_HEIGHT },
    );
    if (!door) parts.push({ part: "beam", angle: back, height: 1 });
  }

  // The ridge runs along the house's longer side, so each tile's roof slopes down and out across it.
  const run = (dx: number, dy: number) => {
    let length = 1;
    for (const way of [1, -1]) {
      for (let i = way; isHouse(x + i * dx, y + i * dy); i += way) length++;
    }
    return length;
  };
  const ridgeAlongX = run(1, 0) >= run(0, 1);
  const eave = ridgeAlongX
    ? out(NORTH)
      ? NORTH
      : SOUTH
    : out(WEST)
      ? WEST
      : EAST;
  parts.push({
    part: kind === "house" ? "roof" : `${kind}Roof`,
    angle: eave.angle,
    height: WALL_HEIGHT,
  });
  // A ridge piece stands on the part's +z side. Only one slope carries it, or two would overlap.
  if (eave === NORTH || eave === WEST) {
    parts.push({
      part: "ridge",
      angle: eave.angle - Math.PI / 2,
      height: WALL_HEIGHT + ROOF_RISE,
    });
  }
  if (door) parts.push({ part: "chimney", angle: 0, height: WALL_HEIGHT });
  return parts;
}

/** How far out from a wall's middle a part hung on it starts, clear of the timbers. */
const ON_WALL = 1.1;

/** The bank's, inn's and store's dressing along the wall with the door in it, on the tile (x, y). */
function frontParts(
  tiles: TileKind[][],
  x: number,
  y: number,
  { door: [doorX, doorY], kind }: ReturnType<typeof buildingAt>,
): HousePart[] {
  if (kind === "house") return [];
  const front = [EAST, NORTH, WEST, SOUTH].find(
    (side) => !tiles[doorY + side.dy]?.[doorX + side.dx]?.house,
  )!;
  if (tiles[y + front.dy]?.[x + front.dx]?.house) return [];
  const { angle } = front;
  // Tiles from the door along the front, the way a part's own `along` runs.
  const step = (x - doorX) * Math.sin(angle) + (y - doorY) * Math.cos(angle);
  const wall = (part: HousePart["part"], height: number, along: number) => ({
    part,
    angle,
    height,
    out: ON_WALL,
    along,
  });
  const parts: HousePart[] = [];
  if (kind === "bank" && step === 0) {
    parts.push(wall("lamp", 0.9, -0.5), wall("lamp", 0.9, 0.5));
  }
  if (kind === "inn") {
    if (step === 0)
      parts.push(wall("sign", 0.85, 0.5), wall("lamp", 0.9, -0.5));
    if (step === 1) {
      parts.push(
        { part: "barrel", angle, height: 0, out: 0.8, along: 0.1 },
        { part: "openBarrel", angle, height: 0, out: 0.8, along: -0.35 },
      );
    }
  }
  if (kind === "store") {
    if (step === 0) parts.push(wall("sign", 0.85, 0.5));
    else parts.push({ part: "awning", angle, height: 0.85, out: 1, along: 0 });
    if (step === -1) {
      parts.push({
        part: "crate",
        angle,
        height: 0,
        out: 0.85,
        along: 0,
        scale: 0.5,
      });
    }
  }
  return parts;
}
