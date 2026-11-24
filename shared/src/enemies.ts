import type { ItemId } from "./items.ts";
import type { Style } from "./triangle.ts";

export type EnemyKind =
  | "spider"
  | "skeleton"
  | "tarnOx"
  | "bristleback"
  | "cinderhorn"
  | "skeletonMage"
  | "imp";
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

/** One bone item a damager can find, with a chance from 0 to 1. */
export type BoneDrop = { item: "bones" | "heavyBones"; chance: number };

// Combat drops spec §2.
const BONE_DROP_CHANCE = 2 / 3;

/** Hit chances are 0..1. Damage on a hit is any whole number from 100 to maxDamage. */
type EnemyStats = {
  health: number;
  hitChance: number;
  /** Points added to its chance to hit, against a player's Avoidance (spec §5). */
  accuracy: number;
  /** Its one fixed style, set against the player's by the combat triangle (#271). */
  style: Style;
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
  /** Rolled independently of the loot table for each damager. */
  bone?: BoneDrop;
};

/** Spec §5. */
export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  spider: {
    health: 800,
    hitChance: 0.35,
    accuracy: 0,
    style: "melee",
    maxDamage: 200,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0.1,
    wanderTiles: 5,
    leashTiles: 4,
    // Every player who damaged it finds 1 or 2 spider silk, even odds (#272, spec #293).
    loot: [
      {
        category: "material",
        chance: 1,
        items: [{ item: "spiderSilk", count: [1, 2] }],
      },
    ],
  },
  skeleton: {
    health: 2400,
    hitChance: 0.55,
    accuracy: 0,
    style: "melee",
    maxDamage: 500,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 200,
    wanderChance: 0.1,
    wanderTiles: 3,
    noticeTiles: 3,
    leashTiles: 4,
    bone: { item: "bones", chance: BONE_DROP_CHANCE },
    // Spec §4: one Emberbone in four, per player who damaged it.
    loot: [
      { category: "material", chance: 0.25, items: [{ item: "emberbone" }] },
    ],
  },
  // Runestone Hollow's (spec §5), first values to tune: a Skeleton Mage is a Skeleton that hits
  // harder and lasts longer, and fights in melee despite its name (#271), and an Imp is a quick,
  // weaker pest that notices from further off. A Mage drops Hollis's bone sigil, one kill in three,
  // and only to a player Hollis asks it of; Imps drop nothing yet.
  skeletonMage: {
    health: 3200,
    hitChance: 0.6,
    accuracy: 10,
    style: "melee",
    maxDamage: 650,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 200,
    wanderChance: 0.1,
    wanderTiles: 3,
    noticeTiles: 3,
    leashTiles: 4,
    bone: { item: "heavyBones", chance: BONE_DROP_CHANCE },
    loot: [
      { category: "quest", chance: 1 / 3, items: [{ item: "boneSigil" }] },
    ],
  },
  imp: {
    health: 1200,
    hitChance: 0.5,
    accuracy: 0,
    style: "melee",
    maxDamage: 300,
    swingIntervalTicks: 6,
    firstSwingDelayTicks: 3,
    returnTicks: 150,
    wanderChance: 0.15,
    wanderTiles: 5,
    noticeTiles: 4,
    leashTiles: 5,
    loot: [],
  },
  // #238's three hide creatures, on the hide bands 1/10/20. The Tarn Ox is docile: it never
  // fights back, leashes or wanders, so each swing against it is free. The ticket's 10/25/50 Hitpoints levels of health would pay
  // 60/150/300 by spec §5's 6-experience-per-100 rule, above a Spider and Skeleton, so the
  // healths here are the 2/5/10 levels whose kills pay the ticket's own 12/30/60, a few
  // hits each.
  tarnOx: {
    health: 200,
    hitChance: 0,
    accuracy: 0,
    style: "melee",
    maxDamage: 0,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0,
    wanderTiles: 0,
    leashTiles: 0,
    docile: true,
    bone: { item: "bones", chance: BONE_DROP_CHANCE },
    // Every player who damaged it finds its hide (#238).
    loot: [{ category: "material", chance: 1, items: [{ item: "tarnHide" }] }],
  },
  // Bristleback and Cinderhorn fight back once hit, like a Spider, but never start a fight,
  // never wander, and chase only a couple of tiles. Their numbers fit their hide bands 10 and
  // 20 (#297), so a player of that band meets a fair fight rather than a few free hits.
  bristleback: {
    health: 1400,
    hitChance: 0.4,
    accuracy: 0,
    style: "melee",
    maxDamage: 300,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 150,
    wanderChance: 0,
    wanderTiles: 0,
    leashTiles: 2,
    bone: { item: "bones", chance: BONE_DROP_CHANCE },
    // Every player who damaged it finds its hide (#238).
    loot: [
      { category: "material", chance: 1, items: [{ item: "bristleHide" }] },
    ],
  },
  cinderhorn: {
    health: 2600,
    hitChance: 0.5,
    accuracy: 0,
    style: "melee",
    maxDamage: 450,
    swingIntervalTicks: 8,
    firstSwingDelayTicks: 4,
    returnTicks: 200,
    wanderChance: 0,
    wanderTiles: 0,
    leashTiles: 2,
    bone: { item: "heavyBones", chance: BONE_DROP_CHANCE },
    // Every player who damaged it finds its hide (#238).
    loot: [
      { category: "material", chance: 1, items: [{ item: "cinderHide" }] },
    ],
  },
};
