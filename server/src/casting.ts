import {
  isCombatSpell,
  pickedSpellOf,
  removeItems,
  runesOf,
  spellPickRefusal,
} from "@runic/shared";
import type { World } from "./worldContext.ts";

/**
 * Picks the combat spell a staff casts. `spell` comes straight off the network, so anything but
 * a combat spell is ignored, as is one above the player's Magic level, whose refusal the client
 * has already shown (Magic spec §5). Like a stance, it skips the queue: the next cast reads it.
 */
export function pickSpell(world: World, id: string, spell: unknown) {
  if (world.isCrossing(id)) return;
  const player = world.state.players.get(id);
  if (!player || !isCombatSpell(spell)) return;
  if (spellPickRefusal(player, spell)) return;
  player.combatSpell = spell;
}

/** Spends one cast's runes of the picked spell from the inventory, hit or miss, and none come back (Magic spec §5). */
export function spendRunes(world: World, id: string) {
  const player = world.player(id);
  const spell = pickedSpellOf(player);
  if (!spell) return;
  for (const [rune, count] of runesOf(spell))
    removeItems(player.inventory, player.inventoryCounts, rune, count);
}
