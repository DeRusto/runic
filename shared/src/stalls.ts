import { levelFor } from "./skills.ts";
import { pickByWeight, thievingFails, type LootRow } from "./thieving.ts";

/**
 * What stealing from each of Marta's stalls outside the general store needs and pays (#252,
 * Thieving spec §7): the Thieving level, the experience a theft pays, the loot table one roll
 * picks a row from by weight, and how long the stall stays empty for the thief after a theft.
 * A stall pays items, never coins.
 */
export const STALLS = {
  food: {
    level: 5,
    xp: 14,
    loot: [
      { item: "berry", fewest: 2, most: 4, weight: 3 },
      { item: "cookedPerch", fewest: 1, most: 1, weight: 1 },
    ],
    emptyTicks: 10,
  },
  fish: {
    level: 15,
    xp: 26,
    loot: [
      { item: "perch", fewest: 1, most: 2, weight: 6 },
      { item: "trout", fewest: 1, most: 1, weight: 3 },
      { item: "pike", fewest: 1, most: 1, weight: 1 },
    ],
    emptyTicks: 20,
  },
  gem: {
    level: 25,
    xp: 38,
    loot: [
      { item: "ashstone", fewest: 1, most: 1, weight: 6 },
      { item: "cinderglass", fewest: 1, most: 1, weight: 3 },
      { item: "heartflame", fewest: 1, most: 1, weight: 1 },
    ],
    emptyTicks: 50,
  },
} as const satisfies Record<
  string,
  { level: number; xp: number; loot: LootRow[]; emptyTicks: number }
>;
export type StallKind = keyof typeof STALLS;

/** How long a stall stays closed to a player Marta caught at it (#252, Thieving spec §7). Other stalls and players are unaffected. */
export const STALL_LOCKOUT_TICKS = 100;

/** Whether `kind`, off the network or a map, names one of the stalls. */
export const isStallKind = (kind: string): kind is StallKind =>
  Object.hasOwn(STALLS, kind);

/** A stall as messages name it: "the fish stall". */
export const stallName = (kind: StallKind) => `the ${kind} stall`;

/** Whether one theft from `kind` fails, on the same curve as a pickpocket (Thieving spec §1). */
export const stallFails = (
  kind: StallKind,
  thievingXp: number,
  random: () => number,
) => thievingFails(STALLS[kind].level, thievingXp, random);

/** What one theft takes: a row picked by weight, then an even pick of how many. */
export const stallLoot = (kind: StallKind, random: () => number) =>
  pickByWeight(STALLS[kind].loot, random);

/** Why a player can't steal from this stall, or undefined if they can. */
export const stallRefusal = (kind: StallKind, thievingXp: number) =>
  levelFor(thievingXp) < STALLS[kind].level
    ? `You need Thieving ${STALLS[kind].level} to steal from ${stallName(kind)}.`
    : undefined;
