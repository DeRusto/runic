/** #208's starting numbers. Chops and regrowth are per tree; `level` is the Woodcutting level needed. No doubles, no finds. */
export const TREES = {
  birch: { level: 1, holds: 4, regrowTicks: 100, xp: 8, item: "birchLog" },
  oak: { level: 10, holds: 4, regrowTicks: 300, xp: 20, item: "oakLog" },
  charwood: {
    level: 20,
    holds: 3,
    regrowTicks: 500,
    xp: 32,
    item: "charwoodLog",
  },
} as const;
export type TreeKind = keyof typeof TREES;
