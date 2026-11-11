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
]);

/** The percentage all worn armour takes off a hit. */
export const armourPercentOf = (player: Partial<Record<GearSlot, string>>) =>
  GEAR_SLOTS.reduce(
    (total, slot) => total + (GEAR.get(player[slot] ?? "")?.armourPercent ?? 0),
    0,
  );

/** Why this gear can't be equipped, or undefined if it can or isn't gear. The bar greys it, and the server tells the player. */
export function gearRefusal(
  item: string,
  player: { combatXp: number; defenseXp: number },
) {
  const gear = GEAR.get(item);
  if (!gear) return undefined;
  const { skill, xp } = GATES[gear.slot];
  return levelFor(player[xp]) < gear.level
    ? `You need ${skill} ${gear.level} to equip this.`
    : undefined;
}
