import {
  addItems,
  COINS,
  heldCount,
  itemParts,
  type HasInventory,
  type ItemId,
  removeItems,
  type Quality,
} from "./items.ts";
import { costsOf, RECIPES, type RecipeItem } from "./making.ts";

/**
 * The hand-set value of every raw item, in coins (village spec §5). The cheapest sellable item is worth 3,
 * so it sells for 1. A value of 0 would make an item trash; none are yet.
 */
export const RAW_VALUES: Partial<Record<ItemId, number>> = {
  berry: 3,
  herb: 6,
  copperOre: 3,
  tin: 3,
  coal: 4,
  ironOre: 8,
  emberiteOre: 20,
  emberbone: 10,
  ashstone: 25,
  cinderglass: 50,
  heartflame: 100,
};

/** How many times its common version's value an item of each Quality is worth (village spec §5). */
export const QUALITY_VALUE_TIMES: Record<Quality, number> = {
  common: 1,
  uncommon: 2,
  rare: 4,
};

/** What an item costs at the general store, in coins: its hand-set value, or for a bar or gear what it is made of (village spec §5). */
export function valueOf(item: string): number {
  const { base, quality } = itemParts(item);
  const common =
    RAW_VALUES[base] ??
    // Coins, which aren't sold, have no recipe and are worth nothing as an item.
    (Object.hasOwn(RECIPES, base) ? costsOf(base as RecipeItem) : []).reduce(
      (total, [cost, count]) => total + valueOf(cost) * count,
      0,
    );
  return common * QUALITY_VALUE_TIMES[quality];
}

/** The store pays this share of value when it buys (village spec §5). */
export const STORE_PAYS_PERCENT = 40;

/** What the store pays for one item of this value: 40% rounded down, but never under 1 coin unless it is trash (village spec §5). */
export const storePaysFor = (value: number) =>
  value && Math.max(1, Math.floor((value * STORE_PAYS_PERCENT) / 100));

/** The shelf's slots, shared by every player (village spec §5). */
export const SHELF_SLOTS = 40;
/** The store's own stock, which the shelf starts with and refills to (village spec §5). */
export const STARTING_STOCK: Partial<Record<ItemId, number>> = {
  berry: 20,
  herb: 10,
  copperOre: 5,
  coal: 5,
};
/** One of each item below its starting stock comes back this often: 30 s (village spec §5). */
export const RESTOCK_TICKS = 100;
/** One of each item above its starting stock goes this often, by Quality: 60 s, 5 min and 20 min (village spec §5). */
export const DRAIN_TICKS: Record<Quality, number> = {
  common: 200,
  uncommon: 1000,
  rare: 4000,
};

/** What the shelf holds, as the synced state has it: parallel item ids and counts. */
export type HasShelf = {
  shelf: Iterable<string>;
  shelfCounts: Iterable<number>;
};

/** One line of a tray. */
export type DealLine = { item: string; count: number };
/** A line of the buy tray, with how many of the item the shelf held when the player set it out. */
export type BuyLine = DealLine & { stock: number };
/** What a player buys from the shelf and sells from their inventory in one deal; the deal intent's payload. */
export type Deal = { buy: BuyLine[]; sell: DealLine[] };

/** What a deal costs the player and what its sales bring them, in coins. */
export function dealTotals({ buy, sell }: Deal) {
  const sum = (lines: DealLine[], price: (item: string) => number) =>
    lines.reduce((total, { item, count }) => total + price(item) * count, 0);
  return {
    pay: sum(buy, valueOf),
    get: sum(sell, (item) => storePaysFor(valueOf(item))),
  };
}

/** Why the store won't buy `item` at all, or undefined if it will. */
export const sellRefusal = (item: string) =>
  item === COINS ? "The store doesn't buy coins." : undefined;

/**
 * Why `deal` can't go through, or undefined if it can. It is tried on a copy, sales first so
 * their coins pay for the buys, as the deal itself runs (village spec §5).
 */
export function dealRefusal(deal: Deal, player: HasInventory, shelf: HasShelf) {
  const items = [...player.inventory];
  const counts = [...player.inventoryCounts];
  const shelfItems = [...shelf.shelf];
  const shelfCounts = [...shelf.shelfCounts];
  for (const { item, count } of deal.sell) {
    const refusal = sellRefusal(item);
    if (refusal) return refusal;
    if (heldCount(items, counts, item) < count)
      return "You don't have that many to sell.";
    removeItems(items, counts, item, count);
  }
  for (const { item, count, stock } of deal.buy) {
    const at = shelfItems.indexOf(item);
    if (at < 0 || shelfCounts[at]! < count)
      return "The store doesn't have that many left.";
    // So nobody pays for what another player's deal or a refill has just changed (village spec §5).
    if (shelfCounts[at] !== stock)
      return "The shelf has changed since you set out this deal.";
    shelfCounts[at]! -= count;
  }
  const { pay, get } = dealTotals(deal);
  const room = "You don't have room for all that.";
  if (addItems(items, counts, COINS, get)) return room;
  const short = pay - heldCount(items, counts, COINS);
  if (short > 0) return `You need ${short} more coin${short === 1 ? "" : "s"}.`;
  removeItems(items, counts, COINS, pay);
  for (const { item, count } of deal.buy)
    if (addItems(items, counts, item, count)) return room;
  return undefined;
}
