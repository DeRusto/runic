import type { ItemId } from "./items.ts";

export type EnemyKind =
  "spider" | "skeleton" | "tarnOx" | "bristleback" | "cinderhorn";
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
  /** Set on #238's docile creatures: they never fight back, never leash and never wander — they stand where they are while they are hit. */
  docile?: true;
  /** The hide every player who damaged it finds on the ground when it dies, at 100% (#238). */
  hide?: ItemId;
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
  // #238's three docile creatures, on the hide bands 1/10/20. Their combat tuning is
  // Phase 8's: they never fight back, never leash and never wander — they stand, and each
  // swing against them is free. The ticket's 10/25/50 Hitpoints levels of health would pay
  // 60/150/300 by spec §5's 6-experience-per-100 rule, above a Spider and Skeleton, so the
  // healths here are the 2/5/10 levels whose kills pay the ticket's own 12/30/60, a few
  // hits each.
  tarnOx: {
    health: 200,
    hitChance: 0,
    accuracy: 0,
    maxDamage: 0,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0,
    wanderTiles: 0,
    leashTiles: 0,
    docile: true,
    hide: "tarnHide",
  },
  bristleback: {
    health: 500,
    hitChance: 0,
    accuracy: 0,
    maxDamage: 0,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0,
    wanderTiles: 0,
    leashTiles: 0,
    docile: true,
    hide: "bristleHide",
  },
  cinderhorn: {
    health: 1000,
    hitChance: 0,
    accuracy: 0,
    maxDamage: 0,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 200,
    wanderChance: 0,
    wanderTiles: 0,
    leashTiles: 0,
    docile: true,
    hide: "cinderHide",
  },
};
