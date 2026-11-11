import type { HasInventory, ItemId } from "./items.ts";
import type { StationKind } from "./region.ts";
import { levelFor, type XpField } from "./skills.ts";

type Recipe = {
  station: StationKind;
  /** The skill that gates this recipe: the furnace's is Mining, the anvil's is Smithing. */
  skill: "Mining" | "Smithing";
  /** That skill's synced experience field. */
  xpField: "miningXp" | "smithingXp";
  /** That skill's level needed. */
  level: number;
  costs: Partial<Record<ItemId, number>>;
  ticks: number;
  /** What finishing one grants, in each skill. */
  xp: Partial<Record<XpField, number>>;
};

/** Spec §5, as revised by the rebalance spec §3 Making. The order here is the order of the Smithing panel's rows. */
export const RECIPES = {
  copperBar: {
    station: "furnace",
    skill: "Mining",
    xpField: "miningXp",
    level: 1,
    costs: { copperOre: 1 },
    ticks: 6,
    xp: { miningXp: 2 },
  },
  bronzeBar: {
    station: "furnace",
    skill: "Mining",
    xpField: "miningXp",
    level: 5,
    costs: { copperOre: 1, tin: 1 },
    ticks: 6,
    xp: { miningXp: 4 },
  },
  ironBar: {
    station: "furnace",
    skill: "Mining",
    xpField: "miningXp",
    level: 10,
    costs: { ironOre: 1 },
    ticks: 6,
    xp: { miningXp: 6 },
  },
  steelBar: {
    station: "furnace",
    skill: "Mining",
    xpField: "miningXp",
    level: 15,
    costs: { ironOre: 1, coal: 1 },
    ticks: 6,
    xp: { miningXp: 9 },
  },
  emberiteBar: {
    station: "furnace",
    skill: "Mining",
    xpField: "miningXp",
    level: 20,
    costs: { emberiteOre: 1 },
    ticks: 6,
    xp: { miningXp: 12 },
  },
  copperSword: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 1,
    costs: { copperBar: 3 },
    ticks: 12,
    xp: { smithingXp: 18 },
  },
  copperShield: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 1,
    costs: { copperBar: 4 },
    ticks: 16,
    xp: { smithingXp: 24 },
  },
  copperHelmet: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 1,
    costs: { copperBar: 2 },
    ticks: 8,
    xp: { smithingXp: 12 },
  },
  copperChestplate: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 1,
    costs: { copperBar: 5 },
    ticks: 20,
    xp: { smithingXp: 30 },
  },
  copperLeggings: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 1,
    costs: { copperBar: 3 },
    ticks: 12,
    xp: { smithingXp: 18 },
  },
  bronzeSword: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 5,
    costs: { bronzeBar: 3 },
    ticks: 12,
    xp: { smithingXp: 36 },
  },
  bronzeShield: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 5,
    costs: { bronzeBar: 4 },
    ticks: 16,
    xp: { smithingXp: 48 },
  },
  bronzeHelmet: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 5,
    costs: { bronzeBar: 2 },
    ticks: 8,
    xp: { smithingXp: 24 },
  },
  bronzeChestplate: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 5,
    costs: { bronzeBar: 5 },
    ticks: 20,
    xp: { smithingXp: 60 },
  },
  bronzeLeggings: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 5,
    costs: { bronzeBar: 3 },
    ticks: 12,
    xp: { smithingXp: 36 },
  },
  ironSword: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 10,
    costs: { ironBar: 3 },
    ticks: 12,
    xp: { smithingXp: 54 },
  },
  ironShield: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 10,
    costs: { ironBar: 4 },
    ticks: 16,
    xp: { smithingXp: 72 },
  },
  ironHelmet: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 10,
    costs: { ironBar: 2 },
    ticks: 8,
    xp: { smithingXp: 36 },
  },
  ironChestplate: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 10,
    costs: { ironBar: 5 },
    ticks: 20,
    xp: { smithingXp: 90 },
  },
  ironLeggings: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 10,
    costs: { ironBar: 3 },
    ticks: 12,
    xp: { smithingXp: 54 },
  },
  steelSword: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 15,
    costs: { steelBar: 3 },
    ticks: 12,
    xp: { smithingXp: 81 },
  },
  steelShield: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 15,
    costs: { steelBar: 4 },
    ticks: 16,
    xp: { smithingXp: 108 },
  },
  steelHelmet: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 15,
    costs: { steelBar: 2 },
    ticks: 8,
    xp: { smithingXp: 54 },
  },
  steelChestplate: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 15,
    costs: { steelBar: 5 },
    ticks: 20,
    xp: { smithingXp: 135 },
  },
  steelLeggings: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 15,
    costs: { steelBar: 3 },
    ticks: 12,
    xp: { smithingXp: 81 },
  },
  emberiteSword: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 20,
    costs: { emberiteBar: 3, emberbone: 2 },
    ticks: 12,
    xp: { smithingXp: 108 },
  },
  emberiteShield: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 20,
    costs: { emberiteBar: 4, emberbone: 3 },
    ticks: 16,
    xp: { smithingXp: 144 },
  },
  emberiteHelmet: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 20,
    costs: { emberiteBar: 2, emberbone: 1 },
    ticks: 8,
    xp: { smithingXp: 72 },
  },
  emberiteChestplate: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 20,
    costs: { emberiteBar: 5, emberbone: 4 },
    ticks: 20,
    xp: { smithingXp: 180 },
  },
  emberiteLeggings: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 20,
    costs: { emberiteBar: 3, emberbone: 2 },
    ticks: 12,
    xp: { smithingXp: 108 },
  },
} as const satisfies Partial<Record<ItemId, Recipe>>;
export type RecipeItem = keyof typeof RECIPES;

export const costsOf = (item: RecipeItem) =>
  Object.entries(RECIPES[item].costs) as [ItemId, number][];

export const xpOf = (item: RecipeItem) =>
  Object.entries(RECIPES[item].xp) as [XpField, number][];

/** How many of `item` a player holds, across all their stacks. */
export function countOf(item: string, player: HasInventory) {
  const counts = [...player.inventoryCounts];
  return [...player.inventory].reduce(
    (total, held, slot) => total + (held === item ? counts[slot]! : 0),
    0,
  );
}

/** Why the player's level is too low to make this item, or undefined if it isn't. The panel folds a tier on it. */
export function levelRefusal(
  item: RecipeItem,
  player: Record<Recipe["xpField"], number>,
) {
  const { level, skill, xpField } = RECIPES[item];
  return levelFor(player[xpField]) < level
    ? `Needs ${skill} ${level}`
    : undefined;
}

/** Why this item can't be made right now, or undefined if it can. The panel's rows and the server's checks both read this. */
export function makeRefusal(
  item: RecipeItem,
  player: HasInventory & Record<Recipe["xpField"], number>,
) {
  const tooLow = levelRefusal(item, player);
  if (tooLow) return tooLow;
  if (costsOf(item).some(([cost, count]) => countOf(cost, player) < count))
    return "Not enough materials";
  return undefined;
}

/** Why a click on this station is refused, or undefined if it isn't. The client shows it, and the server ignores the pick. */
export function stationRefusal(
  station: StationKind,
  player: { tools: Iterable<string> },
) {
  return station === "anvil" && ![...player.tools].includes("hammer")
    ? "You need a hammer. The Blacksmith will give you one."
    : undefined;
}
