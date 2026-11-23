import type { PropKind, Tile, TileKind } from "./region.ts";

/** The props a shot can't pass: trees, rocks, and Runestone Hollow's ruins (owner, 2026-11-23; Ranged spec §4). */
const TALL_PROPS: ReadonlySet<PropKind> = new Set([
  "tree",
  "rock",
  "column",
  "standingStone",
]);

/**
 * Whether a tile stops a shot: a house wall, a tree (prop or Woodcutting tree), a rock (prop, ore
 * vein or essence vein), a column or a standing stone. Every other tile lets it pass, doors,
 * water and bushes included (Ranged spec §4).
 */
export const isTall = (tile: TileKind) =>
  tile.house === "wall" ||
  !!tile.tree ||
  !!tile.vein ||
  (tile.prop !== undefined && TALL_PROPS.has(tile.prop));

/**
 * Whether a straight line from the centre of `from` to the centre of `to` crosses no tall tile
 * (#270). A tile counts as crossed when the line touches it at all, even at one corner, so a
 * diagonal squeezing past the corner of a wall is blocked. The two end tiles never block, and the
 * answer is the same with the ends swapped, since it reads only the line between them.
 */
export function inSight(tiles: TileKind[][], from: Tile, to: Tile) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // A tile's square (half a tile each way from its centre) touches the line when the centre is at
  // most (|dx| + |dy|) / 2 from it, measured as the cross product; doubled to stay in integers.
  const reach = Math.abs(dx) + Math.abs(dy);
  for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++)
    for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) {
      if ((x === from.x && y === from.y) || (x === to.x && y === to.y))
        continue;
      const cross = dx * (y - from.y) - dy * (x - from.x);
      const tile = tiles[y]?.[x];
      if (tile && 2 * Math.abs(cross) <= reach && isTall(tile)) return false;
    }
  return true;
}
