import { ELITE_ACCURACY_POINTS } from "./elites.ts";
import { ENEMIES, type EnemyKind } from "./enemies.ts";
import {
  AVOIDANCE_TENTHS_PER_POINT,
  baseAvoidanceTenthsOf,
  BLOCK_CHANCE_PER_BLOCKING_LEVEL,
  gearOf,
  wornAccuracyOf,
  type GearSlot,
} from "./gear.ts";
import { variantAvoidanceOf, virtueOf } from "./virtues.ts";
import {
  HEALTH_PER_HITPOINTS_LEVEL,
  PLAYER_BASE_DAMAGE,
  PLAYER_HIT_CHANCE,
  PLAYER_HIT_CHANCE_PER_ATTACK_LEVEL,
  STRENGTH_LEVELS_PER_DAMAGE,
} from "./index.ts";
import { levelFor } from "./skills.ts";
import { trianglePointsOf, type Style } from "./triangle.ts";

type Worn = Partial<Record<GearSlot, string>>;

/** Avoidance points per Defense level above 1; a point is one percentage point off an enemy's chance to hit (spec §5). */
export const AVOIDANCE_POINTS_PER_DEFENSE_LEVEL = 0.25;
/** The Accuracy and Avoidance points in a whole chance to hit (1). */
const POINTS_PER_HIT_CHANCE = 100;
/** No enemy's chance to hit goes below this, so nothing is unhittable (spec §5). */
export const MIN_ENEMY_HIT_CHANCE = 0.05;

/** The Hitpoints and worn-Fortitude parts of a player's max health (spec §2 of improved items). */
export const maxHealthOf = (player: { hitpointsXp: number } & Worn) => ({
  skill: levelFor(player.hitpointsXp) * HEALTH_PER_HITPOINTS_LEVEL,
  gear: virtueOf(player, "fortitude"),
});

/** The Defense and worn-gear parts of a player's Avoidance, in points (spec §5). A gossamer cloak's variant adds its own tenths, and an amulet's Avoidance is its own stat (#217). */
export const avoidanceOf = (player: { defenseXp: number } & Worn) => ({
  skill: AVOIDANCE_POINTS_PER_DEFENSE_LEVEL * (levelFor(player.defenseXp) - 1),
  gear:
    (virtueOf(player, "avoidance") +
      variantAvoidanceOf(player) +
      baseAvoidanceTenthsOf(player)) /
    AVOIDANCE_TENTHS_PER_POINT,
});

/** Keeps a chance to land on the scale: no more than a whole chance, and no less than `floor`. */
const onScale = (chance: number, floor: number) =>
  Math.min(1, Math.max(floor, chance));

/**
 * An enemy's chance (0..1) to hit a player with `avoidance` points who fights in `playerStyle`:
 * base plus Accuracy and triangle points, less Avoidance and any Accuracy penalty,
 * floored at 5% (spec §5, #271, Magic spec §8).
 */
export const enemyHitChance = (
  kind: EnemyKind,
  avoidance: number,
  playerStyle: Style,
  elite = false,
  accuracyPenalty = 0,
) =>
  onScale(
    ENEMIES[kind].hitChance +
      (ENEMIES[kind].accuracy +
        (elite ? ELITE_ACCURACY_POINTS : 0) +
        trianglePointsOf(ENEMIES[kind].style, playerStyle) -
        avoidance -
        accuracyPenalty) /
        POINTS_PER_HIT_CHANCE,
    MIN_ENEMY_HIT_CHANCE,
  );

/** A player's `chance` (0..1) to land, moved by the combat triangle for a `style` fighter against an `against` one and by `accuracyBonus` points (an Accuracy prayer's), and kept on the scale (#271, Prayer spec §5). */
export const landChanceOf = (
  chance: number,
  style: Style,
  against: Style,
  accuracyBonus = 0,
) =>
  onScale(
    chance +
      (trianglePointsOf(style, against) + accuracyBonus) /
        POINTS_PER_HIT_CHANCE,
    0,
  );

/**
 * The hit curves every style shares, from the level that lands hits and the level that sets
 * the max: a chance (0..1) of 40% plus 0.5 points a level above 1 plus worn Accuracy (#238's
 * rings, a bow's), a point being a percentage point (spec §5), and a landed hit from 100 to
 * 200 plus 100 every 20 levels (melee rework spec §2, Ranged spec §4).
 */
export const hitCurvesOf = (
  landLevel: number,
  maxLevel: number,
  player: Worn,
) => ({
  chance:
    PLAYER_HIT_CHANCE +
    PLAYER_HIT_CHANCE_PER_ATTACK_LEVEL * (landLevel - 1) +
    wornAccuracyOf(player) / POINTS_PER_HIT_CHANCE,
  min: HEALTH_PER_HITPOINTS_LEVEL,
  max:
    PLAYER_BASE_DAMAGE +
    HEALTH_PER_HITPOINTS_LEVEL *
      Math.floor(maxLevel / STRENGTH_LEVELS_PER_DAMAGE),
});

/** A swing's curves, landing on Attack with its max from Strength, and the weapon's hit bonus plus Might, which adds to both ends (melee rework spec §2). */
export function hitOf(player: { attackXp: number; strengthXp: number } & Worn) {
  return {
    ...hitCurvesOf(
      levelFor(player.attackXp),
      levelFor(player.strengthXp),
      player,
    ),
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
