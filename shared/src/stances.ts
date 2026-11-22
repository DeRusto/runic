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
