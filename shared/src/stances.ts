/**
 * How a player fights in melee, which decides where a hit's melee experience goes (melee
 * rework spec §3). `attackPercent` is Attack's share; Strength takes the rest.
 */
export const STANCES = {
  balanced: {
    name: "Balanced",
    attackPercent: 50,
    trains: "Trains Attack and Strength evenly",
  },
  precise: { name: "Precise", attackPercent: 100, trains: "Trains Attack" },
  forceful: { name: "Forceful", attackPercent: 0, trains: "Trains Strength" },
} as const;
export type Stance = keyof typeof STANCES;

/** A new player's stance, and the save column's default. */
export const STARTING_STANCE: Stance = "balanced";

/** Whether an untrusted value names a stance. */
export const isStance = (value: unknown): value is Stance =>
  typeof value === "string" && Object.hasOwn(STANCES, value);

/** A hit's melee experience split by `stance`; Attack takes the odd point, so none is lost or added. */
export function meleeXpOf(stance: Stance, xp: number) {
  const attackXp = Math.ceil((xp * STANCES[stance].attackPercent) / 100);
  return { attackXp, strengthXp: xp - attackXp };
}

/**
 * How a player fights at range (Ranged spec §6). `rangedPercent` is Ranged's share of a hit's
 * ranged experience, Defense taking the rest (#268). `fasterTicks` comes off the weapon's
 * interval and `furtherTiles` adds to its reach, so each applies to a bow and knives alike (#270).
 */
export const RANGED_STANCES = {
  steady: {
    name: "Steady",
    rangedPercent: 100,
    fasterTicks: 0,
    furtherTiles: 0,
    trains: "Trains Ranged",
  },
  rapid: {
    name: "Rapid",
    rangedPercent: 100,
    fasterTicks: 2,
    furtherTiles: 0,
    trains: "Trains Ranged, and attacks 2 ticks sooner",
  },
  longrange: {
    name: "Longrange",
    rangedPercent: 50,
    fasterTicks: 0,
    furtherTiles: 2,
    trains: "Trains Ranged and Defense evenly, and reaches 2 tiles further",
  },
} as const;
export type RangedStance = keyof typeof RANGED_STANCES;

/** Every player's Ranged stance until they choose, and the save column's default (#280). */
export const STARTING_RANGED_STANCE: RangedStance = "steady";

/** Whether an untrusted value names a Ranged stance. */
export const isRangedStance = (value: unknown): value is RangedStance =>
  typeof value === "string" && Object.hasOwn(RANGED_STANCES, value);

/** A hit's ranged experience split by `stance`; Ranged takes the odd point, as Attack does in melee, so none is lost or added. */
export function rangedXpOf(stance: RangedStance, xp: number) {
  const rangedXp = Math.ceil((xp * RANGED_STANCES[stance].rangedPercent) / 100);
  return { rangedXp, defenseXp: xp - rangedXp };
}
