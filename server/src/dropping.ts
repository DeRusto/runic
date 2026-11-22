import { EMPTY_SLOT } from "@runic/shared";
import type { World } from "./worldContext.ts";

/** Drops `amount` of a slot, or all of it, onto the player's tile. A part drop is one ground item, and the rest stays in the slot. */
export function dropFromSlot(
  world: World,
  id: string,
  slot: number,
  amount = Infinity,
) {
  const player = world.player(id);
  const item = player.inventory[slot]!;
  if (!item) return;
  const count = Math.min(amount, player.inventoryCounts[slot]!);
  const { username } = player;
  world.groundItems.spawn(player, item, count, username, world.state.tick);
  player.inventoryCounts[slot]! -= count;
  if (!player.inventoryCounts[slot]) player.inventory[slot] = EMPTY_SLOT;
}
