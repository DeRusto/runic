import { rollPlayerHit } from "./combat.ts";
import { gearOf, type GearSlot } from "./gear.ts";
import { tilesApart, type Tile, type TileKind } from "./region.ts";
import { inSight } from "./sight.ts";
import { levelFor, type XpField } from "./skills.ts";
import {
  RANGED_STANCES,
  rangedXpOf,
  STARTING_RANGED_STANCE,
  type RangedStance,
} from "./stances.ts";
import { hitCurvesOf } from "./stats.ts";
import { virtueOf } from "./virtues.ts";

type Worn = Partial<Record<GearSlot, string>>;

/** Chance to recover the ammo spent on a miss (Ranged spec §7). */
export const AMMO_RECOVERY_CHANCE = 0.5;

/** What the chat says when a bow has no arrows to fire, at the click or mid-fight (Ranged spec §4). */
export const OUT_OF_ARROWS_LINE = "You have no arrows left to fire.";

/** What the chat says when the last throwing knife in hand is thrown (Ranged spec §5). */
export const OUT_OF_KNIVES_LINE = "You have no throwing knives left to throw.";

/**
 * The reach and fire rate of the ranged weapon in hand under the player's Ranged stance (Steady
 * when none is given), and whether it is `thrown`, spending itself as throwing knives do;
 * undefined for a sword or bare hands, which fight in melee (#271, Ranged spec §6).
 */
export function rangedWeaponOf(player: Worn & { rangedStance?: RangedStance }) {
  const { reachTiles, intervalTicks, thrown } =
    gearOf(player.weapon ?? "") ?? {};
  if (reachTiles === undefined || intervalTicks === undefined) return undefined;
  const { furtherTiles, fasterTicks } =
    RANGED_STANCES[player.rangedStance ?? STARTING_RANGED_STANCE];
  return {
    reachTiles: reachTiles + furtherTiles,
    intervalTicks: intervalTicks - fasterTicks,
    thrown: !!thrown,
  };
}

/** The slot a ranged weapon's shot spends from: the weapon slot for knives, the ammo slot for a bow (Ranged spec §4, §5). */
const spentSlotOf = (player: Worn): GearSlot =>
  rangedWeaponOf(player)?.thrown ? "weapon" : "ammo";

/** Why the weapon in hand can't attack: a bow with an empty ammo slot (Ranged spec §4). Undefined when it can, melee and knives included, as knives in hand are their own ammo. */
export const rangedAttackRefusal = (player: Worn) =>
  rangedWeaponOf(player) && !player[spentSlotOf(player)]
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
      (gearOf(player[spentSlotOf(player)] ?? "")?.hitBonus ?? 0) +
      virtueOf(player, "might"),
  };
}

/**
 * One bow shot or knife throw at an enemy with `enemyHealth` left, rolled as a swing is (see
 * `rollPlayerHit`). Its experience goes to Ranged and Defense as the Ranged stance splits it
 * (Steady when none is given), and Hitpoints gets the same amount again (#268).
 */
export function rangedHit(
  player: {
    rangedXp: number;
    agilityXp: number;
    rangedStance?: RangedStance;
  } & Worn,
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
  const { rangedXp, defenseXp } = rangedXpOf(
    player.rangedStance ?? STARTING_RANGED_STANCE,
    xp,
  );
  return {
    damage,
    critical,
    xp: [
      ["rangedXp", rangedXp],
      ["defenseXp", defenseXp],
      ["hitpointsXp", xp],
    ] as [XpField, number][],
  };
}
