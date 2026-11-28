import { dropFromSlot } from "./dropping.ts";
import type { Eating } from "./eating.ts";
import { isAmount, isInventorySlot, type World } from "./worldContext.ts";

/** `slot` comes straight off the network, so anything but a slot's index is ignored. */
export function queueEat(world: World, id: string, slot: number) {
  if (!world.canAct(id)) return;
  if (!isInventorySlot(slot)) return;
  world.queuedEats.set(id, slot);
}

/** Both come straight off the network, so anything but a slot's index and a whole number above 0 is ignored. */
export function queueDrop(
  world: World,
  id: string,
  slot: number,
  amount: number,
) {
  if (!world.canAct(id)) return;
  if (!isInventorySlot(slot)) return;
  if (!isAmount(amount)) return;
  world.queuedDrops.set(id, { slot, amount });
}

/** This tick's queued eats, then its queued drops, each from the slot it named. */
export function applySlotIntents(world: World, eating: Eating) {
  for (const [id, slot] of world.queuedEats) eating.eat(id, slot);
  world.queuedEats.clear();
  for (const [id, { slot, amount }] of world.queuedDrops)
    dropFromSlot(world, id, slot, amount);
  world.queuedDrops.clear();
}
