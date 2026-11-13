import type { ItemId } from "./items.ts";

export type EnemyKind =
  "spider" | "skeleton" | "tarnOx" | "bristleback" | "cinderhorn";
export type EnemyState = "idle" | "fighting" | "going home" | "dead";

/** What a loot category is for. A label only for now: a quest category may later give only to players on its quest. */
export type LootCategory = "gear" | "material" | "quest";

/** One item a loot category can give: its weight against the category's others, and how many, fixed or a range. */
export type LootItem = {
  item: ItemId;
  /** Against the category's other items; 1 if left out. */
  weight?: number;
  /** How many one pick gives: a whole number, or an inclusive [min, max] range. 1 if left out. */
  count?: number | readonly [number, number];
};

/** One category of an enemy's loot table: up to `picks` items, each at `chance`, chosen by weight. */
export type LootCategoryRow = {
  category: LootCategory;
  /** 0..1, rolled once per pick. */
  chance: number;
  /** The most items it gives each player; 1 if left out. */
  picks?: number;
  items: readonly LootItem[];
};

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
  /** Set on #238's docile creatures: they never fight back, never leash and never wander — they stand where they are while they are hit. */
  docile?: true;
  /** What each player who damaged it rolls for when it dies. */
  loot: readonly LootCategoryRow[];
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
    // Spider silk waits for its own change (#217).
    loot: [],
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
    // Spec §4: one Emberbone in four, per player who damaged it.
    loot: [
      { category: "material", chance: 0.25, items: [{ item: "emberbone" }] },
    ],
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
    // Every player who damaged it finds its hide (#238).
    loot: [{ category: "material", chance: 1, items: [{ item: "tarnHide" }] }],
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
    // Every player who damaged it finds its hide (#238).
    loot: [
      { category: "material", chance: 1, items: [{ item: "bristleHide" }] },
    ],
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
    // Every player who damaged it finds its hide (#238).
    loot: [
      { category: "material", chance: 1, items: [{ item: "cinderHide" }] },
    ],
  },
};
