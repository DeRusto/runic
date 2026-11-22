import { COINS, takeRefusal, type HasInventory, type ItemId } from "./items.ts";
import { levelFor } from "./skills.ts";

/** Every mark, by id: a person who stands in the region only to be pickpocketed, with no job to offer (#235). */
export const MARKS = {
  /** Pell, outside the inn beside the range, the first person a player can pickpocket (Thieving spec §4). */
  drunk: { name: "Pell", role: "drunk" },
} as const;
export type MarkId = keyof typeof MARKS;

/** Experience a Thieving target pays per success at level 1 (Thieving spec §1). */
export const THIEVING_XP_AT_LEVEL_1 = 8;
/** Added per level the target needs above 1, rounded once (Thieving spec §1). */
export const THIEVING_XP_PER_LEVEL = 1.25;

/**
 * The experience scale every Thieving target pays on, by the level it needs: 8 at level 1, as a
 * level-1 tree pays, up to 76 at Hollow's level-55 strongbox (Thieving spec §1).
 */
export const thievingXpAt = (level: number) =>
  Math.round(THIEVING_XP_AT_LEVEL_1 + THIEVING_XP_PER_LEVEL * (level - 1));

/** The percent of attempts that fail at the target's own level (Thieving spec §1). */
export const FAIL_PERCENT_AT_LEVEL = 40;
/** From this many levels above the target's, an attempt never fails, as with Agility (Thieving spec §1). */
export const NO_FAIL_LEVELS_ABOVE = 20;

/**
 * The failure-chance curve every Thieving target shares: 40% at the level it needs, falling
 * evenly to none `NO_FAIL_LEVELS_ABOVE` levels above it. Stalls and strongboxes use it too (Thieving spec §1).
 */
export const thievingFailPercent = (levelNeeded: number, level: number) =>
  (FAIL_PERCENT_AT_LEVEL *
    Math.max(0, NO_FAIL_LEVELS_ABOVE - (level - levelNeeded))) /
  NO_FAIL_LEVELS_ABOVE;

/** A failed pickpocket's hit, in hundredths of a Hitpoints level: one level, the smallest hit. It never kills (Thieving spec §2). */
export const PICKPOCKET_HIT = 100;
/** How long a failed pickpocket stuns the player for: they can't act or move, but can be hit (Thieving spec §2). */
export const STUN_TICKS = 6;
/** How often a player can try a pocket, so clicking again can't beat it (Thieving spec §2). */
export const PICKPOCKET_INTERVAL_TICKS = 2;

/** What a pickpocket target needs and pays: coins from `minCoins` to `maxCoins`, and `rare` this percent of successes. */
export type PickpocketRow = {
  name: string;
  level: number;
  xp: number;
  minCoins: number;
  maxCoins: number;
  rare: { item: ItemId; percent: number };
};

/** Every person a player can pickpocket, by their mark id (Thieving spec §4). Add one by adding a row. */
export const PICKPOCKETS = {
  drunk: {
    name: MARKS.drunk.name,
    level: 1,
    xp: thievingXpAt(1),
    minCoins: 1,
    maxCoins: 5,
    // A half-eaten supper from the inn (Thieving spec §4).
    rare: { item: "cookedPerch", percent: 10 },
  },
} as const satisfies Record<string, PickpocketRow>;
export type PickpocketTarget = keyof typeof PICKPOCKETS;

/** Why a pickpocket is refused, or undefined if it isn't. The client shows it, and the server ignores the click. */
export function pickpocketRefusal(
  { name, level }: Pick<PickpocketRow, "name" | "level">,
  player: HasInventory & { thievingXp: number },
) {
  if (levelFor(player.thievingXp) < level)
    return `You need Thieving ${level} to pickpocket ${name}.`;
  return takeRefusal(COINS, player);
}

/** One attempt's outcome: caught for a hit, or what the pocket held. Rolls the failure, then the coins, then the rare item, so a seeded `random` replays. */
export function rollPickpocket(
  row: PickpocketRow,
  level: number,
  random: () => number,
):
  | { caught: true; damage: number }
  | { caught: false; coins: number; items: ItemId[]; xp: number } {
  if (random() < thievingFailPercent(row.level, level) / 100)
    return { caught: true, damage: PICKPOCKET_HIT };
  const coins =
    row.minCoins + Math.floor(random() * (row.maxCoins - row.minCoins + 1));
  const items = random() < row.rare.percent / 100 ? [row.rare.item] : [];
  return { caught: false, coins, items, xp: row.xp };
}
