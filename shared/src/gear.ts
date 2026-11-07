import { levelFor } from "./skills.ts";

/** The names of a player's synced gear fields, which are also their save columns. */
export const GEAR_SLOTS = ["weapon", "shield"] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

/** The skill that decides who can use what goes in each slot (spec §5). */
const GATES = {
  weapon: { skill: "Combat", xp: "combatXp" },
  shield: { skill: "Defense", xp: "defenseXp" },
} as const;

type Gear = {
  slot: GearSlot;
  /** The level of the slot's gating skill needed to equip it. */
  level: number;
  /** What the Gear tab says it does. */
  does: string;
  hitBonus?: number;
  /** The base chance, 0..1, of blocking a hit that would have landed. */
  blockChance?: number;
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

/** Added to a shield's chance per Blocking level above 1 (spec §5). */
export const BLOCK_CHANCE_PER_BLOCKING_LEVEL = 0.002;

/** Spec §5, by item id. Anything in here can be equipped. */
export const GEAR = new Map<string, Gear>([
  ["copperSword", sword(1, 1)],
  ["ironSword", sword(10, 2)],
  ["emberiteSword", sword(20, 3)],
  ["copperShield", shield(1, 10)],
  ["ironShield", shield(10, 20)],
  ["emberiteShield", shield(20, 30)],
]);

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
