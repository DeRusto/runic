import { neighbours, type Tile, type TileKind } from "@runic/shared";

/** The tiles one legal step from `from`. A diagonal needs both tiles beside it clear. */
export function legalSteps(tiles: TileKind[][], from: Tile): Tile[] {
  const clear = (x: number, y: number) => tiles[y]?.[x]?.blocks === false;
  return neighbours(from).filter(
    ({ x, y }) => clear(x, y) && clear(x, from.y) && clear(from.x, y),
  );
}

/**
 * The clear tiles next to `to` (spec D1), even when `to` itself blocks, as a bush does.
 * Same corner rule as legalSteps, which can't start on a blocking tile.
 */
export function tilesNextTo(tiles: TileKind[][], to: Tile): Tile[] {
  const clear = (x: number, y: number) => tiles[y]?.[x]?.blocks === false;
  return neighbours(to).filter(
    ({ x, y }) =>
      clear(x, y) &&
      (x === to.x || y === to.y || (clear(x, to.y) && clear(to.x, y))),
  );
}

/** The fewest steps to a tile next to `to`, or next to any of them, or undefined if none can be reached. */
export function pathNextTo(
  tiles: TileKind[][],
  from: Tile,
  to: Tile | Tile[],
): Tile[] | undefined {
  let best: Tile[] | undefined;
  for (const goal of [to].flat().flatMap((t) => tilesNextTo(tiles, t))) {
    const path = findPath(tiles, from, goal);
    const end = path.at(-1) ?? from;
    if (end.x !== goal.x || end.y !== goal.y) continue;
    if (!best || path.length < best.length) best = path;
  }
  return best;
}

/**
 * The tiles to step on, in order and not counting `from`: the fewest steps to `to`,
 * or to the reachable tile nearest it (spec §4).
 */
export function findPath(tiles: TileKind[][], from: Tile, to: Tile): Tile[] {
  const key = ({ x, y }: Tile) => y * tiles[0]!.length + x;
  const distance = ({ x, y }: Tile) => (x - to.x) ** 2 + (y - to.y) ** 2;

  const cameFrom = new Map<number, Tile>();
  const seen = new Set([key(from)]);
  const queue = [from];
  let nearest = from;
  // Breadth-first, so the first tile found at a distance is the fewest steps away.
  for (const tile of queue) {
    if (distance(tile) < distance(nearest)) nearest = tile;
    for (const next of legalSteps(tiles, tile)) {
      if (seen.has(key(next))) continue;
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
