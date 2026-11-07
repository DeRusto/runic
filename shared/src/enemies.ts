export type EnemyKind = "spider" | "skeleton";
export type EnemyState = "idle" | "fighting" | "going home" | "dead";

/** Hit chances are 0..1, per Defense level above 1. Damage on a hit is 1..maxDamage. */
type EnemyStats = {
  health: number;
  hitChance: number;
  hitChancePerDefenseLevel: number;
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
    health: 8,
    hitChance: 0.35,
    hitChancePerDefenseLevel: -0.002,
    maxDamage: 2,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0.1,
    wanderTiles: 5,
    leashTiles: 4,
  },
  skeleton: {
    health: 24,
    hitChance: 0.55,
    hitChancePerDefenseLevel: -0.003,
    maxDamage: 5,
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
