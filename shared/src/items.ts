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
} as const;
export type ItemId = keyof typeof ITEMS;

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
