import {
  crossingFrom,
  OBSTACLES,
  shortcutFailPercent,
  TICK_MS,
  type Tile,
  type TileKind,
} from "@runic/shared";

/**
 * Where a figure crossing from `at` heads while the crossing lasts, and for how long. A crossing
 * that can't fail heads for its landing. One that can stops halfway, and the landing patch then
 * moves the figure on or back: the client never shows an outcome the server hasn't decided (ADR 0001).
 */
export function crossingShown(
  tile: TileKind,
  at: Tile,
  agilityXp: number,
): { landing: Tile; ms: number } | undefined {
  const crossing = crossingFrom(tile, at);
  if (!crossing) return undefined;
  const { obstacle, landing } = crossing;
  const ms = OBSTACLES[obstacle].ticks * TICK_MS;
  if (!shortcutFailPercent(obstacle, agilityXp)) return { landing, ms };
  return {
    landing: { x: (at.x + landing.x) / 2, y: (at.y + landing.y) / 2 },
    ms,
  };
}
