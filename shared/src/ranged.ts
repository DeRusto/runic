import { rollPlayerHit } from "./combat.ts";
import { gearOf, type GearSlot } from "./gear.ts";
import { tilesApart, type Tile, type TileKind } from "./region.ts";
import { inSight } from "./sight.ts";
import { levelFor, type XpField } from "./skills.ts";
import { hitCurvesOf } from "./stats.ts";
import { virtueOf } from "./virtues.ts";

type Worn = Partial<Record<GearSlot, string>>;

/** What the chat says when a bow has no arrows to fire, at the click or mid-fight (Ranged spec §4). */
export const OUT_OF_ARROWS_LINE = "You have no arrows left to fire.";

/** What the chat says when the last throwing knife in hand is thrown (Ranged spec §5). */
export const OUT_OF_KNIVES_LINE = "You have no throwing knives left to throw.";

/**
 * The reach and fire rate of the ranged weapon in hand, and whether it is `thrown`, spending
 * itself as throwing knives do; undefined for a sword or bare hands, which fight in melee (#271).
 */
export function rangedWeaponOf(player: Worn) {
  const { reachTiles, intervalTicks, thrown } =
    gearOf(player.weapon ?? "") ?? {};
  return reachTiles === undefined || intervalTicks === undefined
    ? undefined
    : { reachTiles, intervalTicks, thrown: !!thrown };
}

/** The slot a ranged weapon's shot spends from: the weapon slot for knives, the ammo slot for a bow (Ranged spec §4, §5). */
export const missileSlotOf = (player: Worn): GearSlot =>
  rangedWeaponOf(player)?.thrown ? "weapon" : "ammo";

/** Why the weapon in hand can't attack: a bow with an empty ammo slot (Ranged spec §4). Undefined when it can, melee and knives included, as knives in hand are their own ammo. */
export const rangedAttackRefusal = (player: Worn) =>
  rangedWeaponOf(player) && !player[missileSlotOf(player)]
    ? OUT_OF_ARROWS_LINE
    : undefined;

/** What the chat says when no tile the player can walk to has `to` both in reach and in sight (#278). */
export const NO_CLEAR_SHOT_LINE = "You can't get a clear shot at that.";

/** Whether `to` is within `reachTiles` of `from`, a diagonal step counting as one tile (#270). */
export const inReach = (from: Tile, to: Tile, reachTiles: number) =>
  tilesApart(from, to) <= reachTiles;

/** Whether a shot from `from` can fly to `to`: in reach, with no tall tile on the line between (#270, Ranged spec §4). */
export const canShootAt = (
  tiles: TileKind[][],
  from: Tile,
  to: Tile,
  reachTiles: number,
) => inReach(from, to, reachTiles) && inSight(tiles, from, to);

/**
 * A ranged shot's chance (0..1) to land, a landed shot's min and max, and its bonus: melee's curves read from Ranged
 * (#268, Ranged spec §4). Worn Accuracy is the bow's and the ring's; the bonus is the hit bonus
 * of what flies, the arrow or the knife (§5), plus worn Might.
 */
export function rangedHitOf(player: { rangedXp: number } & Worn) {
  const level = levelFor(player.rangedXp);
  return {
    ...hitCurvesOf(level, level, player),
    gear:
      (gearOf(player[missileSlotOf(player)] ?? "")?.hitBonus ?? 0) +
      virtueOf(player, "might"),
  };
}

/**
 * One bow shot or knife throw at an enemy with `enemyHealth` left, rolled as a swing is (see `rollPlayerHit`).
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
