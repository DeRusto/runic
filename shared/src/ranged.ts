import { rollPlayerHit } from "./combat.ts";
import { gearOf, wornAccuracyOf, type GearSlot } from "./gear.ts";
import {
  HEALTH_PER_HITPOINTS_LEVEL,
  PLAYER_BASE_DAMAGE,
  PLAYER_HIT_CHANCE,
  PLAYER_HIT_CHANCE_PER_ATTACK_LEVEL,
  STRENGTH_LEVELS_PER_DAMAGE,
} from "./index.ts";
import { tilesApart, type Tile } from "./region.ts";
import { levelFor, type XpField } from "./skills.ts";
import { POINTS_PER_HIT_CHANCE } from "./stats.ts";
import { virtueOf } from "./virtues.ts";

type Worn = Partial<Record<GearSlot, string>>;

/** What the chat says when a bow has no arrows to fire, at the click or mid-fight (Ranged spec §3). */
export const OUT_OF_ARROWS_LINE = "You have no arrows left to fire.";

/** The reach and fire rate of the ranged weapon in hand, or undefined for a sword or bare hands, which fight in melee (#271). */
export function rangedWeaponOf(player: Worn) {
  const { reachTiles, intervalTicks } = gearOf(player.weapon ?? "") ?? {};
  return reachTiles === undefined || intervalTicks === undefined
    ? undefined
    : { reachTiles, intervalTicks };
}

/** Whether `to` is within `reachTiles` of `from`, a diagonal step counting as one tile (#270). Sight comes later. */
export const inReach = (from: Tile, to: Tile, reachTiles: number) =>
  tilesApart(from, to) <= reachTiles;

/**
 * A ranged shot's chance (0..1) to land, its max and its bonus: melee's curves read from Ranged
 * (#268, Ranged spec §3). Worn Accuracy is the bow's and the ring's; the bonus is the arrow's
 * hit bonus plus worn Might.
 */
export function rangedHitOf(player: { rangedXp: number } & Worn) {
  const level = levelFor(player.rangedXp);
  return {
    chance:
      PLAYER_HIT_CHANCE +
      PLAYER_HIT_CHANCE_PER_ATTACK_LEVEL * (level - 1) +
      wornAccuracyOf(player) / POINTS_PER_HIT_CHANCE,
    max:
      PLAYER_BASE_DAMAGE +
      HEALTH_PER_HITPOINTS_LEVEL *
        Math.floor(level / STRENGTH_LEVELS_PER_DAMAGE),
    gear:
      (gearOf(player.ammo ?? "")?.hitBonus ?? 0) + virtueOf(player, "might"),
  };
}

/**
 * One bow shot at an enemy with `enemyHealth` left, rolled as a swing is (see `rollPlayerHit`).
 * All its experience goes to Ranged, as Steady sends it until stances come, and Hitpoints gets
 * the same amount again (#268).
 */
export function rangedHit(
  player: { rangedXp: number; agilityXp: number } & Worn,
  mightBonus: number,
  enemyHealth: number,
  random: () => number,
) {
  const { damage, critical, xp } = rollPlayerHit(
    rangedHitOf(player),
    player.agilityXp,
    mightBonus,
    enemyHealth,
    random,
  );
  return {
    damage,
    critical,
    xp: [
      ["rangedXp", xp],
      ["hitpointsXp", xp],
    ] as [XpField, number][],
  };
}
