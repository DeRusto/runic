import { itemParts } from "./items.ts";
import { levelFor } from "./skills.ts";
import { arrow, bow, staff, sword, throwingKnife } from "./weapons.ts";

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
  "ammo",
] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

/** The gear slots that hold a stack with a count, synced and saved as `<slot>Count`: arrows in the ammo slot, and the weapon slot for throwing knives (Ranged spec §2). Every other slot holds one item. */
export const STACKING_GEAR_SLOTS = ["weapon", "ammo"] as const;
export type StackingGearSlot = (typeof STACKING_GEAR_SLOTS)[number];

/** The synced and saved field holding how many a stacking slot holds, 0 when it is empty. */
export const gearCountField = (slot: StackingGearSlot) =>
  `${slot}Count` as const;

export const isStackingGearSlot = (slot: GearSlot): slot is StackingGearSlot =>
  (STACKING_GEAR_SLOTS as readonly string[]).includes(slot);

/** Where a player keeps worn gear and the counts of its stacking slots. */
export type WornGear = Partial<
  Record<GearSlot, string> & Record<ReturnType<typeof gearCountField>, number>
>;

/** How many `slot` holds: its count for a stacking slot, and 1 or 0 for any other. */
export const wornCountOf = (player: WornGear, slot: GearSlot) =>
  !player[slot]
    ? 0
    : isStackingGearSlot(slot)
      ? player[gearCountField(slot)] || 1
      : 1;

/** Avoidance is held in tenths of a point off an enemy's chance to hit. */
export const AVOIDANCE_TENTHS_PER_POINT = 10;

/** The skills gear gates on, with their synced experience fields. */
const GATE_SKILLS = {
  Attack: "attackXp",
  Defense: "defenseXp",
  Ranged: "rangedXp",
  Magic: "magicXp",
} as const;
export type GateSkill = keyof typeof GATE_SKILLS;

/** One piece of gear's row in `GEAR`. */
export type Gear = {
  slot: GearSlot;
  /** The skill that decides who can equip it: Attack for a sword, Ranged for a bow or arrows, Magic for a staff, and Defense for every maker's other pieces (spec §5, #217, Ranged spec §2, Magic spec §2). */
  gate: GateSkill;
  /** The level of `gate` needed to equip it. */
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
  /** A ranged weapon's reach, in 8-way tiles; a weapon without one fights in melee (Ranged spec §4). */
  reachTiles?: number;
  /** A ranged weapon's ticks between shots (Ranged spec §4). */
  intervalTicks?: number;
  /** A ranged weapon that is its own ammo, a throwing knife: each throw spends one from the weapon slot's stack (#279). */
  thrown?: boolean;
};

const shield = (level: number, blockPercent: number): Gear => ({
  slot: "shield",
  gate: "Defense",
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
  gate: "Defense",
  level,
  does: `Takes ${armourPercent}% off each hit you take`,
  armourPercent,
});

/** A cape is small armour on the hands' line (#217), and the slot reagent augmentation works on. */
const cape = (level: number, armourPercent: number): Gear => ({
  slot: "cape",
  gate: "Defense",
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
  gate: "Defense",
  level,
  does: `Takes ${armourPercent}% off each hit you take`,
  armourPercent,
});

/** Jewelsmithing's amulet of a tier: Avoidance in tenths of a point off an enemy's chance to hit (#217). */
const amulet = (level: number, avoidanceTenths: number): Gear => ({
  slot: "neck",
  gate: "Defense",
  level,
  does: `Takes ${avoidanceTenths / AVOIDANCE_TENTHS_PER_POINT} points off an enemy's chance to hit you.`,
  avoidanceTenths,
});

/** Jewelsmithing's ring of a tier: Accuracy in points, which add to the wearer's own chance to hit (#238; 1 point is a percentage point, spec §5). */
const ring = (level: number, accuracy: number): Gear => ({
  slot: "ring",
  gate: "Defense",
  level,
  does: `Adds ${accuracy} points to your chance to hit`,
  accuracy,
});

/** A starter piece: worn by anyone, and does nothing but cover the wearer. */
const clothes = (slot: "body" | "legs" | "feet"): Gear => ({
  slot,
  gate: "Defense",
  level: 1,
  does: "No bonuses",
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
  // #228's bows, at the Ranged levels their woods' Woodcutting gates sit at: 1, 10, 20 (#268).
  ["birchBow", bow(1, 5)],
  ["oakBow", bow(10, 10)],
  ["charwoodBow", bow(20, 15)],
  // Magic spec §2's staves, on the bows' gates and Accuracy.
  ["birchStaff", staff(1, 5)],
  ["oakStaff", staff(10, 10)],
  ["charwoodStaff", staff(20, 15)],
  // #228's arrows, on the sword ladder's gates and hit bonuses (#268, #269).
  ["copperArrow", arrow(1, 100)],
  ["bronzeArrow", arrow(5, 150)],
  ["ironArrow", arrow(10, 200)],
  ["steelArrow", arrow(15, 250)],
  ["emberiteArrow", arrow(20, 300)],
  // #228's throwing knives, on the arrows' gates and hit bonuses (#269).
  ["copperThrowingKnife", throwingKnife(1, 100)],
  ["bronzeThrowingKnife", throwingKnife(5, 150)],
  ["ironThrowingKnife", throwingKnife(10, 200)],
  ["steelThrowingKnife", throwingKnife(15, 250)],
  ["emberiteThrowingKnife", throwingKnife(20, 300)],
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
  // Every new character's clothes (playerSave's newSave).
  ["leafTunic", clothes("body")],
  ["brownPants", clothes("legs")],
  ["burlapBoots", clothes("feet")],
]);

/** The gear an item id is, improved or not, or undefined if it isn't gear. An improved piece has its common form's stats and gate (spec §2). */
export const gearOf = (item: string) => GEAR.get(itemParts(item).base);

/** Whether making `item` can roll an improved version: any gear but what a shot spends, arrows and throwing knives, which no decision made improvable (Ranged spec §2, §5). */
export const canBeImproved = (item: string) => {
  const gear = GEAR.get(item);
  return !!gear && gear.slot !== "ammo" && !gear.thrown;
};

/** The percentage all worn armour takes off a hit. */
export const armourPercentOf = (player: Partial<Record<GearSlot, string>>) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + (gearOf(player[slot] ?? "")?.armourPercent ?? 0),
    0,
  );

/** The skill and level needed to equip `item`, or undefined if it isn't gear. */
export function gateOf(item: string) {
  const gear = gearOf(item);
  return (
    gear && { skill: gear.gate, xp: GATE_SKILLS[gear.gate], level: gear.level }
  );
}

/** Why this gear can't be equipped, or undefined if it can or isn't gear. The bar greys it, and the server tells the player. */
export function gearRefusal(
  item: string,
  player: Record<(typeof GATE_SKILLS)[GateSkill], number>,
) {
  const gate = gateOf(item);
  if (!gate) return undefined;
  return levelFor(player[gate.xp]) < gate.level
    ? `You need ${gate.skill} ${gate.level} to equip this.`
    : undefined;
}

/** The tenths of Avoidance every worn piece gives as its own stat, an amulet's (#217), over every slot. */
export const baseAvoidanceTenthsOf = (
  player: Partial<Record<GearSlot, string>>,
) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + (gearOf(player[slot] ?? "")?.avoidanceTenths ?? 0),
    0,
  );

/** The points of Accuracy every worn piece gives, a ring's (#238), over every slot. */
export const wornAccuracyOf = (player: Partial<Record<GearSlot, string>>) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + (gearOf(player[slot] ?? "")?.accuracy ?? 0),
    0,
  );
