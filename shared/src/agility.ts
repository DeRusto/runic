import type { HasInventory } from "./items.ts";
import { countOf } from "./making.ts";
import type { Tile, TileKind } from "./region.ts";
import { levelFor } from "./skills.ts";

/**
 * What makes an obstacle a shortcut (Agility spec §3): the Agility `level` it needs, the hit a
 * failed crossing deals in hundredths of a Hitpoints level, and whether it must first be rigged
 * with a rope.
 */
export type ShortcutRule = { level: number; failHit: number; rope: boolean };

/**
 * One obstacle: its crossing time in `ticks`, the experience a landing pays, and the landing's
 * offset from the placed start. A shortcut can be crossed from either end; a course obstacle only
 * from its start.
 */
export type Obstacle = {
  name: string;
  ticks: number;
  xp: number;
  dx: number;
  dy: number;
  shortcut?: ShortcutRule;
};

/** The Southfield course (Agility spec §2) and the shortcuts (§3). */
const OBSTACLE_ROWS = {
  balanceBeam: { name: "Balance beam", ticks: 4, xp: 30, dx: 2, dy: 0 },
  hurdle: { name: "Hurdle", ticks: 3, xp: 25, dx: 0, dy: 2 },
  steppingStones: { name: "Stepping stones", ticks: 5, xp: 35, dx: -2, dy: 0 },
  crawlRail: { name: "Crawl rail", ticks: 4, xp: 30, dx: 0, dy: -2 },
  ridgeStile: {
    name: "Ridge stile",
    ticks: 4,
    xp: 20,
    dx: 2,
    dy: 0,
    shortcut: { level: 10, failHit: 100, rope: false },
  },
  brambleSwing: {
    name: "Bramble swing",
    ticks: 5,
    xp: 35,
    dx: -3,
    dy: 0,
    shortcut: { level: 20, failHit: 150, rope: true },
  },
  charredFence: {
    name: "Charred fence",
    ticks: 4,
    xp: 50,
    dx: 0,
    dy: 2,
    shortcut: { level: 30, failHit: 200, rope: false },
  },
  ruinLedge: {
    name: "Ruin ledge",
    ticks: 5,
    xp: 75,
    dx: 2,
    dy: 0,
    shortcut: { level: 45, failHit: 250, rope: false },
  },
  cragLine: {
    name: "Crag line",
    ticks: 6,
    xp: 100,
    dx: 0,
    dy: -3,
    shortcut: { level: 60, failHit: 300, rope: true },
  },
} as const satisfies Record<string, Obstacle>;

export type ObstacleKind = keyof typeof OBSTACLE_ROWS;

/** Every obstacle by kind, read through the common row type so optional fields can be checked. */
export const OBSTACLES: Record<ObstacleKind, Obstacle> = OBSTACLE_ROWS;

/** The order in which crossings count toward a Southfield lap. */
export const COURSE_ORDER: readonly ObstacleKind[] = [
  "balanceBeam",
  "hurdle",
  "steppingStones",
  "crawlRail",
];

/** The obstacles that lead somewhere, lowest level first. */
export const SHORTCUTS = (Object.keys(OBSTACLES) as ObstacleKind[]).filter(
  (kind) => OBSTACLES[kind].shortcut,
);

/** Extra Agility experience for crossing every course obstacle in order. */
export const COURSE_LAP_XP = 80;

/** The chance a shortcut crossing fails at exactly its required level (Agility spec §4). */
export const SHORTCUT_FAIL_PERCENT_AT_REQUIREMENT = 25;

/** Levels above a shortcut's requirement at which it stops failing (Agility spec §4). */
export const SURE_FOOTED_LEVELS = 10;

/** The rope item that rigs a shortcut. */
export const RIGGING_ITEM = "rope";

/** Whether an untrusted value names an obstacle. */
export const isObstacleKind = (kind: unknown): kind is ObstacleKind =>
  typeof kind === "string" && Object.hasOwn(OBSTACLES, kind);

/** The landing tile given an obstacle and its placed start. */
export function obstacleLanding(kind: ObstacleKind, start: Tile): Tile {
  const { dx, dy } = OBSTACLES[kind];
  return { x: start.x + dx, y: start.y + dy };
}

/** The crossing a player standing on `at` would make: from a placed start, or back from a shortcut's far end. */
export function crossingFrom(
  { obstacle, obstacleEnd }: TileKind,
  at: Tile,
): { obstacle: ObstacleKind; landing: Tile } | undefined {
  if (obstacle) return { obstacle, landing: obstacleLanding(obstacle, at) };
  if (!obstacleEnd) return undefined;
  const { dx, dy } = OBSTACLES[obstacleEnd];
  return { obstacle: obstacleEnd, landing: { x: at.x - dx, y: at.y - dy } };
}

/** The chance, in percent, that a crossing fails: falling evenly from 25 at the requirement to 0. */
export function shortcutFailPercent(kind: ObstacleKind, agilityXp: number) {
  const rule = OBSTACLES[kind].shortcut;
  if (!rule) return 0;
  const above = levelFor(agilityXp) - rule.level;
  const levelsShort = Math.max(0, SURE_FOOTED_LEVELS - above);
  return (
    (SHORTCUT_FAIL_PERCENT_AT_REQUIREMENT * levelsShort) / SURE_FOOTED_LEVELS
  );
}

/** What `crossRefusal` reads about the player. */
export type Crosser = HasInventory & {
  agilityXp: number;
  riggedShortcuts: Iterable<string>;
};

/** Why a player can't cross this obstacle, or undefined if they can. */
export function crossRefusal(kind: ObstacleKind, player: Crosser) {
  const { name, shortcut } = OBSTACLES[kind];
  if (!shortcut) return undefined;
  const called = name.toLowerCase();
  if (levelFor(player.agilityXp) < shortcut.level)
    return `You need Agility ${shortcut.level} to cross the ${called}.`;
  if (
    shortcut.rope &&
    ![...player.riggedShortcuts].includes(kind) &&
    countOf(RIGGING_ITEM, player) < 1
  )
    return `You need a rope to rig the ${called}.`;
  return undefined;
}
