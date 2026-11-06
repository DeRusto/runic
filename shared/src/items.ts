import { EMPTY_SLOT } from "./index.ts";

/** How many of one material or food fit in a slot (spec §4). */
export const STACK_SIZE = 20;
const STACKS = { stack: STACK_SIZE };
const GEAR = { stack: 1 };

/** Every item, by the id saves and state hold. `berry` and `herb` are in existing saves, so they can't change (spec §6). */
export const ITEMS = {
  berry: STACKS,
  herb: STACKS,
  emberbone: STACKS,
  copperOre: STACKS,
  copperBar: STACKS,
  copperSword: GEAR,
  copperShield: GEAR,
  ironOre: STACKS,
  ironBar: STACKS,
  ironSword: GEAR,
  ironShield: GEAR,
  emberiteOre: STACKS,
  emberiteBar: STACKS,
  emberiteSword: GEAR,
  emberiteShield: GEAR,
} as const;
export type ItemId = keyof typeof ITEMS;

/** Every tool the Blacksmith gives. Tools aren't items: they live in the Toolbelt, not a slot (spec §4). */
export const TOOLS = ["pickaxe", "hammer"];

/** The slot a new `item` goes in: the first stack of it with room, then the first empty slot. -1 means full (spec §4). */
export function slotFor(
  item: ItemId,
  player: { inventory: Iterable<string>; inventoryCounts: Iterable<number> },
) {
  const items = [...player.inventory];
  const counts = [...player.inventoryCounts];
  const stack = items.findIndex(
    (held, slot) => held === item && counts[slot]! < ITEMS[item].stack,
  );
  return stack >= 0 ? stack : items.indexOf(EMPTY_SLOT);
}
