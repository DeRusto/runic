import type { ItemId } from "./items.ts";

/** The essence every vein's extra find rolls as, before the player knows what it is (#232). */
export const STRANGE_MATERIAL = "strangeMaterial";
/** The essence unmasked, which the altar's runes are made from (#232). */
export const RUNE_ESSENCE = "runeEssence";
/** The chance, tunable, that any successful mine also gives essence (#232). */
export const ESSENCE_FIND_CHANCE = 0.2;

/** The four elemental runes, gates lowest first; higher runes come with Phase 9's spells (#232). */
export const RUNES = ["airRune", "waterRune", "earthRune", "fireRune"] as const;
export type RuneId = (typeof RUNES)[number];

/** What a vein's find is for a player who identifies essence: the strange material is the essence unmasked (#232). */
export const findItemOf = (found: ItemId, identifies: boolean): ItemId =>
  found === STRANGE_MATERIAL && identifies ? RUNE_ESSENCE : found;

/** The two stores identification turns, which index like arrays and count their slots. */
export type WithStores = {
  inventory: { length: number; [slot: number]: string };
  bank: { length: number; [slot: number]: string };
};

/** Turns every strange material a player holds — inventory and bank alike — into rune essence, in the same slots, so what they saved counts (#232). */
export function identifyEssence(player: WithStores) {
  for (const held of [player.inventory, player.bank])
    for (let slot = 0; slot < held.length; slot++)
      if (held[slot] === STRANGE_MATERIAL) held[slot] = RUNE_ESSENCE;
}
