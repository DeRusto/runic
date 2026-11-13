import { itemParts, VIRTUES, type Virtue } from "./items.ts";
import { TIERS } from "./region.ts";
import { levelFor } from "./skills.ts";

/** The names of a player's synced gear fields, which are also their save columns. */
export const GEAR_SLOTS = [
  "weapon",
  "shield",
  "head",
  "body",
  "legs",
  "hands",
  "feet",
  "cape",
  "neck",
  "ring",
] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

const DEFENSE = { skill: "Defense", xp: "defenseXp" } as const;
/** The skill that decides who can use what goes in each slot that has gear yet (spec §5). */
const GATES = {
  weapon: { skill: "Combat", xp: "combatXp" },
  shield: DEFENSE,
  head: DEFENSE,
  body: DEFENSE,
  legs: DEFENSE,
  cape: DEFENSE,
} as const;

type Gear = {
  slot: keyof typeof GATES;
  /** The level of the slot's gating skill needed to equip it. */
  level: number;
  /** What the Gear tab says it does. */
  does: string;
  hitBonus?: number;
  /** The base chance, 0..1, of blocking a hit that would have landed. */
  blockChance?: number;
  /** The percentage taken off a hit that lands. Worn pieces add together. */
  armourPercent?: number;
};

const sword = (level: number, hitBonus: number): Gear => ({
  slot: "weapon",
  level,
  does: `Adds ${hitBonus} to your minimum and maximum hit`,
  hitBonus,
});

const shield = (level: number, blockPercent: number): Gear => ({
  slot: "shield",
  level,
  does: `Starts at a ${blockPercent}% chance to block a hit`,
  blockChance: blockPercent / 100,
});

const armour = (
  slot: "head" | "body" | "legs",
  level: number,
  armourPercent: number,
): Gear => ({
  slot,
  level,
  does: `Takes ${armourPercent}% off each hit you take`,
  armourPercent,
});

/** A cape is small armour on the hands' line (#217), and the slot reagent augmentation works on. */
const cape = (level: number, armourPercent: number): Gear => ({
  slot: "cape",
  level,
  does: `Takes ${armourPercent}% off each hit you take`,
  armourPercent,
});

/** Added to a shield's chance per Blocking level above 1 (spec §5). */
export const BLOCK_CHANCE_PER_BLOCKING_LEVEL = 0.002;

/** Spec §5, with Bronze and Steel at the midpoints (rebalance spec §3 Gear), by item id. Anything in here can be equipped. */
export const GEAR = new Map<string, Gear>([
  ["copperSword", sword(1, 100)],
  ["bronzeSword", sword(5, 150)],
  ["ironSword", sword(10, 200)],
  ["steelSword", sword(15, 250)],
  ["emberiteSword", sword(20, 300)],
  ["copperShield", shield(1, 10)],
  ["bronzeShield", shield(5, 15)],
  ["ironShield", shield(10, 20)],
  ["steelShield", shield(15, 25)],
  ["emberiteShield", shield(20, 30)],
  ["copperHelmet", armour("head", 1, 2)],
  ["copperChestplate", armour("body", 1, 4)],
  ["copperLeggings", armour("legs", 1, 2)],
  ["bronzeHelmet", armour("head", 5, 3)],
  ["bronzeChestplate", armour("body", 5, 6)],
  ["bronzeLeggings", armour("legs", 5, 3)],
  ["ironHelmet", armour("head", 10, 4)],
  ["ironChestplate", armour("body", 10, 8)],
  ["ironLeggings", armour("legs", 10, 4)],
  ["steelHelmet", armour("head", 15, 5)],
  ["steelChestplate", armour("body", 15, 10)],
  ["steelLeggings", armour("legs", 15, 5)],
  ["emberiteHelmet", armour("head", 20, 6)],
  ["emberiteChestplate", armour("body", 20, 12)],
  ["emberiteLeggings", armour("legs", 20, 6)],
  // #217's capes, three Virtues to a tier: might, fortitude, avoidance, on the hands' armour line.
  ["copperMightCape", cape(1, 1)],
  ["copperFortitudeCape", cape(1, 1)],
  ["copperAvoidanceCape", cape(1, 1)],
  ["bronzeMightCape", cape(5, 2)],
  ["bronzeFortitudeCape", cape(5, 2)],
  ["bronzeAvoidanceCape", cape(5, 2)],
  ["ironMightCape", cape(10, 3)],
  ["ironFortitudeCape", cape(10, 3)],
  ["ironAvoidanceCape", cape(10, 3)],
  ["steelMightCape", cape(15, 4)],
  ["steelFortitudeCape", cape(15, 4)],
  ["steelAvoidanceCape", cape(15, 4)],
  ["emberiteMightCape", cape(20, 5)],
  ["emberiteFortitudeCape", cape(20, 5)],
  ["emberiteAvoidanceCape", cape(20, 5)],
]);

/** The gear an item id is, improved or not, or undefined if it isn't gear. An improved piece has its common form's stats and gate (spec §2). */
export const gearOf = (item: string) => GEAR.get(itemParts(item).base);

/** The percentage all worn armour takes off a hit. */
export const armourPercentOf = (player: Partial<Record<GearSlot, string>>) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + (gearOf(player[slot] ?? "")?.armourPercent ?? 0),
    0,
  );

/** Avoidance is held in tenths of a point off an enemy's chance to hit. */
export const AVOIDANCE_TENTHS_PER_POINT = 10;

/** Each Virtue's unit, its size on an uncommon Copper piece (spec §3), and what the Gear tab says it does at a size (spec §5). Fortitude is in health, Might in the sword bonus's units, and Avoidance in tenths of a point. */
const VIRTUE_EFFECTS: Record<
  Virtue,
  { unit: number; does: (size: number) => string }
> = {
  fortitude: { unit: 20, does: (size) => `Adds ${size} to your max health.` },
  might: {
    unit: 3,
    does: (size) => `Adds ${size} to your minimum and maximum hit.`,
  },
  avoidance: {
    unit: 1,
    does: (tenths) =>
      `Takes ${tenths / AVOIDANCE_TENTHS_PER_POINT} points off an enemy's chance to hit you.`,
  },
};

/** The size of `item`'s Virtue, 0 for a common piece. Its unit is multiplied by the tier number, read from the base id's prefix, and rare is double uncommon (spec §3). */
function virtueSize(item: string) {
  const { base, quality, virtue } = itemParts(item);
  if (!virtue) return 0;
  const tier = TIERS.findIndex((name) => base.startsWith(name)) + 1;
  return VIRTUE_EFFECTS[virtue].unit * tier * (quality === "rare" ? 2 : 1);
}

/** The total of one Virtue over every worn piece, as armour adds up, in that Virtue's unit. */
export const virtueOf = (
  player: Partial<Record<GearSlot, string>>,
  virtue: Virtue,
) =>
  GEAR_SLOTS.reduce((total, slot) => {
    const item = player[slot] ?? "";
    return total + (itemParts(item).virtue === virtue ? virtueSize(item) : 0);
  }, 0);

/** What the Gear tab says `item`'s Virtue does, after its base stat, or undefined for a common piece (spec §5). */
export function virtueDoes(item: string) {
  const { virtue } = itemParts(item);
  return virtue ? VIRTUE_EFFECTS[virtue].does(virtueSize(item)) : undefined;
}

/** The skill and level needed to equip `item`, or undefined if it isn't gear. */
export function gateOf(item: string) {
  const gear = gearOf(item);
  return gear && { ...GATES[gear.slot], level: gear.level };
}

/** Why this gear can't be equipped, or undefined if it can or isn't gear. The bar greys it, and the server tells the player. */
export function gearRefusal(
  item: string,
  player: { combatXp: number; defenseXp: number },
) {
  const gate = gateOf(item);
  if (!gate) return undefined;
  return levelFor(player[gate.xp]) < gate.level
    ? `You need ${gate.skill} ${gate.level} to equip this.`
    : undefined;
}

/** The tenths of Avoidance a gossamer cloak adds to its cape (§217, tunable at build). */
export const GOSSAMER_AVOIDANCE_TENTHS = 2;

/** The tenths of Avoidance `item`'s reagent variant adds, 0 for a plain id (#217). */
export const variantAvoidanceTenths = (item: string) =>
  itemParts(item).variant === "gossamer" ? GOSSAMER_AVOIDANCE_TENTHS : 0;

/** The total of every worn piece's reagent variant's Avoidance, in tenths of a point (#217). */
export const variantAvoidanceOf = (player: Partial<Record<GearSlot, string>>) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + variantAvoidanceTenths(player[slot] ?? ""),
    0,
  );

/** What the Gear tab says `item`'s reagent variant adds, or undefined for a plain one (#217). */
export function variantDoes(item: string) {
  const tenths = variantAvoidanceTenths(item);
  return tenths ? VIRTUE_EFFECTS.avoidance.does(tenths) : undefined;
}

/** The id of `cape`'s gossamer cloak: the cape's full id with the `gossamer` variant on the end, which keeps its Quality and Virtue (#217, ADR 0004). */
export const gossamerItem = (cape: string) => `${cape}:gossamer`;

/** The cape `item`'s gossamer cloak was made from, without the variant, or undefined if it isn't one (ADR 0004). */
export const capeOfGossamer = (item: string) =>
  itemParts(item).variant === "gossamer"
    ? item.split(":").slice(0, -1).join(":")
    : undefined;
