import {
  addItems,
  mixRefusal,
  potionFromPlant,
  POTIONS,
  removeItems,
} from "@runic/shared";
import { isInventorySlot, type World } from "./worldContext.ts";

/**
 * Mixing a potion: `slot` comes straight off the network, so anything but a slot holding a
 * mixable plant is ignored. Like a move it skips the queue and touches no action, as
 * nothing waits on it (#222).
 */
export function mixPotion(world: World, id: string, slot: number) {
  if (!world.canAct(id) || !isInventorySlot(slot)) return;
  const player = world.state.players.get(id)!;
  const potion = potionFromPlant(player.inventory[slot]!);
  if (!potion) return;
  const refusal = mixRefusal(potion, player);
  if (refusal) {
    world.events.push({ type: "told", player: id, line: refusal });
    return;
  }
  // One vial and one plant become one potion, wherever each was (#222).
  const { inventory, inventoryCounts } = player;
  removeItems(inventory, inventoryCounts, "vial", 1);
  removeItems(inventory, inventoryCounts, POTIONS[potion].plant, 1);
  addItems(inventory, inventoryCounts, potion, 1);
  world.earnXp(player, "herblawXp", POTIONS[potion].xp);
}
