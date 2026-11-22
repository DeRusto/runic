import { moveStack } from "@runic/shared";
import { isInventorySlot, type World } from "./worldContext.ts";

/** Dragging items between inventory slots. */
export class Inventory {
  constructor(private readonly world: World) {}

  /** A drag; both come straight off the network. Like equip it skips the queue and touches no action (village spec §4). */
  moveItem(id: string, from: number, to: number) {
    if (!this.world.canAct(id)) return;
    if (!isInventorySlot(from) || !isInventorySlot(to)) return;
    const player = this.world.state.players.get(id)!;
    moveStack(player.inventory, player.inventoryCounts, from, to);
    // What waited on a slot meant what was there before.
    const drop = this.world.queuedDrops.get(id)?.slot;
    if (drop === from || drop === to) this.world.queuedDrops.delete(id);
    const eat = this.world.queuedEats.get(id);
    if (eat === from || eat === to) this.world.queuedEats.delete(id);
  }
}
