/** #210's starting numbers. One kind of spot, at Fishing 1: the player's level picks the fish, best first, and the experience follows the catch. No doubles, no finds. */
export const FISHING_SPOTS = {
  shore: {
    level: 1,
    holds: 5,
    regrowTicks: 150,
    xp: 8,
    item: "perch",
    catches: [
      { level: 20, chance: 0.2, item: "pike", xp: 32 },
      { level: 10, chance: 0.3, item: "trout", xp: 20 },
    ],
  },
} as const;
export type FishingSpotKind = keyof typeof FISHING_SPOTS;
