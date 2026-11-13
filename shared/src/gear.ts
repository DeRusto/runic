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

/** Avoidance is held in tenths of a point off an enemy's chance to hit. */
export const AVOIDANCE_TENTHS_PER_POINT = 10;

const DEFENSE = { skill: "Defense", xp: "defenseXp" } as const;
/** The skill that decides who can use what goes in each slot (spec §5): every maker's pieces gate on Defense but a weapon's (#217). */
const GATES = {
  weapon: { skill: "Combat", xp: "combatXp" },
  shield: DEFENSE,
  head: DEFENSE,
  body: DEFENSE,
  legs: DEFENSE,
  hands: DEFENSE,
  feet: DEFENSE,
  cape: DEFENSE,
  neck: DEFENSE,
  ring: DEFENSE,
} as const;

type Gear = {
  slot: keyof typeof GATES;
  /** The level of the slot's gating skill needed to equip it. */
  level: number;
  /** What the Gear tab says it does. */
  does: string;
  hitBonus?: number;
  /** The points of Accuracy the piece gives, which add to its wearer's own chance to hit (#238's rings). */
  accuracy?: number;
  /** The base chance, 0..1, of blocking a hit that would have landed. */
  blockChance?: number;
  /** The percentage taken off a hit that lands. Worn pieces add together. */
  armourPercent?: number;
  /** The tenths of a point of Avoidance the piece itself gives, an amulet's (#217). */
  avoidanceTenths?: number;
};

const sword = (level: number, hitBonus: number): Gear => ({
  slot: "weapon",
  level,
  does: `Adds ${hitBonus} to your minimum and maximum hit`,
  hitBonus,
});

/** A bow mirrors the sword ladder's hit bonuses (#228). They are placeholders: Phase 8 re-gates bows on Ranged and tunes them. */
const bow = sword;

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

/** Leatherworking's hands and feet of a tier: the hands on their own line and the feet on the helmet's (spec §5, #217). */
const leather = (
  slot: "hands" | "feet",
  level: number,
  armourPercent: number,
): Gear => ({
  slot,
  level,
  does: `Takes ${armourPercent}% off each hit you take`,
  armourPercent,
});

/** Jewelsmithing's amulet of a tier: Avoidance in tenths of a point off an enemy's chance to hit (#217). */
const amulet = (level: number, avoidanceTenths: number): Gear => ({
  slot: "neck",
  level,
  does: `Takes ${avoidanceTenths / AVOIDANCE_TENTHS_PER_POINT} points off an enemy's chance to hit you.`,
  avoidanceTenths,
});

/** Jewelsmithing's ring of a tier: Accuracy in points, which add to the wearer's own chance to hit (#238; 1 point is a percentage point, spec §5). */
const ring = (level: number, accuracy: number): Gear => ({
  slot: "ring",
  level,
  does: `Adds ${accuracy} points to your chance to hit`,
  accuracy,
});

/** Added to a shield's chance per Blocking level above 1 (spec §5). */
export const BLOCK_CHANCE_PER_BLOCKING_LEVEL = 0.002;

/** Each wood's tier number, at the metal tier its bow's Combat gate matches (#228). */
const WOOD_TIERS = { birch: 1, oak: 3, charwood: 5 } as const;

/** Spec §5, with Bronze and Steel at the midpoints (rebalance spec §3 Gear), by item id. Anything in here can be equipped. */
export const GEAR = new Map<string, Gear>([
  ["copperSword", sword(1, 100)],
  ["bronzeSword", sword(5, 150)],
  ["ironSword", sword(10, 200)],
  ["steelSword", sword(15, 250)],
  ["emberiteSword", sword(20, 300)],
  // #228's bows, at the Combat levels their woods' Woodcutting gates sit at: 1, 10, 20.
  ["birchBow", bow(1, 100)],
  ["oakBow", bow(10, 200)],
  ["charwoodBow", bow(20, 300)],
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
  // #217's capes, three Virtues to a tier: might, fortitude, avoidance, on the hands' armour line. Leatherworking makes them (#238).
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
  // #238's Leatherworking pieces: the hands on their own 1–5% line and the feet on the helmet's 2–6% one (spec §5, #217).
  ["copperGloves", leather("hands", 1, 1)],
  ["bronzeGloves", leather("hands", 5, 2)],
  ["ironGloves", leather("hands", 10, 3)],
  ["steelGloves", leather("hands", 15, 4)],
  ["emberiteGloves", leather("hands", 20, 5)],
  ["copperBoots", leather("feet", 1, 2)],
  ["bronzeBoots", leather("feet", 5, 3)],
  ["ironBoots", leather("feet", 10, 4)],
  ["steelBoots", leather("feet", 15, 5)],
  ["emberiteBoots", leather("feet", 20, 6)],
  // #238's Jewelsmithing pieces: the amulet's Avoidance in tenths and the ring's Accuracy in points (#238; #217's hitBonus became Accuracy).
  ["copperAmulet", amulet(1, 5)],
  ["bronzeAmulet", amulet(5, 8)],
  ["ironAmulet", amulet(10, 10)],
  ["steelAmulet", amulet(15, 13)],
  ["emberiteAmulet", amulet(20, 16)],
  ["copperRing", ring(1, 5)],
  ["bronzeRing", ring(5, 8)],
  ["ironRing", ring(10, 10)],
  ["steelRing", ring(15, 13)],
  ["emberiteRing", ring(20, 16)],
]);

/** The gear an item id is, improved or not, or undefined if it isn't gear. An improved piece has its common form's stats and gate (spec §2). */
export const gearOf = (item: string) => GEAR.get(itemParts(item).base);

/** The percentage all worn armour takes off a hit. */
export const armourPercentOf = (player: Partial<Record<GearSlot, string>>) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + (gearOf(player[slot] ?? "")?.armourPercent ?? 0),
    0,
  );

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

/**
 * #217's ½-uncommon Virtue ladder for capes, as whole units by tier, lowest first: a common
 * cape carries its Virtue at half the size spec §3's units give an uncommon one (Fortitude
 * 20×tier, Might 3×tier, Avoidance tier tenths), an uncommon one at full, and a rare one at
 * double. Might's half rounds down and Avoidance's up, because a cape never carries less
 * than 1 tenth — which is also all an uncommon Copper cape carries, so common and uncommon
 * meet at 1 there; at every other Virtue and tier common is strictly below uncommon.
 */
const CAPE_COMMON_VIRTUES: Record<
  Virtue,
  [number, number, number, number, number]
> = {
  fortitude: [10, 20, 30, 40, 50],
  might: [1, 3, 4, 6, 7],
  avoidance: [1, 1, 2, 2, 3],
};

/** The size of `item`'s Virtue, 0 for a common piece. Its unit is multiplied by the tier number, read from the base id's prefix, and rare is double uncommon (spec §3). A bow is sized by the wood tier at the metal tier its Combat gate matches (#228), and a cape carries its Virtue at every Quality, on the ½-uncommon ladder above (#217). */
function virtueSize(item: string) {
  const { base, quality, virtue } = itemParts(item);
  if (!virtue) return 0;
  const wood = Object.entries(WOOD_TIERS).find(([name]) =>
    base.startsWith(name),
  );
  const tier = wood
    ? wood[1]
    : TIERS.findIndex((name) => base.startsWith(name)) + 1;
  const uncommon = VIRTUE_EFFECTS[virtue].unit * tier;
  if (GEAR.get(base)?.slot === "cape")
    return quality === "common"
      ? CAPE_COMMON_VIRTUES[virtue][tier - 1]!
      : uncommon * (quality === "rare" ? 2 : 1);
  return uncommon * (quality === "rare" ? 2 : 1);
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

/** The tenths of Avoidance every worn piece gives as its own stat, an amulet's (#217), over all ten slots. */
export const baseAvoidanceTenthsOf = (
  player: Partial<Record<GearSlot, string>>,
) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + (gearOf(player[slot] ?? "")?.avoidanceTenths ?? 0),
    0,
  );

/** The points of Accuracy every worn piece gives, a ring's (#238), over all ten slots. */
export const wornAccuracyOf = (player: Partial<Record<GearSlot, string>>) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + (gearOf(player[slot] ?? "")?.accuracy ?? 0),
    0,
  );

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
