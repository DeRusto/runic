import type { HasInventory, ItemId } from "./items.ts";
import type { StationKind } from "./region.ts";
import { levelFor, type XpField } from "./skills.ts";

type Recipe = {
  station: StationKind;
  /** The Smithing level needed. */
  level: number;
  costs: Partial<Record<ItemId, number>>;
  ticks: number;
  /** What finishing one grants, in each skill. */
  xp: Partial<Record<XpField, number>>;
};

/** Spec §5. The order here is the order of the Smithing panel's rows. */
export const RECIPES = {
  copperBar: {
    station: "furnace",
    level: 1,
    costs: { copperOre: 1 },
    ticks: 6,
    xp: { smithingXp: 4, miningXp: 4 },
  },
  ironBar: {
    station: "furnace",
    level: 10,
    costs: { ironOre: 1 },
    ticks: 6,
    xp: { smithingXp: 12, miningXp: 12 },
  },
  emberiteBar: {
    station: "furnace",
    level: 20,
    costs: { emberiteOre: 1 },
    ticks: 6,
    xp: { smithingXp: 24, miningXp: 24 },
  },
  copperSword: {
    station: "anvil",
    level: 1,
    costs: { copperBar: 3 },
    ticks: 12,
    xp: { smithingXp: 18 },
  },
  copperShield: {
    station: "anvil",
    level: 1,
    costs: { copperBar: 4 },
    ticks: 16,
    xp: { smithingXp: 24 },
  },
  ironSword: {
    station: "anvil",
    level: 10,
    costs: { ironBar: 3 },
    ticks: 12,
    xp: { smithingXp: 54 },
  },
  ironShield: {
    station: "anvil",
    level: 10,
    costs: { ironBar: 4 },
    ticks: 16,
    xp: { smithingXp: 72 },
  },
  emberiteSword: {
    station: "anvil",
    level: 20,
    costs: { emberiteBar: 3, emberbone: 2 },
    ticks: 12,
    xp: { smithingXp: 108 },
  },
  emberiteShield: {
    station: "anvil",
    level: 20,
    costs: { emberiteBar: 4, emberbone: 3 },
    ticks: 16,
    xp: { smithingXp: 144 },
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

/** Why this item can't be made right now, or undefined if it can. The panel's rows and the server's checks both read this. */
export function makeRefusal(
  item: RecipeItem,
  player: HasInventory & { smithingXp: number },
) {
  const { level } = RECIPES[item];
  if (levelFor(player.smithingXp) < level) return `Needs Smithing ${level}`;
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
