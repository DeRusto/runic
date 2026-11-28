import { levelFor } from "./skills.ts";

/** Prayer points of drain are counted per this many ticks, one minute (Prayer spec §5). */
export const PRAYER_DRAIN_TICKS = 200;

/** The three boost ladders: Accuracy adds points to land, Might adds to a landed hit, Avoidance adds Avoidance (Prayer spec §5). */
export type PrayerLadder = "accuracy" | "might" | "avoidance";

type Boost = {
  name: string;
  ladder: PrayerLadder;
  step: number;
  level: number;
  /** Points to land, hit in hundredths, or Avoidance points, by ladder. */
  amount: number;
  /** Points per `PRAYER_DRAIN_TICKS`. */
  drain: number;
  effect: string;
};

type Ward = {
  name: string;
  ladder: "ward";
  level: number;
  drain: number;
  effect: string;
};

const boost = (
  name: string,
  ladder: PrayerLadder,
  step: number,
  level: number,
  amount: number,
): Boost => ({
  name,
  ladder,
  step,
  level,
  amount,
  drain: 10 * step,
  effect:
    ladder === "accuracy"
      ? `+${amount} points to land`
      : ladder === "might"
        ? `+${amount} hit`
        : `+${amount} Avoidance`,
});

const ward = (name: string, level: number, style: string): Ward => ({
  name,
  ladder: "ward",
  level,
  drain: 40,
  effect: `Halves ${style} enemies' landed hits`,
});

/** The twelve prayers; names, levels, amounts and drains from Spec: Prayer (#326). The wards are listed but not built yet. */
export const PRAYERS = {
  sureHand: boost("Sure Hand", "accuracy", 1, 1, 3),
  firmGrip: boost("Firm Grip", "might", 1, 4, 50),
  lightStep: boost("Light Step", "avoidance", 1, 7, 3),
  trueAim: boost("True Aim", "accuracy", 2, 10, 6),
  stoneFist: boost("Stone Fist", "might", 2, 13, 100),
  quickShadow: boost("Quick Shadow", "avoidance", 2, 16, 6),
  farSight: boost("Far Sight", "accuracy", 3, 20, 10),
  giantsWrath: boost("Giant's Wrath", "might", 3, 22, 150),
  mistWalker: boost("Mist Walker", "avoidance", 3, 25, 10),
  wardOfArrows: ward("Ward of Arrows", 28, "ranged"),
  wardOfSteel: ward("Ward of Steel", 31, "melee"),
  wardOfRunes: ward("Ward of Runes", 34, "magic"),
} satisfies Record<string, Boost | Ward>;

export type PrayerId = keyof typeof PRAYERS;

/** A prayer that can be turned on today: one of the nine boosts. */
export type BoostPrayer = {
  [P in PrayerId]: (typeof PRAYERS)[P] extends Boost ? P : never;
}[PrayerId];

/** Whether `prayer`, straight off the network, names a boost prayer. */
export const isBoostPrayer = (prayer: unknown): prayer is BoostPrayer =>
  typeof prayer === "string" &&
  Object.hasOwn(PRAYERS, prayer) &&
  PRAYERS[prayer as PrayerId].ladder !== "ward";

/** Every prayer, lowest level first, as the Prayer tab lists them. */
export const prayersInLevelOrder = () =>
  (Object.keys(PRAYERS) as PrayerId[]).sort(
    (a, b) => PRAYERS[a].level - PRAYERS[b].level,
  );

/** Why the player can't turn `prayer` on, or undefined if they can. Turning one off is never refused. */
export const prayerRefusal = (
  player: { prayerXp: number; prayerPoints: number },
  prayer: PrayerId,
) =>
  levelFor(player.prayerXp) < PRAYERS[prayer].level
    ? `You need Prayer ${PRAYERS[prayer].level} for that.`
    : player.prayerPoints === 0
      ? "You have no prayer points left. Pray at a shrine to refill them."
      : undefined;

/** The line when drain empties the pool and every prayer switches off. */
export const OUT_OF_PRAYER_LINE =
  "You have run out of prayer points. Your prayers fade.";

/** The active prayers after a click on `prayer`: off if it was on, else on, turning off the other step of its ladder. */
export function prayersAfterToggle(
  active: readonly string[],
  prayer: BoostPrayer,
): string[] {
  if (active.includes(prayer)) return active.filter((on) => on !== prayer);
  const { ladder } = PRAYERS[prayer];
  return [
    ...active.filter((on) => PRAYERS[on as PrayerId]?.ladder !== ladder),
    prayer,
  ];
}

/** The amount the active step of `ladder` adds, or 0 with none of it on. */
export const prayerBoostOf = (
  active: readonly string[],
  ladder: PrayerLadder,
) =>
  active.reduce((total, on) => {
    const prayer = isBoostPrayer(on) ? PRAYERS[on] : undefined;
    return prayer?.ladder === ladder ? total + prayer.amount : total;
  }, 0);

/**
 * One tick of drain: every active prayer adds its drain to `carried`, and each whole
 * `PRAYER_DRAIN_TICKS` of it costs a point, so the fraction carries and drain is exact over time.
 */
export function drainPrayerPoints(
  { points, carried }: { points: number; carried: number },
  active: readonly string[],
) {
  const total =
    carried +
    active.reduce((sum, on) => sum + (PRAYERS[on as PrayerId]?.drain ?? 0), 0);
  return {
    points: Math.max(0, points - Math.floor(total / PRAYER_DRAIN_TICKS)),
    carried: total % PRAYER_DRAIN_TICKS,
  };
}
