import { ENEMIES, type EnemyKind } from "./enemies.ts";
import {
  AVOIDANCE_TENTHS_PER_POINT,
  BLOCK_CHANCE_PER_BLOCKING_LEVEL,
  gearOf,
  virtueOf,
  type GearSlot,
} from "./gear.ts";
import {
  COMBAT_LEVELS_PER_DAMAGE,
  HEALTH_PER_HITPOINTS_LEVEL,
  PLAYER_BASE_DAMAGE,
  PLAYER_HIT_CHANCE,
  PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL,
} from "./index.ts";
import { levelFor } from "./skills.ts";

type Worn = Partial<Record<GearSlot, string>>;

/** Avoidance points per Defense level above 1; a point is one percentage point off an enemy's chance to hit (spec §5). */
export const AVOIDANCE_POINTS_PER_DEFENSE_LEVEL = 0.25;
/** Avoidance and accuracy points in a whole chance to hit (1). */
const POINTS_PER_HIT_CHANCE = 100;
/** No enemy's chance to hit goes below this, so nothing is unhittable (spec §5). */
export const MIN_ENEMY_HIT_CHANCE = 0.05;

/** The Hitpoints and worn-Fortitude parts of a player's max health (spec §2 of improved items). */
export const maxHealthOf = (player: { hitpointsXp: number } & Worn) => ({
  skill: levelFor(player.hitpointsXp) * HEALTH_PER_HITPOINTS_LEVEL,
  gear: virtueOf(player, "fortitude"),
});

/** The Defense and worn-gear parts of a player's Avoidance, in points (spec §5). */
export const avoidanceOf = (player: { defenseXp: number } & Worn) => ({
  skill: AVOIDANCE_POINTS_PER_DEFENSE_LEVEL * (levelFor(player.defenseXp) - 1),
  gear: virtueOf(player, "avoidance") / AVOIDANCE_TENTHS_PER_POINT,
});

/** An enemy's chance (0..1) to hit a player with `avoidance` points: base + accuracy − Avoidance, floored (spec §5). */
export const enemyHitChance = (kind: EnemyKind, avoidance: number) =>
  Math.max(
    MIN_ENEMY_HIT_CHANCE,
    ENEMIES[kind].hitChance +
      (ENEMIES[kind].accuracy - avoidance) / POINTS_PER_HIT_CHANCE,
  );

/**
 * A player's chance (0..1) to land a swing, the landed hit's min and max from Combat, and the
 * weapon's hit bonus plus Might, which adds to both (spec §5).
 */
export function hitOf(player: { combatXp: number } & Worn) {
  const combat = levelFor(player.combatXp);
  return {
    chance:
      PLAYER_HIT_CHANCE + PLAYER_HIT_CHANCE_PER_COMBAT_LEVEL * (combat - 1),
    min: HEALTH_PER_HITPOINTS_LEVEL,
    max:
      PLAYER_BASE_DAMAGE +
      HEALTH_PER_HITPOINTS_LEVEL *
        Math.floor(combat / COMBAT_LEVELS_PER_DAMAGE),
    gear:
      (gearOf(player.weapon ?? "")?.hitBonus ?? 0) + virtueOf(player, "might"),
  };
}

/** The shield's and Blocking's parts of a player's chance (0..1) to block, or undefined with no shield (spec §5). */
export function blockOf(player: { blockingXp: number } & Worn) {
  const shield = gearOf(player.shield ?? "")?.blockChance;
  if (shield === undefined) return undefined;
  return {
    shield,
    skill: BLOCK_CHANCE_PER_BLOCKING_LEVEL * (levelFor(player.blockingXp) - 1),
  };
}
