import { EMPTY_SLOT } from "./index.ts";

/** How many of one material or food fit in a slot (spec §4). */
export const STACK_SIZE = 20;
const STACKS = { stack: STACK_SIZE };
const SINGLE = { stack: 1 };

/** Every item, by the id saves and state hold. `berry` and `herb` are in existing saves, so they can't change (spec §6). */
export const ITEMS = {
  berry: STACKS,
  herb: STACKS,
  emberbone: STACKS,
  /** Finds from veins (spec §3): tin from Copper and Iron, coal from Iron, a gem from Emberite. */
  tin: STACKS,
  coal: STACKS,
  ashstone: STACKS,
  cinderglass: STACKS,
  heartflame: STACKS,
  copperOre: STACKS,
  copperBar: STACKS,
  copperSword: SINGLE,
  copperShield: SINGLE,
  copperHelmet: SINGLE,
  copperChestplate: SINGLE,
  copperLeggings: SINGLE,
  bronzeBar: STACKS,
  bronzeSword: SINGLE,
  bronzeShield: SINGLE,
  bronzeHelmet: SINGLE,
  bronzeChestplate: SINGLE,
  bronzeLeggings: SINGLE,
  ironOre: STACKS,
  ironBar: STACKS,
  ironSword: SINGLE,
  ironShield: SINGLE,
  ironHelmet: SINGLE,
  ironChestplate: SINGLE,
  ironLeggings: SINGLE,
  steelBar: STACKS,
  steelSword: SINGLE,
  steelShield: SINGLE,
  steelHelmet: SINGLE,
  steelChestplate: SINGLE,
  steelLeggings: SINGLE,
  emberiteOre: STACKS,
  emberiteBar: STACKS,
  emberiteSword: SINGLE,
  emberiteShield: SINGLE,
  emberiteHelmet: SINGLE,
  emberiteChestplate: SINGLE,
  emberiteLeggings: SINGLE,
  /** All of a player's coins share one slot with no cap (#193). */
  coins: { stack: Infinity },
} as const;
export type ItemId = keyof typeof ITEMS;

/** The id of coins, which the general store pays in (#193). */
export const COINS = "coins";

/** The Qualities an item can be made at, lowest first; common is a plain id (spec §2). */
export const QUALITIES = ["common", "uncommon", "rare"] as const;
export type Quality = (typeof QUALITIES)[number];
/** The Virtues an improved item can carry, as they appear in its id (spec §2). */
export const VIRTUES = ["fortitude", "might", "avoidance"] as const;
export type Virtue = (typeof VIRTUES)[number];

/** Splits an id held in state or a save into its base id, Quality and Virtue: `copperChestplate:uncommon:fortitude`, or a plain id for a common item (ADR 0004). Every lookup by item id reads `base`. */
export function itemParts(id: string) {
  const [base, quality = "common", virtue] = id.split(":");
  return {
    base: base as ItemId,
    quality: quality as Quality,
    virtue: virtue as Virtue | undefined,
  };
}

/** Every tool the Blacksmith gives. Tools aren't items: they live in the Toolbelt, not a slot (spec §4). */
export const TOOLS = ["pickaxe", "hammer"];

/** The rare finds from Emberite veins, rarest last. Nothing uses them yet (spec §3). */
export const GEMS = ["ashstone", "cinderglass", "heartflame"];

/** A player's two parallel inventory fields, which are also their save columns (spec D9). */
export type HasInventory = {
  inventory: Iterable<string>;
  inventoryCounts: Iterable<number>;
};

/** The slot a new `item` goes in: the first stack of it with room, then the first empty slot. -1 means full (spec §4). */
export function slotFor(item: string, player: HasInventory) {
  const items = [...player.inventory];
  const counts = [...player.inventoryCounts];
  const stack = items.findIndex(
    (held, slot) =>
      held === item && counts[slot]! < ITEMS[itemParts(item).base].stack,
  );
  return stack >= 0 ? stack : items.indexOf(EMPTY_SLOT);
}

/** Why a take of `item` from the ground, or any gain of one, is refused, or undefined if one fits. The rest of a stack that does not fit stays where it is. */
export const takeRefusal = (item: string, player: HasInventory) =>
  slotFor(item, player) < 0 ? "Your inventory is full." : undefined;

/**
 * Drags the stack in slot `from` onto slot `to` of the same slots (#193). Onto the same item
 * with room, it fills the target and the rest stays in `from`; anything else swaps, which moves
 * onto an empty slot. Nothing splits into an empty slot.
 */
export function moveStack(
  items: string[],
  counts: number[],
  from: number,
  to: number,
) {
  const item = items[from]!;
  if (item === EMPTY_SLOT || from === to) return;
  const room = ITEMS[itemParts(item).base].stack - counts[to]!;
  if (items[to] === item && room > 0) {
    const moved = Math.min(room, counts[from]!);
    counts[to]! += moved;
    counts[from]! -= moved;
    if (!counts[from]) items[from] = EMPTY_SLOT;
    return;
  }
  [items[from], items[to]] = [items[to]!, item];
  [counts[from], counts[to]] = [counts[to]!, counts[from]!];
}

/** How many of `item` the slots hold, across every stack of it. */
export const heldCount = (items: string[], counts: number[], item: string) =>
  items.reduce(
    (total, held, slot) => total + (held === item ? counts[slot]! : 0),
    0,
  );

/**
 * Puts `count` of `item` into the same slots, topping up its stacks before filling empty slots,
 * and returns how many didn't fit. Mutates both arrays, so an `ArraySchema` works.
 */
export function addItems(
  items: string[],
  counts: number[],
  item: string,
  count: number,
) {
  const stack = ITEMS[itemParts(item).base].stack;
  for (const fill of [item, EMPTY_SLOT]) {
    items.forEach((held, slot) => {
      if (held !== fill || !count) return;
      const put = Math.min(count, stack - counts[slot]!);
      items[slot] = item;
      counts[slot]! += put;
      count -= put;
    });
  }
  return count;
}

/** Takes `count` of `item` out of the same slots, last slot first; the caller has checked they hold that many. */
export function removeItems(
  items: string[],
  counts: number[],
  item: string,
  count: number,
) {
  for (let slot = items.length - 1; slot >= 0 && count; slot--) {
    if (items[slot] !== item) continue;
    const taken = Math.min(count, counts[slot]!);
    counts[slot]! -= taken;
    count -= taken;
    if (!counts[slot]) items[slot] = EMPTY_SLOT;
  }
}
