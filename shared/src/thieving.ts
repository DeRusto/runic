import type { ItemId } from "./items.ts";
import { levelFor } from "./skills.ts";

/** A person who stands in the region only to be pickpocketed (#235): their nameplate. Add one by adding a row. */
export const MARKS = {
  drunk: { name: "Drunk" },
} as const;
export type MarkId = keyof typeof MARKS;

/**
 * What pickpocketing each target needs and pays (#235, #250): the Thieving level, the experience a
 * success pays, its coins, the rare item that now and then comes instead, and the hit a failure
 * deals, in hundredths of a Hitpoints level. `called` is how messages name them.
 */
export type Pickpocket = {
  called: string;
  level: number;
  xp: number;
  coins: { fewest: number; most: number };
  rare: { item: ItemId; chancePercent: number };
  failHit: number;
};

/** Every target that can be pickpocketed, by its mark's id (#250). Villagers join in #251. */
export const PICKPOCKETS = {
  drunk: {
    called: "the drunk",
    level: 1,
    xp: 8,
    coins: { fewest: 1, most: 5 },
    // Supper from the inn, still in his coat.
    rare: { item: "cookedPerch", chancePercent: 12 },
    failHit: 100,
  },
} as const satisfies Record<MarkId, Pickpocket>;
export type PickpocketTarget = keyof typeof PICKPOCKETS;

/** How likely a pickpocket at exactly the target's level is to fail (#250). Every Thieving target uses this curve. */
export const FAIL_PERCENT_AT_REQUIREMENT = 50;
/** How many levels above a target's requirement a player stops failing (#250, as Agility will). */
export const SURE_HANDED_LEVELS = 20;
/** How long a failed pickpocket stuns for (#250): the player can't act or move, and enemies can still hit them. */
export const STUN_TICKS = 8;
/** The shortest time between two pickpocket attempts, so clicking again can't beat it. */
export const PICKPOCKET_INTERVAL_TICKS = 3;

/** The chance, in percent, that a player at `level` fails a target that needs `required`: falling evenly to 0 at `SURE_HANDED_LEVELS` above it. */
export const failPercent = (level: number, required: number) =>
  Math.max(
    0,
    (FAIL_PERCENT_AT_REQUIREMENT * (SURE_HANDED_LEVELS - (level - required))) /
      SURE_HANDED_LEVELS,
  );

/** Whether one attempt on `target` fails, rolled once. */
export const pickpocketFails = (
  target: PickpocketTarget,
  thievingXp: number,
  random: () => number,
) =>
  random() * 100 < failPercent(levelFor(thievingXp), PICKPOCKETS[target].level);

/** What one success takes: the rare item, one of, or else an even pick of the coins. */
export function pickpocketLoot(
  target: PickpocketTarget,
  random: () => number,
): { item: ItemId; count: number } {
  const { coins, rare } = PICKPOCKETS[target];
  if (random() * 100 < rare.chancePercent) return { item: rare.item, count: 1 };
  const count =
    coins.fewest + Math.floor(random() * (coins.most - coins.fewest + 1));
  return { item: "coins", count };
}

/** Why a player can't pickpocket this target, or undefined if they can. */
export const pickpocketRefusal = (
  { level, called }: Pick<Pickpocket, "level" | "called">,
  thievingXp: number,
) =>
  levelFor(thievingXp) < level
    ? `You need Thieving ${level} to pickpocket ${called}.`
    : undefined;
