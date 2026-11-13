import { toolRefusal } from "./tools.ts";
import { GEAR, gearOf } from "./gear.ts";
import { VIRTUES, type HasInventory, type ItemId, itemParts } from "./items.ts";
import { questDoneOf } from "./quests.ts";
import type { StationKind } from "./region.ts";
import { levelFor, type XpField } from "./skills.ts";

type Recipe = {
  station: StationKind;
  /** The skill that gates this recipe: the furnace's is Mining, the anvil's Smithing, the range's Cooking, the workbench's Crafting and Fletching (#225, #228), and the altar's Runecrafting (#232). */
  skill:
    | "Mining"
    | "Smithing"
    | "Cooking"
    | "Crafting"
    | "Fletching"
    | "Runecrafting";
  /** That skill's synced experience field. */
  xpField:
    | "miningXp"
    | "smithingXp"
    | "cookingXp"
    | "craftingXp"
    | "fletchingXp"
    | "runecraftingXp";
  /** That skill's level needed. */
  level: number;
  /** The skill level where one make gives a second rune for the same essence, hand-set per rune (#232). */
  doublesAt?: number;
  /** A cost may be a stand-in: `log` is any tier's log (#228). */
  costs: Partial<Record<ItemId | typeof LOG, number>>;
  ticks: number;
  /** What finishing one grants, in each skill. */
  xp: Partial<Record<XpField, number>>;
  /** How many of the product one make gives, for #228's batches; 1 for the rest. */
  yield?: number;
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
  /** #228's anvil pieces: arrowheads for Fletching's arrows, and throwing knives for Phase 8's combat. A tier's batch of arrowheads costs one bar and pays 6, and a knife one bar, plus an Emberbone at Emberite like the gear. */
  copperArrowhead: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 1,
    costs: { copperBar: 1 },
    ticks: 6,
    yield: 10,
    xp: { smithingXp: 6 },
  },
  bronzeArrowhead: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 5,
    costs: { bronzeBar: 1 },
    ticks: 6,
    yield: 10,
    xp: { smithingXp: 6 },
  },
  ironArrowhead: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 10,
    costs: { ironBar: 1 },
    ticks: 6,
    yield: 10,
    xp: { smithingXp: 6 },
  },
  steelArrowhead: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 15,
    costs: { steelBar: 1 },
    ticks: 6,
    yield: 10,
    xp: { smithingXp: 6 },
  },
  emberiteArrowhead: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 20,
    costs: { emberiteBar: 1 },
    ticks: 6,
    yield: 10,
    xp: { smithingXp: 6 },
  },
  copperThrowingKnife: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 1,
    costs: { copperBar: 1 },
    ticks: 6,
    xp: { smithingXp: 6 },
  },
  bronzeThrowingKnife: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 5,
    costs: { bronzeBar: 1 },
    ticks: 6,
    xp: { smithingXp: 12 },
  },
  ironThrowingKnife: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 10,
    costs: { ironBar: 1 },
    ticks: 6,
    xp: { smithingXp: 18 },
  },
  steelThrowingKnife: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 15,
    costs: { steelBar: 1 },
    ticks: 6,
    xp: { smithingXp: 27 },
  },
  emberiteThrowingKnife: {
    station: "anvil",
    skill: "Smithing",
    xpField: "smithingXp",
    level: 20,
    costs: { emberiteBar: 1, emberbone: 1 },
    ticks: 6,
    xp: { smithingXp: 36 },
  },
  /** #221's range: one raw fish each, and the same fish again with a berry or a herb (spec #219's shape). Each pays Cooking, and all take as long as a bar. A fire cooks these too, adding its log's burn points (#224). */
  cookedPerch: {
    station: "range",
    skill: "Cooking",
    xpField: "cookingXp",
    level: 1,
    costs: { perch: 1 },
    ticks: 6,
    xp: { cookingXp: 12 },
  },
  berryPerch: {
    station: "range",
    skill: "Cooking",
    xpField: "cookingXp",
    level: 5,
    costs: { perch: 1, berry: 1 },
    ticks: 6,
    xp: { cookingXp: 18 },
  },
  herbPerch: {
    station: "range",
    skill: "Cooking",
    xpField: "cookingXp",
    level: 10,
    costs: { perch: 1, herb: 1 },
    ticks: 6,
    xp: { cookingXp: 24 },
  },
  cookedTrout: {
    station: "range",
    skill: "Cooking",
    xpField: "cookingXp",
    level: 10,
    costs: { trout: 1 },
    ticks: 6,
    xp: { cookingXp: 30 },
  },
  berryTrout: {
    station: "range",
    skill: "Cooking",
    xpField: "cookingXp",
    level: 15,
    costs: { trout: 1, berry: 1 },
    ticks: 6,
    xp: { cookingXp: 45 },
  },
  herbTrout: {
    station: "range",
    skill: "Cooking",
    xpField: "cookingXp",
    level: 20,
    costs: { trout: 1, herb: 1 },
    ticks: 6,
    xp: { cookingXp: 60 },
  },
  cookedPike: {
    station: "range",
    skill: "Cooking",
    xpField: "cookingXp",
    level: 20,
    costs: { pike: 1 },
    ticks: 6,
    xp: { cookingXp: 50 },
  },
  berryPike: {
    station: "range",
    skill: "Cooking",
    xpField: "cookingXp",
    level: 25,
    costs: { pike: 1, berry: 1 },
    ticks: 6,
    xp: { cookingXp: 75 },
  },
  herbPike: {
    station: "range",
    skill: "Cooking",
    xpField: "cookingXp",
    level: 30,
    costs: { pike: 1, herb: 1 },
    ticks: 6,
    xp: { cookingXp: 100 },
  },
  /** #225's workbench: the utilities Crafting makes. The rope and torch wait for the systems that will use them, and the vial is the store's second source. */
  rope: {
    station: "workbench",
    skill: "Crafting",
    xpField: "craftingXp",
    level: 1,
    costs: { spiderSilk: 2 },
    ticks: 6,
    xp: { craftingXp: 8 },
  },
  torch: {
    station: "workbench",
    skill: "Crafting",
    xpField: "craftingXp",
    level: 5,
    costs: { birchLog: 1, rope: 1 },
    ticks: 6,
    xp: { craftingXp: 14 },
  },
  vial: {
    station: "workbench",
    skill: "Crafting",
    xpField: "craftingXp",
    level: 10,
    costs: { cinderglass: 1 },
    ticks: 6,
    xp: { craftingXp: 20 },
  },
  /** #228's workbench: Fletching's stock. A shaft comes from any tier's log, an arrow from ten of each part, and a bow from its own wood and a rope. */
  arrowShaft: {
    station: "workbench",
    skill: "Fletching",
    xpField: "fletchingXp",
    level: 1,
    costs: { log: 1 },
    ticks: 6,
    yield: 10,
    xp: { fletchingXp: 2 },
  },
  copperArrow: {
    station: "workbench",
    skill: "Fletching",
    xpField: "fletchingXp",
    level: 1,
    costs: { arrowShaft: 10, copperArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: { fletchingXp: 8 },
  },
  bronzeArrow: {
    station: "workbench",
    skill: "Fletching",
    xpField: "fletchingXp",
    level: 1,
    costs: { arrowShaft: 10, bronzeArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: { fletchingXp: 8 },
  },
  ironArrow: {
    station: "workbench",
    skill: "Fletching",
    xpField: "fletchingXp",
    level: 1,
    costs: { arrowShaft: 10, ironArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: { fletchingXp: 8 },
  },
  steelArrow: {
    station: "workbench",
    skill: "Fletching",
    xpField: "fletchingXp",
    level: 1,
    costs: { arrowShaft: 10, steelArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: { fletchingXp: 8 },
  },
  emberiteArrow: {
    station: "workbench",
    skill: "Fletching",
    xpField: "fletchingXp",
    level: 1,
    costs: { arrowShaft: 10, emberiteArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: { fletchingXp: 8 },
  },
  birchBow: {
    station: "workbench",
    skill: "Fletching",
    xpField: "fletchingXp",
    level: 1,
    costs: { birchLog: 1, rope: 1 },
    ticks: 6,
    xp: { fletchingXp: 20 },
  },
  oakBow: {
    station: "workbench",
    skill: "Fletching",
    xpField: "fletchingXp",
    level: 10,
    costs: { oakLog: 1, rope: 1 },
    ticks: 6,
    xp: { fletchingXp: 50 },
  },
  charwoodBow: {
    station: "workbench",
    skill: "Fletching",
    xpField: "fletchingXp",
    level: 20,
    costs: { charwoodLog: 1, rope: 1 },
    ticks: 6,
    xp: { fletchingXp: 90 },
  },
  /** #232's altar: the four elemental runes, one essence to a rune and never a failure. Once the making skill is at a rune's `doublesAt`, one essence makes two. */
  airRune: {
    station: "altar",
    skill: "Runecrafting",
    xpField: "runecraftingXp",
    level: 1,
    // Twice the gate, as every rune's doubling level is (#232).
    doublesAt: 2,
    costs: { runeEssence: 1 },
    ticks: 6,
    xp: { runecraftingXp: 5 },
  },
  waterRune: {
    station: "altar",
    skill: "Runecrafting",
    xpField: "runecraftingXp",
    level: 5,
    doublesAt: 10,
    costs: { runeEssence: 1 },
    ticks: 6,
    xp: { runecraftingXp: 8 },
  },
  earthRune: {
    station: "altar",
    skill: "Runecrafting",
    xpField: "runecraftingXp",
    level: 10,
    doublesAt: 20,
    costs: { runeEssence: 1 },
    ticks: 6,
    xp: { runecraftingXp: 12 },
  },
  fireRune: {
    station: "altar",
    skill: "Runecrafting",
    xpField: "runecraftingXp",
    level: 20,
    doublesAt: 40,
    costs: { runeEssence: 1 },
    ticks: 6,
    xp: { runecraftingXp: 20 },
  },
} as const satisfies Partial<Record<ItemId, Recipe>>;
export type RecipeItem = keyof typeof RECIPES;

/**
 * #217's reagent augmentation, owned by Crafting (#225): the reagent and the first cape in the
 * player's inventory, of any tier, become that cape's gossamer variant, which keeps the cape's
 * Quality and Virtue and adds a little Avoidance. Keyed by the work, not the product: the
 * product is the cape's own id with the variant on the end (ADR 0004).
 */
export const AUGMENTATIONS = {
  gossamerCloak: {
    station: "workbench",
    skill: "Crafting",
    xpField: "craftingXp",
    level: 15,
    reagent: "spiderSilk",
    ticks: 6,
    xp: 25,
  },
} as const;
export type AugmentationKind = keyof typeof AUGMENTATIONS;
/** What the make intent names: a recipe's product, or an augmentation (#225). */
export type MakeItem = RecipeItem | AugmentationKind;

/** The stand-in material id for an augmentation's cape, which any cape counts as (#217). */
export const CAPE = "cape";
/** The stand-in material id for a shaft's log, which any tier's log counts as (#228). */
export const LOG = "log";
/** The logs a `log` cost stands for, cheapest first (#228). */
export const LOGS = ["birchLog", "oakLog", "charwoodLog"] as const;

/**
 * The recipe this make names, or undefined if it names an augmentation. The hasOwn check is
 * the type's: a key of either table is a key of one alone.
 */
export function recipeOf(item: MakeItem) {
  return Object.hasOwn(RECIPES, item) ? RECIPES[item as RecipeItem] : undefined;
}
/** The augmentation this make names, or undefined if it names a recipe (#225). */
export function augmentationOf(item: MakeItem) {
  return Object.hasOwn(AUGMENTATIONS, item)
    ? AUGMENTATIONS[item as AugmentationKind]
    : undefined;
}
/** The recipe or augmentation this make names, whose station, gate and wait they share (#225). */
export const makingOf = (item: MakeItem) =>
  recipeOf(item) ?? augmentationOf(item)!;

/** Whether this id is a cape an augmentation can work on: a cape piece that isn't already a variant (#217). */
const isCape = (item: string) =>
  item !== "" &&
  gearOf(item)?.slot === "cape" &&
  itemParts(item).variant === undefined;

/** The first cape in the player's inventory that an augmentation can work on, or undefined if they hold none (#217). */
export function capeIn(player: HasInventory) {
  return [...player.inventory].find(isCape);
}

/** How many capes the player holds that an augmentation can work on (#217). */
export const capesIn = (player: HasInventory) =>
  [...player.inventory].filter(isCape).length;

/** How many of a make's material the player holds: a stack's count, or, for the cape and log stand-ins, how many of the kind (#225, #228). */
export const heldOf = (material: string, player: HasInventory) =>
  material === CAPE
    ? capesIn(player)
    : material === LOG
      ? LOGS.reduce((total, log) => total + countOf(log, player), 0)
      : countOf(material, player);

/**
 * A make's materials as [id, count] pairs, as a recipe's costs give them: an augmentation's
 * are its reagent and its cape, which any cape counts as (#225).
 */
export function materialLines(item: MakeItem): [string, number][] {
  const augmentation = augmentationOf(item);
  if (augmentation)
    return [
      [augmentation.reagent, 1],
      [CAPE, 1],
    ];
  return costsOf(item as RecipeItem);
}

/** What one make grants, as [xpField, amount] pairs: a recipe's grants, or an augmentation's single one (#225). */
export function xpLines(item: MakeItem): [XpField, number][] {
  const augmentation = augmentationOf(item);
  if (augmentation) return [[augmentation.xpField, augmentation.xp]];
  return xpOf(item as RecipeItem);
}

/** The chance, in tenths of a percent, that gear made at its recipe's level is improved (spec §3). */
export const IMPROVED_PER_MILLE_AT_GATE = 40;
/** Added to the improved chance, in tenths of a percent, per Smithing level above the recipe's (spec §3). */
export const IMPROVED_PER_MILLE_PER_LEVEL = 2;
/** The most the improved chance reaches, in tenths of a percent (spec §3). */
export const IMPROVED_PER_MILLE_CAP = 200;
/** One improved item in five is rare; the rest are uncommon (spec §3). */
export const RARE_SHARE_OF_IMPROVED = 1 / 5;

/** The chance, in tenths of a percent, that food cooked at its recipe's level comes out Delicious (#221). */
export const DELICIOUS_PER_MILLE_AT_GATE = 40;
/** Added to the Delicious chance, in tenths of a percent, per Cooking level above the recipe's (#221). */
export const DELICIOUS_PER_MILLE_PER_LEVEL = 2;
/** The most the Delicious chance reaches, in tenths of a percent (#221). */
export const DELICIOUS_PER_MILLE_CAP = 200;

/** The percent of fish cooked at its recipe's level that burns (#221). */
export const BURN_PERCENT_AT_GATE = 25;
/** Taken off the burn chance, in percent, per Cooking level above the recipe's, floored at 0 (#221). */
export const BURN_PERCENT_PER_LEVEL = 1;

/** The id of one `item` made at this Smithing level: gear rolls whether it is improved, then rare, then its Virtue (spec §2). Anything else is never improved. */
export function madeItem(
  item: RecipeItem,
  level: number,
  random: () => number,
): string {
  if (!GEAR.has(item)) return item;
  const perMille = Math.min(
    IMPROVED_PER_MILLE_AT_GATE +
      IMPROVED_PER_MILLE_PER_LEVEL * (level - RECIPES[item].level),
    IMPROVED_PER_MILLE_CAP,
  );
  if (random() >= perMille / 1000) return item;
  const quality = random() < RARE_SHARE_OF_IMPROVED ? "rare" : "uncommon";
  const virtue = VIRTUES[Math.floor(random() * VIRTUES.length)];
  return `${item}:${quality}:${virtue}`;
}

/** The id of one `item` cooked at this Cooking level: food rolls whether it comes out Delicious, by the improved-item formula (#221). */
export function cookedItem(
  item: RecipeItem,
  level: number,
  random: () => number,
): string {
  const perMille = Math.min(
    DELICIOUS_PER_MILLE_AT_GATE +
      DELICIOUS_PER_MILLE_PER_LEVEL * (level - RECIPES[item].level),
    DELICIOUS_PER_MILLE_CAP,
  );
  return random() < perMille / 1000 ? `${item}:delicious` : item;
}

/** The percent of `item` that burns when cooked at this Cooking level, floored at 0 (#221). */
export const burnPercent = (item: RecipeItem, level: number) =>
  Math.max(
    0,
    BURN_PERCENT_AT_GATE -
      BURN_PERCENT_PER_LEVEL * (level - RECIPES[item].level),
  );

export const costsOf = (item: RecipeItem) =>
  Object.entries(RECIPES[item].costs) as [ItemId | typeof LOG, number][];

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

/** Why the player's level is too low to make this, or undefined if it isn't. The panel folds a tier on it. */
export function levelRefusal(
  item: MakeItem,
  player: Record<Recipe["xpField"], number>,
) {
  const { level, skill, xpField } = makingOf(item);
  return levelFor(player[xpField]) < level
    ? `Needs ${skill} ${level}`
    : undefined;
}

/** Why this can't be made right now, or undefined if it can. The panel's rows and the server's checks both read this. */
export function makeRefusal(
  item: MakeItem,
  player: HasInventory & Record<Recipe["xpField"], number>,
) {
  const tooLow = levelRefusal(item, player);
  if (tooLow) return tooLow;
  const augmentation = augmentationOf(item);
  if (augmentation) {
    const { reagent } = augmentation;
    // The cape it works on is the other half of the cost (#217).
    if (countOf(reagent, player) < 1 || !capeIn(player))
      return "Not enough materials";
    return undefined;
  }
  if (materialLines(item).some(([cost, count]) => heldOf(cost, player) < count))
    return "Not enough materials";
  return undefined;
}

/** How many of a recipe's product one make gives: 1 for everything but #228's batches. */
export const yieldOf = (item: RecipeItem) =>
  (RECIPES[item] as { yield?: number }).yield ?? 1;

/** Whether one make of `item` at this level of its skill gives a second rune for the same essence (#232). */
export const doublesAt = (item: RecipeItem, level: number) =>
  (RECIPES[item] as { doublesAt?: number }).doublesAt !== undefined &&
  level >= (RECIPES[item] as { doublesAt?: number }).doublesAt!;

/** Why a click on this station is refused, or undefined if it isn't. The client shows it, and the server ignores the pick. The smithy's furnace and anvil open only for Odo's quest done (#231). */
export function stationRefusal(
  station: StationKind,
  player: {
    tools: Iterable<string>;
    quests?: Iterable<unknown>;
    questStages?: Iterable<unknown>;
  },
) {
  if (station === "anvil") {
    const noHammer = toolRefusal("hammer", player);
    if (noHammer) return noHammer;
  }
  if (
    (station === "furnace" || station === "anvil") &&
    !questDoneOf(player, "odoCopper")
  )
    return "You need to help Odo first.";
  return undefined;
}
