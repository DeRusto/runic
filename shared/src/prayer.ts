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

/** One burial takes two ticks after the action starts (Prayer spec §3). */
export const BURY_TICKS = 2;

const BURIAL_XP = new Map([
  ["bones", 5],
  ["heavyBones", 13],
]);

/** Prayer experience paid for the selected bone, if it is a bone (Prayer spec §3). */
export const burialXp = (item: string | undefined) =>
  item === undefined ? undefined : BURIAL_XP.get(item);
