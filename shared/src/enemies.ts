/** Spec §5. Hit chances are 0..1, per Defense level above 1. Damage on a hit is 1..maxDamage. */
export const ENEMIES = {
  spider: {
    health: 8,
    hitChance: 0.35,
    hitChancePerDefenseLevel: -0.002,
    maxDamage: 2,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0.1,
    wanderTiles: 5,
  },
} as const;
export type EnemyKind = keyof typeof ENEMIES;
export type EnemyState = "idle" | "fighting" | "going home" | "dead";
