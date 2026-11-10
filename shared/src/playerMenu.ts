/**
 * What right-clicking another player offers, in menu order, with each option's refusal. Trade,
 * Attack and Duel are refused everywhere until Phase 12 lifts each where its rules allow (Phase 4 map).
 */
export const PLAYER_OPTIONS = {
  Trade: "Trading isn't here yet.",
  Follow: undefined,
  Attack: "You can't attack here.",
  Examine: undefined,
  Message: undefined,
  Duel: "Duelling isn't here yet.",
} as const;
export type PlayerOption = keyof typeof PLAYER_OPTIONS;

/** Why a player menu option does nothing, or undefined for one that goes ahead. */
export const playerOptionRefusal = (option: PlayerOption): string | undefined =>
  PLAYER_OPTIONS[option];
