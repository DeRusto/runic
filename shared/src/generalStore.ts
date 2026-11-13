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
import { capeOfGossamer } from "./gear.ts";
import { AUGMENTATIONS, costsOf, RECIPES, type RecipeItem } from "./making.ts";
import { POTIONS, type PotionId } from "./potions.ts";

/**
 * The hand-set value of every raw item, in coins (village spec §5). The store pays 40% of value,
 * never under 1, so the cheapest sellable item, #232's strange material at 1, sells for 1.
 * A value of 0 would make an item trash; none are yet.
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
  // #232's essence: the masked find is worth a coin until it is identified, and a rune
  // outsells the essence it is made of, by its gate.
  strangeMaterial: 1,
  runeEssence: 6,
  airRune: 8,
  waterRune: 12,
  earthRune: 18,
  fireRune: 30,
  // Low, and rising by tier like ore (#208).
  birchLog: 3,
  oakLog: 6,
  charwoodLog: 12,
  // Raw fish, priced like logs (#210).
  perch: 3,
  trout: 6,
  pike: 12,
  // The empty vial is as cheap as a berry, and the plants rise by their pick gate (#222).
  vial: 3,
  dewpetal: 6,
  nightbloom: 12,
  emberbloom: 20,
  // The silk waits for Phase 8's Spider drop (#217), and is priced like the emberbone.
  spiderSilk: 10,
  // #217's capes, priced by their tier: their Leatherworking recipes will set the final ones.
  copperMightCape: 20,
  copperFortitudeCape: 20,
  copperAvoidanceCape: 20,
  bronzeMightCape: 35,
  bronzeFortitudeCape: 35,
  bronzeAvoidanceCape: 35,
  ironMightCape: 50,
  ironFortitudeCape: 50,
  ironAvoidanceCape: 50,
  steelMightCape: 70,
  steelFortitudeCape: 70,
  steelAvoidanceCape: 70,
  emberiteMightCape: 90,
  emberiteFortitudeCape: 90,
  emberiteAvoidanceCape: 90,
  // Fletching's stock (#228), hand-set because a make gives a batch of ten. A feather is the store's to sell, like the vial, and arrows outprice their shaft, head and feather.
  arrowShaft: 2,
  feather: 3,
  copperArrowhead: 2,
  bronzeArrowhead: 3,
  ironArrowhead: 4,
  steelArrowhead: 6,
  emberiteArrowhead: 10,
  copperArrow: 12,
  bronzeArrow: 16,
  ironArrow: 20,
  steelArrow: 26,
  emberiteArrow: 40,
  // A throwing knife is a small weapon from one bar, plus an Emberbone at Emberite.
  copperThrowingKnife: 6,
  bronzeThrowingKnife: 12,
  ironThrowingKnife: 16,
  steelThrowingKnife: 24,
  emberiteThrowingKnife: 60,
};

/** How many times its common version's value an item of each Quality is worth (village spec §5). Delicious food is as rare as a rare piece, and worth the same multiple (#221). */
export const QUALITY_VALUE_TIMES: Record<Quality, number> = {
  common: 1,
  uncommon: 2,
  rare: 4,
  delicious: 4,
};

/**
 * What an item costs at the general store, in coins: its hand-set value, or for a bar or gear what it is
 * made of (village spec §5). Coins, which the store doesn't buy, are worth 0; any other item with no
 * value throws, so a new item can't quietly become trash.
 */
export function valueOf(item: string): number {
  const { base, quality } = itemParts(item);
  if (base === COINS) return 0;
  // A gossamer cloak is the cape it was made from plus the silk that went into it (#217).
  const cape = capeOfGossamer(item);
  if (cape !== undefined)
    return valueOf(cape) + valueOf(AUGMENTATIONS.gossamerCloak.reagent);
  let common = RAW_VALUES[base];
  if (common === undefined && Object.hasOwn(RECIPES, base))
    common = costsOf(base as RecipeItem).reduce(
      (total, [cost, count]) => total + valueOf(cost) * count,
      0,
    );
  // A potion is what its mixing costs: one vial and its plant (#222).
  if (common === undefined && Object.hasOwn(POTIONS, base)) {
    const { plant } = POTIONS[base as PotionId];
    common = valueOf("vial") + valueOf(plant);
  }
  if (common === undefined) throw new Error(`No store value for ${item}`);
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
  /** From day one, so a new Herblaw can get mixing (#222). */
  vial: 20,
  /** From day one, so a new Fletching can get arrows (#228); a mob drop is Phase 8's. */
  feather: 20,
};
/** One of each item below its starting stock comes back this often: 30 s (village spec §5). */
export const RESTOCK_TICKS = 100;
/** One of each item above its starting stock goes this often, by Quality: 60 s, 5 min, 20 min, and Delicious with the rare (village spec §5, #221). */
export const DRAIN_TICKS: Record<Quality, number> = {
  common: 200,
  uncommon: 1000,
  rare: 4000,
  delicious: 4000,
};

/** What the shelf holds, as the synced state has it: parallel item ids and counts. */
export type HasShelf = {
  shelf: Iterable<string>;
  shelfCounts: Iterable<number>;
};

/** One line of a tray. */
export type DealLine = { item: string; count: number };
/** What a player buys from the shelf and sells from their inventory in one deal; the deal intent's payload. */
export type Deal = { buy: DealLine[]; sell: DealLine[] };

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
  for (const { item, count } of deal.buy) {
    const at = shelfItems.indexOf(item);
    // Only too few left refuses, so players sharing the shelf don't spoil each other's deals (village spec §5).
    if (at < 0 || shelfCounts[at]! < count)
      return "The store doesn't have that many left.";
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
