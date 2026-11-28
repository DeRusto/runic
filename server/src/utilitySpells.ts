import {
  coinTurnRefusal,
  isUtilitySpell,
  landingOf,
  removeItems,
  turnToCoins,
  UTILITY_SPELLS,
  utilityRunesOf,
  utilitySpellRefusal,
} from "@runic/shared";
import type { QueuedAction } from "./playerActions.ts";
import { isInventorySlot, type World } from "./worldContext.ts";

type Casting = Extract<QueuedAction, { kind: "casting" }>;

/**
 * The cast a click asks for. The payload comes straight off the network, so anything but a utility
 * spell is ignored, as is Coin-turn on anything but an inventory slot's index (Magic spec §9).
 */
export function castIntent(intent: unknown): Casting | undefined {
  if (typeof intent !== "object" || intent === null) return undefined;
  const { spell, slot } = intent as { spell?: unknown; slot?: unknown };
  if (!isUtilitySpell(spell)) return undefined;
  if (spell !== "coinTurn") return { kind: "casting", spell, slot: 0 };
  if (typeof slot !== "number" || !isInventorySlot(slot)) return undefined;
  return { kind: "casting", spell, slot };
}

/**
 * Casts a utility spell with any weapon in hand. A refusal says why and changes nothing; a cast
 * replaces the current action, spends its runes and pays its Magic experience. A teleport moves
 * the caster to its landing tile, and Coin-turn turns one item from the slot into coins (Magic spec §9).
 */
export function castUtility(
  world: World,
  id: string,
  { spell, slot }: Casting,
) {
  const player = world.player(id);
  const refusal =
    spell === "coinTurn"
      ? coinTurnRefusal(player, slot)
      : utilitySpellRefusal(player, spell, world.lockRunning(id));
  if (refusal) return world.tell(id, refusal);
  world.clearAction(id);
  if (spell === "coinTurn") {
    turnToCoins(player.inventory, player.inventoryCounts, slot);
  } else {
    for (const [rune, count] of utilityRunesOf(spell))
      removeItems(player.inventory, player.inventoryCounts, rune, count);
    Object.assign(player, landingOf(spell, world.tiles));
    world.events.push({ type: "teleported", player: id });
  }
  world.earnXp(player, "magicXp", UTILITY_SPELLS[spell].xp);
}
