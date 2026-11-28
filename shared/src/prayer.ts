import { levelFor } from "./skills.ts";

/** A Prayer level adds ten points to the pool (Prayer spec §2). */
export const PRAYER_POINTS_PER_LEVEL = 10;

/** One point returns every twenty ticks while no prayer is active (Prayer spec §2). */
export const PRAYER_REGEN_INTERVAL_TICKS = 20;

/** The pool maximum for the given Prayer experience. */
export const maxPrayerPoints = (prayerXp: number) =>
  levelFor(prayerXp) * PRAYER_POINTS_PER_LEVEL;

/** Recovers one point on a regeneration tick, capped at the player's maximum. */
export const regeneratePrayerPoints = (
  points: number,
  prayerXp: number,
  tick: number,
) =>
  tick % PRAYER_REGEN_INTERVAL_TICKS === 0
    ? Math.min(points + 1, maxPrayerPoints(prayerXp))
    : points;

/** Praying at a shrine restores twenty points a tick (Prayer spec §4). */
export const SHRINE_POINTS_PER_TICK = 20;

/** The points after one tick of praying at a shrine, capped at the player's maximum. */
export const shrinePrayerPoints = (points: number, prayerXp: number) =>
  Math.min(points + SHRINE_POINTS_PER_TICK, maxPrayerPoints(prayerXp));

/** One burial takes two ticks after the action starts (Prayer spec §3). */
export const BURY_TICKS = 2;

const BURIAL_XP = new Map([
  ["bones", 5],
  ["heavyBones", 13],
]);

/** Prayer experience paid for the selected bone, if it is a bone (Prayer spec §3). */
export const burialXp = (item: string | undefined) =>
  item === undefined ? undefined : BURIAL_XP.get(item);

/** Each offering at a shrine takes two ticks, like a burial (Prayer spec §4). */
export const OFFER_TICKS = 2;

/** Offering pays three times what burying does (Prayer spec §4). */
const OFFERING_XP = new Map([
  ["bones", 15],
  ["heavyBones", 40],
]);

/** The first bone in bag order and what offering it pays, or undefined with none left. */
export function nextOffering(
  inventory: ArrayLike<string>,
  counts: ArrayLike<number>,
) {
  for (let slot = 0; slot < inventory.length; slot++) {
    const xp = OFFERING_XP.get(inventory[slot]!);
    if (xp !== undefined && counts[slot]) return { slot, xp };
  }
}

/** Why a player can't start offering bones, or undefined if they can. */
export const offeringRefusal = (player: {
  inventory: ArrayLike<string>;
  inventoryCounts: ArrayLike<number>;
}) =>
  nextOffering(player.inventory, player.inventoryCounts)
    ? undefined
    : "You have no bones to offer.";
