import type { VillagerId } from "./dialogue.ts";
import type { ItemId } from "./items.ts";
import { levelFor } from "./skills.ts";

/** A person who stands in the region only to be pickpocketed (#235): their name and what they are, for the nameplate ("Pell, drunk"). Add one by adding a row. */
export const MARKS = {
  drunk: { name: "Pell", role: "drunk" },
  pedlar: { name: "Jory", role: "pedlar" },
} as const;
export type MarkId = keyof typeof MARKS;

/**
 * What pickpocketing each target needs and pays (#235, #250): the Thieving level, the experience a
 * success pays, its coins, the rare item that now and then comes with them, and the hit a failure
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

/**
 * Every target that can be pickpocketed, by its mark's or villager's id (#250, #251). Every mark is
 * one; a villager is one only with a row here, and Aldous, the banker, never has one.
 */
export const PICKPOCKETS = {
  drunk: {
    called: "Pell",
    level: 1,
    xp: 8,
    coins: { fewest: 1, most: 5 },
    // Supper from the inn, still in his coat.
    rare: { item: "cookedPerch", chancePercent: 12.5 },
    failHit: 100,
  },
  pedlar: {
    called: "Jory",
    level: 10,
    xp: 20,
    coins: { fewest: 4, most: 12 },
    // A coil from the stock on his back.
    rare: { item: "rope", chancePercent: 12.5 },
    failHit: 150,
  },
  marta: {
    called: "Marta",
    level: 20,
    xp: 32,
    coins: { fewest: 8, most: 20 },
    // One of the store's empty vials, kept in her apron.
    rare: { item: "vial", chancePercent: 12.5 },
    failHit: 200,
  },
  odo: {
    called: "Odo",
    level: 30,
    xp: 45,
    coins: { fewest: 12, most: 30 },
    // A bar from the forge, waiting for the anvil.
    rare: { item: "ironBar", chancePercent: 12.5 },
    failHit: 250,
  },
  hollis: {
    called: "Hollis",
    level: 45,
    xp: 62,
    coins: { fewest: 20, most: 45 },
    // A piece of the essence the stones are fed.
    rare: { item: "runeEssence", chancePercent: 12.5 },
    failHit: 300,
  },
} as const satisfies Record<MarkId, Pickpocket> &
  Partial<Record<VillagerId, Pickpocket>>;
export type PickpocketTarget = keyof typeof PICKPOCKETS;

/** Whether `id`, a mark's or villager's, names someone who can be pickpocketed (#251). Safe on any string off the network. */
export const isPickpocketTarget = (id: string): id is PickpocketTarget =>
  Object.hasOwn(PICKPOCKETS, id);

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

/** What one success takes: an even pick of the coins, and now and then the rare item as well (#250). */
export function pickpocketLoot(
  target: PickpocketTarget,
  random: () => number,
): { item: ItemId; count: number }[] {
  const { coins, rare } = PICKPOCKETS[target];
  const count =
    coins.fewest + Math.floor(random() * (coins.most - coins.fewest + 1));
  const loot: { item: ItemId; count: number }[] = [{ item: "coins", count }];
  if (random() * 100 < rare.chancePercent)
    loot.push({ item: rare.item, count: 1 });
  return loot;
}

/** Why a player can't pickpocket this target, or undefined if they can. */
export const pickpocketRefusal = (
  { level, called }: Pick<Pickpocket, "level" | "called">,
  thievingXp: number,
) =>
  levelFor(thievingXp) < level
    ? `You need Thieving ${level} to pickpocket ${called}.`
    : undefined;
