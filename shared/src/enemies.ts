export type EnemyKind = "spider" | "skeleton";
export type EnemyState = "idle" | "fighting" | "going home" | "dead";

/** Hit chances are 0..1. Damage on a hit is any whole number from 100 to maxDamage. */
type EnemyStats = {
  health: number;
  hitChance: number;
  /** Points added to its chance to hit, against a player's Avoidance (spec §5). */
  accuracy: number;
  maxDamage: number;
  swingIntervalTicks: number;
  firstSwingDelayTicks: number;
  returnTicks: number;
  wanderChance: number;
  wanderTiles: number;
  leashTiles: number;
  /** Only an enemy with this attacks first. */
  noticeTiles?: number;
  /** Per player who damaged it. */
  emberboneChance?: number;
};

/** Spec §5. */
export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  spider: {
    health: 800,
    hitChance: 0.35,
    accuracy: 0,
    maxDamage: 200,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0.1,
    wanderTiles: 5,
    leashTiles: 4,
  },
  skeleton: {
    health: 2400,
    hitChance: 0.55,
    accuracy: 0,
    maxDamage: 500,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 200,
    wanderChance: 0.1,
    wanderTiles: 3,
    noticeTiles: 3,
    leashTiles: 4,
    emberboneChance: 0.25,
  },
};
