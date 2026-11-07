import type { TileKind } from "@runic/shared";

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
};
export type HousePart = {
  part: keyof typeof HOUSE_MODELS;
  angle: number;
  height: number;
};

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

  if (sides.length > 1) {
    parts.push(
      { part: "wall", angle: 0, height: 0 },
      { part: "wall", angle: 0, height: 1 },
    );
  } else {
    const { angle } = sides[0]!;
    if (door) {
      parts.push(
        { part: "doorway", angle, height: 0 },
        { part: "door", angle, height: 0 },
      );
    } else {
      parts.push({ part: "window", angle, height: 0 });
    }
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
  parts.push({ part: "roof", angle: eave.angle, height: WALL_HEIGHT });
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
