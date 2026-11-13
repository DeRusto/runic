import { EMPTY_SLOT } from "./index.ts";
import { GEAR, gearOf, gossamerItem } from "./gear.ts";
import {
  addItems,
  VIRTUES,
  type HasInventory,
  type ItemId,
  itemParts,
  itemTag,
  removeItems,
  slotFor,
} from "./items.ts";
import type { StationKind } from "./stations.ts";
import { levelFor, type XpField } from "./skills.ts";

type MakingSkillRow = {
  /** The skill's synced experience field, which gates its recipes and is paid for them. */
  xpField: XpField;
  /** Where it is made. The first is the fixed station its make walks to and names; a fire comes from the make's own tile. */
  places: readonly StationKind[];
  /** Whether the panel splits its section by metal tier. */
  tiered?: boolean;
  /** Whether a make can burn and comes out Delicious instead of improved (#221). */
  cooks?: boolean;
};

/**
 * Every Making skill, in the Smithing panel's section order. A recipe names only its skill;
 * its station, gate field and paid field all come from here.
 */
export const MAKING_SKILLS = {
  Mining: { xpField: "miningXp", places: ["furnace"], tiered: true },
  Smithing: { xpField: "smithingXp", places: ["anvil"], tiered: true },
  Jewelsmithing: { xpField: "jewelsmithingXp", places: ["anvil"] },
  Cooking: { xpField: "cookingXp", places: ["range", "fire"], cooks: true },
  Crafting: { xpField: "craftingXp", places: ["workbench"] },
  Fletching: { xpField: "fletchingXp", places: ["workbench"] },
  Leatherworking: { xpField: "leatherworkingXp", places: ["workbench"] },
  Runecrafting: { xpField: "runecraftingXp", places: ["altar"] },
} as const satisfies Record<string, MakingSkillRow>;
export type MakingSkill = keyof typeof MAKING_SKILLS;
type MakingXpField = (typeof MAKING_SKILLS)[MakingSkill]["xpField"];

type Recipe = {
  /** The Making skill that gates this recipe and is paid for it. */
  skill: MakingSkill;
  /** That skill's level needed. */
  level: number;
  /** The skill level where one make gives a second rune for the same essence, hand-set per rune (#232). */
  doublesAt?: number;
  /** A cost may be a stand-in: `log` is any tier's log (#228). */
  costs: Partial<Record<ItemId | typeof LOG, number>>;
  ticks: number;
  /** The skill's experience that finishing one pays. */
  xp: number;
  /** How many of the product one make gives, for #228's batches; 1 for the rest. */
  yield?: number;
};

/** Spec §5, as revised by the rebalance spec §3 Making. The order here is the order of the Smithing panel's rows. */
export const RECIPES = {
  copperBar: {
    skill: "Mining",
    level: 1,
    costs: { copperOre: 1 },
    ticks: 6,
    xp: 2,
  },
  bronzeBar: {
    skill: "Mining",
    level: 5,
    costs: { copperOre: 1, tin: 1 },
    ticks: 6,
    xp: 4,
  },
  ironBar: {
    skill: "Mining",
    level: 10,
    costs: { ironOre: 1 },
    ticks: 6,
    xp: 6,
  },
  steelBar: {
    skill: "Mining",
    level: 15,
    costs: { ironOre: 1, coal: 1 },
    ticks: 6,
    xp: 9,
  },
  emberiteBar: {
    skill: "Mining",
    level: 20,
    costs: { emberiteOre: 1 },
    ticks: 6,
    xp: 12,
  },
  copperSword: {
    skill: "Smithing",
    level: 1,
    costs: { copperBar: 3 },
    ticks: 12,
    xp: 18,
  },
  copperShield: {
    skill: "Smithing",
    level: 1,
    costs: { copperBar: 4 },
    ticks: 16,
    xp: 24,
  },
  copperHelmet: {
    skill: "Smithing",
    level: 1,
    costs: { copperBar: 2 },
    ticks: 8,
    xp: 12,
  },
  copperChestplate: {
    skill: "Smithing",
    level: 1,
    costs: { copperBar: 5 },
    ticks: 20,
    xp: 30,
  },
  copperLeggings: {
    skill: "Smithing",
    level: 1,
    costs: { copperBar: 3 },
    ticks: 12,
    xp: 18,
  },
  bronzeSword: {
    skill: "Smithing",
    level: 5,
    costs: { bronzeBar: 3 },
    ticks: 12,
    xp: 36,
  },
  bronzeShield: {
    skill: "Smithing",
    level: 5,
    costs: { bronzeBar: 4 },
    ticks: 16,
    xp: 48,
  },
  bronzeHelmet: {
    skill: "Smithing",
    level: 5,
    costs: { bronzeBar: 2 },
    ticks: 8,
    xp: 24,
  },
  bronzeChestplate: {
    skill: "Smithing",
    level: 5,
    costs: { bronzeBar: 5 },
    ticks: 20,
    xp: 60,
  },
  bronzeLeggings: {
    skill: "Smithing",
    level: 5,
    costs: { bronzeBar: 3 },
    ticks: 12,
    xp: 36,
  },
  ironSword: {
    skill: "Smithing",
    level: 10,
    costs: { ironBar: 3 },
    ticks: 12,
    xp: 54,
  },
  ironShield: {
    skill: "Smithing",
    level: 10,
    costs: { ironBar: 4 },
    ticks: 16,
    xp: 72,
  },
  ironHelmet: {
    skill: "Smithing",
    level: 10,
    costs: { ironBar: 2 },
    ticks: 8,
    xp: 36,
  },
  ironChestplate: {
    skill: "Smithing",
    level: 10,
    costs: { ironBar: 5 },
    ticks: 20,
    xp: 90,
  },
  ironLeggings: {
    skill: "Smithing",
    level: 10,
    costs: { ironBar: 3 },
    ticks: 12,
    xp: 54,
  },
  steelSword: {
    skill: "Smithing",
    level: 15,
    costs: { steelBar: 3 },
    ticks: 12,
    xp: 81,
  },
  steelShield: {
    skill: "Smithing",
    level: 15,
    costs: { steelBar: 4 },
    ticks: 16,
    xp: 108,
  },
  steelHelmet: {
    skill: "Smithing",
    level: 15,
    costs: { steelBar: 2 },
    ticks: 8,
    xp: 54,
  },
  steelChestplate: {
    skill: "Smithing",
    level: 15,
    costs: { steelBar: 5 },
    ticks: 20,
    xp: 135,
  },
  steelLeggings: {
    skill: "Smithing",
    level: 15,
    costs: { steelBar: 3 },
    ticks: 12,
    xp: 81,
  },
  emberiteSword: {
    skill: "Smithing",
    level: 20,
    costs: { emberiteBar: 3, emberbone: 2 },
    ticks: 12,
    xp: 108,
  },
  emberiteShield: {
    skill: "Smithing",
    level: 20,
    costs: { emberiteBar: 4, emberbone: 3 },
    ticks: 16,
    xp: 144,
  },
  emberiteHelmet: {
    skill: "Smithing",
    level: 20,
    costs: { emberiteBar: 2, emberbone: 1 },
    ticks: 8,
    xp: 72,
  },
  emberiteChestplate: {
    skill: "Smithing",
    level: 20,
    costs: { emberiteBar: 5, emberbone: 4 },
    ticks: 20,
    xp: 180,
  },
  emberiteLeggings: {
    skill: "Smithing",
    level: 20,
    costs: { emberiteBar: 3, emberbone: 2 },
    ticks: 12,
    xp: 108,
  },
  /** #228's anvil pieces: arrowheads for Fletching's arrows, and throwing knives for Phase 8's combat. A tier's batch of arrowheads costs one bar and pays 6, and a knife one bar, plus an Emberbone at Emberite like the gear. */
  copperArrowhead: {
    skill: "Smithing",
    level: 1,
    costs: { copperBar: 1 },
    ticks: 6,
    yield: 10,
    xp: 6,
  },
  bronzeArrowhead: {
    skill: "Smithing",
    level: 5,
    costs: { bronzeBar: 1 },
    ticks: 6,
    yield: 10,
    xp: 6,
  },
  ironArrowhead: {
    skill: "Smithing",
    level: 10,
    costs: { ironBar: 1 },
    ticks: 6,
    yield: 10,
    xp: 6,
  },
  steelArrowhead: {
    skill: "Smithing",
    level: 15,
    costs: { steelBar: 1 },
    ticks: 6,
    yield: 10,
    xp: 6,
  },
  emberiteArrowhead: {
    skill: "Smithing",
    level: 20,
    costs: { emberiteBar: 1 },
    ticks: 6,
    yield: 10,
    xp: 6,
  },
  copperThrowingKnife: {
    skill: "Smithing",
    level: 1,
    costs: { copperBar: 1 },
    ticks: 6,
    xp: 6,
  },
  bronzeThrowingKnife: {
    skill: "Smithing",
    level: 5,
    costs: { bronzeBar: 1 },
    ticks: 6,
    xp: 12,
  },
  ironThrowingKnife: {
    skill: "Smithing",
    level: 10,
    costs: { ironBar: 1 },
    ticks: 6,
    xp: 18,
  },
  steelThrowingKnife: {
    skill: "Smithing",
    level: 15,
    costs: { steelBar: 1 },
    ticks: 6,
    xp: 27,
  },
  emberiteThrowingKnife: {
    skill: "Smithing",
    level: 20,
    costs: { emberiteBar: 1, emberbone: 1 },
    ticks: 6,
    xp: 36,
  },
  /** #221's range: one raw fish each, and the same fish again with a berry or a herb (spec #219's shape). Each pays Cooking, and all take as long as a bar. A fire cooks these too, adding its log's burn points (#224). */
  cookedPerch: {
    skill: "Cooking",
    level: 1,
    costs: { perch: 1 },
    ticks: 6,
    xp: 12,
  },
  berryPerch: {
    skill: "Cooking",
    level: 5,
    costs: { perch: 1, berry: 1 },
    ticks: 6,
    xp: 18,
  },
  herbPerch: {
    skill: "Cooking",
    level: 10,
    costs: { perch: 1, herb: 1 },
    ticks: 6,
    xp: 24,
  },
  cookedTrout: {
    skill: "Cooking",
    level: 10,
    costs: { trout: 1 },
    ticks: 6,
    xp: 30,
  },
  berryTrout: {
    skill: "Cooking",
    level: 15,
    costs: { trout: 1, berry: 1 },
    ticks: 6,
    xp: 45,
  },
  herbTrout: {
    skill: "Cooking",
    level: 20,
    costs: { trout: 1, herb: 1 },
    ticks: 6,
    xp: 60,
  },
  cookedPike: {
    skill: "Cooking",
    level: 20,
    costs: { pike: 1 },
    ticks: 6,
    xp: 50,
  },
  berryPike: {
    skill: "Cooking",
    level: 25,
    costs: { pike: 1, berry: 1 },
    ticks: 6,
    xp: 75,
  },
  herbPike: {
    skill: "Cooking",
    level: 30,
    costs: { pike: 1, herb: 1 },
    ticks: 6,
    xp: 100,
  },
  /** #225's workbench: the utilities Crafting makes. The rope and torch wait for the systems that will use them, and the vial is the store's second source. */
  rope: {
    skill: "Crafting",
    level: 1,
    costs: { spiderSilk: 2 },
    ticks: 6,
    xp: 8,
  },
  torch: {
    skill: "Crafting",
    level: 5,
    costs: { birchLog: 1, rope: 1 },
    ticks: 6,
    xp: 14,
  },
  vial: {
    skill: "Crafting",
    level: 10,
    costs: { cinderglass: 1 },
    ticks: 6,
    xp: 20,
  },
  /** #228's workbench: Fletching's stock. A shaft comes from any tier's log, an arrow from ten of each part, and a bow from its own wood and a rope. */
  arrowShaft: {
    skill: "Fletching",
    level: 1,
    costs: { log: 1 },
    ticks: 6,
    yield: 10,
    xp: 2,
  },
  copperArrow: {
    skill: "Fletching",
    level: 1,
    costs: { arrowShaft: 10, copperArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: 8,
  },
  bronzeArrow: {
    skill: "Fletching",
    level: 1,
    costs: { arrowShaft: 10, bronzeArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: 8,
  },
  ironArrow: {
    skill: "Fletching",
    level: 1,
    costs: { arrowShaft: 10, ironArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: 8,
  },
  steelArrow: {
    skill: "Fletching",
    level: 1,
    costs: { arrowShaft: 10, steelArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: 8,
  },
  emberiteArrow: {
    skill: "Fletching",
    level: 1,
    costs: { arrowShaft: 10, emberiteArrowhead: 10, feather: 10 },
    ticks: 6,
    yield: 10,
    xp: 8,
  },
  birchBow: {
    skill: "Fletching",
    level: 1,
    costs: { birchLog: 1, rope: 1 },
    ticks: 6,
    xp: 20,
  },
  oakBow: {
    skill: "Fletching",
    level: 10,
    costs: { oakLog: 1, rope: 1 },
    ticks: 6,
    xp: 50,
  },
  charwoodBow: {
    skill: "Fletching",
    level: 20,
    costs: { charwoodLog: 1, rope: 1 },
    ticks: 6,
    xp: 90,
  },
  /** #232's altar: the four elemental runes, one essence to a rune and never a failure. Once the making skill is at a rune's `doublesAt`, one essence makes two. */
  airRune: {
    skill: "Runecrafting",
    level: 1,
    // Twice the gate, as every rune's doubling level is (#232).
    doublesAt: 2,
    costs: { runeEssence: 1 },
    ticks: 6,
    xp: 5,
  },
  waterRune: {
    skill: "Runecrafting",
    level: 5,
    doublesAt: 10,
    costs: { runeEssence: 1 },
    ticks: 6,
    xp: 8,
  },
  earthRune: {
    skill: "Runecrafting",
    level: 10,
    doublesAt: 20,
    costs: { runeEssence: 1 },
    ticks: 6,
    xp: 12,
  },
  fireRune: {
    skill: "Runecrafting",
    level: 20,
    doublesAt: 40,
    costs: { runeEssence: 1 },
    ticks: 6,
    xp: 20,
  },
  /**
   * #238's Leatherworking, at the workbench: hands and feet of a tier from the band's hides
   * — Tarn Ox's for Copper and Bronze, Bristleback's for Iron and Steel, Cinderhorn's at
   * Emberite, with the metal gear's Emberbone. Bronze and Steel take the extra hide, and
   * the experience is 10–50 by tier (#237).
   */
  copperGloves: {
    skill: "Leatherworking",
    level: 1,
    costs: { tarnHide: 2 },
    ticks: 8,
    xp: 10,
  },
  copperBoots: {
    skill: "Leatherworking",
    level: 1,
    costs: { tarnHide: 2 },
    ticks: 8,
    xp: 10,
  },
  bronzeGloves: {
    skill: "Leatherworking",
    level: 5,
    costs: { tarnHide: 3 },
    ticks: 8,
    xp: 20,
  },
  bronzeBoots: {
    skill: "Leatherworking",
    level: 5,
    costs: { tarnHide: 3 },
    ticks: 8,
    xp: 20,
  },
  ironGloves: {
    skill: "Leatherworking",
    level: 10,
    costs: { bristleHide: 2 },
    ticks: 8,
    xp: 30,
  },
  ironBoots: {
    skill: "Leatherworking",
    level: 10,
    costs: { bristleHide: 2 },
    ticks: 8,
    xp: 30,
  },
  steelGloves: {
    skill: "Leatherworking",
    level: 15,
    costs: { bristleHide: 3 },
    ticks: 8,
    xp: 40,
  },
  steelBoots: {
    skill: "Leatherworking",
    level: 15,
    costs: { bristleHide: 3 },
    ticks: 8,
    xp: 40,
  },
  emberiteGloves: {
    skill: "Leatherworking",
    level: 20,
    costs: { cinderHide: 2, emberbone: 1 },
    ticks: 8,
    xp: 50,
  },
  emberiteBoots: {
    skill: "Leatherworking",
    level: 20,
    costs: { cinderHide: 2, emberbone: 1 },
    ticks: 8,
    xp: 50,
  },
  /**
   * #238's 15 capes, the Crafting build's pieces: two of the band's hides and the rope for
   * the cord (#237). Experience is 15–75 by tier.
   */
  copperMightCape: {
    skill: "Leatherworking",
    level: 1,
    costs: { tarnHide: 2, rope: 1 },
    ticks: 12,
    xp: 15,
  },
  copperFortitudeCape: {
    skill: "Leatherworking",
    level: 1,
    costs: { tarnHide: 2, rope: 1 },
    ticks: 12,
    xp: 15,
  },
  copperAvoidanceCape: {
    skill: "Leatherworking",
    level: 1,
    costs: { tarnHide: 2, rope: 1 },
    ticks: 12,
    xp: 15,
  },
  bronzeMightCape: {
    skill: "Leatherworking",
    level: 5,
    costs: { tarnHide: 2, rope: 1 },
    ticks: 12,
    xp: 30,
  },
  bronzeFortitudeCape: {
    skill: "Leatherworking",
    level: 5,
    costs: { tarnHide: 2, rope: 1 },
    ticks: 12,
    xp: 30,
  },
  bronzeAvoidanceCape: {
    skill: "Leatherworking",
    level: 5,
    costs: { tarnHide: 2, rope: 1 },
    ticks: 12,
    xp: 30,
  },
  ironMightCape: {
    skill: "Leatherworking",
    level: 10,
    costs: { bristleHide: 2, rope: 1 },
    ticks: 12,
    xp: 45,
  },
  ironFortitudeCape: {
    skill: "Leatherworking",
    level: 10,
    costs: { bristleHide: 2, rope: 1 },
    ticks: 12,
    xp: 45,
  },
  ironAvoidanceCape: {
    skill: "Leatherworking",
    level: 10,
    costs: { bristleHide: 2, rope: 1 },
    ticks: 12,
    xp: 45,
  },
  steelMightCape: {
    skill: "Leatherworking",
    level: 15,
    costs: { bristleHide: 2, rope: 1 },
    ticks: 12,
    xp: 60,
  },
  steelFortitudeCape: {
    skill: "Leatherworking",
    level: 15,
    costs: { bristleHide: 2, rope: 1 },
    ticks: 12,
    xp: 60,
  },
  steelAvoidanceCape: {
    skill: "Leatherworking",
    level: 15,
    costs: { bristleHide: 2, rope: 1 },
    ticks: 12,
    xp: 60,
  },
  emberiteMightCape: {
    skill: "Leatherworking",
    level: 20,
    costs: { cinderHide: 2, rope: 1 },
    ticks: 12,
    xp: 75,
  },
  emberiteFortitudeCape: {
    skill: "Leatherworking",
    level: 20,
    costs: { cinderHide: 2, rope: 1 },
    ticks: 12,
    xp: 75,
  },
  emberiteAvoidanceCape: {
    skill: "Leatherworking",
    level: 20,
    costs: { cinderHide: 2, rope: 1 },
    ticks: 12,
    xp: 75,
  },
  /**
   * #238's Jewelsmithing, at the anvil: a neck and a ring of every tier, from a bar alone
   * at Copper and Bronze and with the tier-matched gem from Iron up (#237). Experience is
   * 15–75 by tier, and they roll improved versions like every gear piece.
   */
  copperAmulet: {
    skill: "Jewelsmithing",
    level: 1,
    costs: { copperBar: 1 },
    ticks: 6,
    xp: 15,
  },
  copperRing: {
    skill: "Jewelsmithing",
    level: 1,
    costs: { copperBar: 1 },
    ticks: 6,
    xp: 15,
  },
  bronzeAmulet: {
    skill: "Jewelsmithing",
    level: 5,
    costs: { bronzeBar: 1 },
    ticks: 6,
    xp: 30,
  },
  bronzeRing: {
    skill: "Jewelsmithing",
    level: 5,
    costs: { bronzeBar: 1 },
    ticks: 6,
    xp: 30,
  },
  ironAmulet: {
    skill: "Jewelsmithing",
    level: 10,
    costs: { ironBar: 1, ashstone: 1 },
    ticks: 6,
    xp: 45,
  },
  ironRing: {
    skill: "Jewelsmithing",
    level: 10,
    costs: { ironBar: 1, ashstone: 1 },
    ticks: 6,
    xp: 45,
  },
  steelAmulet: {
    skill: "Jewelsmithing",
    level: 15,
    costs: { steelBar: 1, cinderglass: 1 },
    ticks: 6,
    xp: 60,
  },
  steelRing: {
    skill: "Jewelsmithing",
    level: 15,
    costs: { steelBar: 1, cinderglass: 1 },
    ticks: 6,
    xp: 60,
  },
  emberiteAmulet: {
    skill: "Jewelsmithing",
    level: 20,
    costs: { emberiteBar: 1, heartflame: 1 },
    ticks: 6,
    xp: 75,
  },
  emberiteRing: {
    skill: "Jewelsmithing",
    level: 20,
    costs: { emberiteBar: 1, heartflame: 1 },
    ticks: 6,
    xp: 75,
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
    skill: "Crafting",
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
/** The recipe or augmentation this make names, whose skill, gate and wait they share (#225). */
export const makingOf = (item: MakeItem) =>
  recipeOf(item) ?? augmentationOf(item)!;
/** The Making skill row this make belongs to. */
export const makingSkillOf = (
  item: MakeItem,
): MakingSkillRow & { xpField: MakingXpField } =>
  MAKING_SKILLS[makingOf(item).skill];
/** The fixed station this make walks to and names in its event; a fire stands in for Cooking's by tile (#224). */
export const stationOf = (item: MakeItem) => makingSkillOf(item).places[0]!;

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
  return [[makingSkillOf(item).xpField, makingOf(item).xp]];
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
  player: Record<MakingXpField, number>,
) {
  const { level, skill } = makingOf(item);
  return levelFor(player[MAKING_SKILLS[skill].xpField]) < level
    ? `Needs ${skill} ${level}`
    : undefined;
}

/** Why this can't be made right now, or undefined if it can. The panel's rows and the server's checks both read this. */
export function makeRefusal(
  item: MakeItem,
  player: HasInventory & Record<MakingXpField, number>,
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

/** What finishing one make does: refused, which ends a Make all, or done, with what the player now holds and is paid. */
export type MakeOutcome =
  | { refused: string }
  | {
      inventory: string[];
      inventoryCounts: number[];
      xp: [XpField, number][];
      /** The id made; none when a burn consumed the materials (#221). */
      made?: string;
      /** A line for the player, such as a burn's, and the items it names. */
      told?: { line: string; items: string[] };
    };

const FULL = { refused: "Your inventory is full." } as const;

/**
 * Finishes one make of `item`: swaps the materials for the product and the experience, all at
 * once on copies, or refuses with a line saying why. `player` is only read. Rolls in a fixed
 * order, burn then improved or Delicious, and never after a refusal, so a seeded `random` replays.
 * `extraBurnPercent` is the fire's, for Cooking over one (#224).
 */
export function make(
  item: MakeItem,
  player: HasInventory & Record<MakingXpField, number>,
  random: () => number,
  extraBurnPercent = 0,
): MakeOutcome {
  // Dropping during the wait is allowed, so the materials may have gone.
  const refusal = makeRefusal(item, player);
  if (refusal) return { refused: refusal };
  const inventory = [...player.inventory];
  const inventoryCounts = [...player.inventoryCounts];
  const { xpField, cooks } = makingSkillOf(item);
  const augmentation = augmentationOf(item);
  if (augmentation) {
    // No roll: the product is the first held cape's gossamer variant, keeping its Quality and Virtue (#217, #225).
    const cape = capeIn(player)!;
    const made = gossamerItem(cape);
    removeItems(inventory, inventoryCounts, augmentation.reagent, 1);
    removeItems(inventory, inventoryCounts, cape, 1);
    const slot = slotFor(made, { inventory, inventoryCounts });
    if (slot < 0) return FULL;
    inventory[slot] = made;
    inventoryCounts[slot]!++;
    return {
      inventory,
      inventoryCounts,
      xp: [[xpField, augmentation.xp]],
      made,
    };
  }
  const recipe = item as RecipeItem;
  const level = levelFor(player[xpField]);
  // A burn consumes the materials: no experience, no item, and Make all goes on (#221). It never rolls Delicious.
  if (
    cooks &&
    random() < (burnPercent(recipe, level) + extraBurnPercent) / 100
  ) {
    for (const [cost, count] of costsOf(recipe))
      removeItems(inventory, inventoryCounts, cost, count);
    return {
      inventory,
      inventoryCounts,
      xp: [],
      told: { line: `You burn the ${itemTag(recipe)}.`, items: [recipe] },
    };
  }
  for (const [cost, count] of costsOf(recipe)) {
    let left = count;
    // A stand-in cost takes any tier of its kind, first held first, like an augmentation's cape (#228).
    const takes: string[] = cost === LOG ? [...LOGS] : [cost];
    inventory.forEach((held, slot) => {
      if (!takes.includes(held) || !left) return;
      const taken = Math.min(left, inventoryCounts[slot]!);
      left -= taken;
      inventoryCounts[slot]! -= taken;
      if (!inventoryCounts[slot]) inventory[slot] = EMPTY_SLOT;
    });
  }
  // On the copy, so the last ore in a full inventory leaves room for its bar. Gear never
  // stacks, so the plain item needs the same room as an improved one, and a refused make rolls nothing.
  if (slotFor(recipe, { inventory, inventoryCounts }) < 0) return FULL;
  // The improved chance is the making skill's, so a bow rolls on Fletching (#228).
  const made = cooks
    ? cookedItem(recipe, level, random)
    : madeItem(recipe, level, random);
  // A Delicious fish can't join a stack of plain ones, so it needs room of its own; a plain
  // batch tops up every stack of it with room before filling empty slots, refusing whole if it
  // doesn't all fit (#228). At a rune's doubling level one essence makes two runes, and each
  // rune pays its experience (#232).
  const times = doublesAt(recipe, level) ? 2 : 1;
  if (made === recipe) {
    if (addItems(inventory, inventoryCounts, made, yieldOf(recipe) * times))
      return FULL;
  } else {
    const slot = slotFor(made, { inventory, inventoryCounts });
    if (slot < 0) return FULL;
    inventory[slot] = made;
    inventoryCounts[slot]!++;
  }
  return {
    inventory,
    inventoryCounts,
    xp: [[xpField, RECIPES[recipe].xp * times]],
    made,
  };
}
