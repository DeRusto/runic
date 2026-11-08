/** Spec §5. Picks and regrowth are per bush; `level` is the Foraging level needed. */
export const BUSHES = {
  berryBush: { level: 1, holds: 5, regrowTicks: 84, xp: 10, item: "berry" },
  herbBush: { level: 10, holds: 3, regrowTicks: 150, xp: 25, item: "herb" },
} as const;
export type BushKind = keyof typeof BUSHES;
/** What an item gives per healing tick, and for how many, when eaten; anything else isn't food. */
export const FOOD_HEALS = new Map([
  ["berry", { perTick: 100, ticks: 4 }],
  ["herb", { perTick: 200, ticks: 4 }],
]);
