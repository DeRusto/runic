/** Refused everywhere until Phase 12 lifts each where its rules allow (Phase 4 map). */
const NOT_YET = {
  Trade: "Trading isn't here yet.",
  Attack: "You can't attack here.",
  Duel: "Duelling isn't here yet.",
} as const;

/** Why a player menu option does nothing, or undefined for one that goes ahead. */
export const playerOptionRefusal = (option: string): string | undefined =>
  Object.hasOwn(NOT_YET, option)
    ? NOT_YET[option as keyof typeof NOT_YET]
    : undefined;
