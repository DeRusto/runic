import type { Tile } from "./region.ts";

/** The obstacles in the Southfield course, in lap order (Agility spec §2). */
export const OBSTACLES = {
  balanceBeam: { name: "Balance beam", ticks: 4, xp: 30, dx: 2, dy: 0 },
  hurdle: { name: "Hurdle", ticks: 3, xp: 25, dx: 0, dy: 2 },
  steppingStones: { name: "Stepping stones", ticks: 5, xp: 35, dx: -2, dy: 0 },
  crawlRail: { name: "Crawl rail", ticks: 4, xp: 30, dx: 0, dy: -2 },
} as const;

export type ObstacleKind = keyof typeof OBSTACLES;

/** The order in which crossings count toward a Southfield lap. */
export const COURSE_ORDER: readonly ObstacleKind[] = [
  "balanceBeam",
  "hurdle",
  "steppingStones",
  "crawlRail",
];

/** Extra Agility experience for crossing every course obstacle in order. */
export const COURSE_LAP_XP = 80;

/** Whether an untrusted value names an obstacle. */
export const isObstacleKind = (kind: unknown): kind is ObstacleKind =>
  typeof kind === "string" && Object.hasOwn(OBSTACLES, kind);

/** The landing tile given an obstacle and its placed start. */
export function obstacleLanding(kind: ObstacleKind, start: Tile): Tile {
  const { dx, dy } = OBSTACLES[kind];
  return { x: start.x + dx, y: start.y + dy };
}
