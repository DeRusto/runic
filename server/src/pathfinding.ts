import type { Tile, TileKind } from "@runic/shared";

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

/**
 * The tiles to step on, in order and not counting `from`: the fewest steps to `to`,
 * or to the reachable tile nearest it (spec §4). A diagonal needs both tiles beside it clear.
 */
export function findPath(tiles: TileKind[][], from: Tile, to: Tile): Tile[] {
  const clear = (x: number, y: number) => tiles[y]?.[x]?.blocks === false;
  const key = ({ x, y }: Tile) => y * tiles[0]!.length + x;
  const distance = ({ x, y }: Tile) => (x - to.x) ** 2 + (y - to.y) ** 2;

  const cameFrom = new Map<number, Tile>();
  const seen = new Set([key(from)]);
  const queue = [from];
  let nearest = from;
  // Breadth-first, so the first tile found at a distance is the fewest steps away.
  for (const tile of queue) {
    if (distance(tile) < distance(nearest)) nearest = tile;
    for (const [dx, dy] of DIRECTIONS) {
      const next = { x: tile.x + dx, y: tile.y + dy };
      if (seen.has(key(next)) || !clear(next.x, next.y)) continue;
      if (!clear(next.x, tile.y) || !clear(tile.x, next.y)) continue;
      seen.add(key(next));
      cameFrom.set(key(next), tile);
      queue.push(next);
    }
  }

  const path: Tile[] = [];
  for (let at = nearest; at !== from; at = cameFrom.get(key(at))!) {
    path.unshift(at);
  }
  return path;
}
