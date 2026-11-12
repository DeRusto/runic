/** Spec §5, with #222's three potion plants at their pick gates. Picks and regrowth are per bush; `level` is the Herblaw level needed. */
export const BUSHES = {
  berryBush: { level: 1, holds: 5, regrowTicks: 84, xp: 10, item: "berry" },
  dewpetalBush: {
    level: 5,
    holds: 4,
    regrowTicks: 100,
    xp: 12,
    item: "dewpetal",
  },
  herbBush: { level: 10, holds: 3, regrowTicks: 150, xp: 25, item: "herb" },
  nightbloomBush: {
    level: 15,
    holds: 3,
    regrowTicks: 150,
    xp: 30,
    item: "nightbloom",
  },
  emberbloomBush: {
    level: 20,
    holds: 2,
    regrowTicks: 200,
    xp: 50,
    item: "emberbloom",
  },
} as const;
export type BushKind = keyof typeof BUSHES;
/**
 * What an item gives per healing tick, and for how many, when eaten; anything else isn't food
 * (#221). The berry is devalued now that the range cooks fish, and a herb is Cooking material,
 * not food. Looked up by an id's base, so a Delicious fish reads its common form.
 */
export const FOOD_HEALS = new Map([
  ["berry", { perTick: 25, ticks: 4 }],
  ["cookedPerch", { perTick: 200, ticks: 4 }],
  ["cookedTrout", { perTick: 300, ticks: 4 }],
  ["cookedPike", { perTick: 500, ticks: 4 }],
  ["berryPerch", { perTick: 250, ticks: 4 }],
  ["berryTrout", { perTick: 350, ticks: 4 }],
  ["berryPike", { perTick: 550, ticks: 4 }],
  ["herbPerch", { perTick: 300, ticks: 4 }],
  ["herbTrout", { perTick: 400, ticks: 4 }],
  ["herbPike", { perTick: 600, ticks: 4 }],
]);
