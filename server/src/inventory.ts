import {
  addItems,
  mixRefusal,
  moveStack,
  potionFromPlant,
  POTIONS,
  removeItems,
  takeRefusal,
} from "@runic/shared";
import { isInventorySlot, type World } from "./worldContext.ts";

/** What a player does with the items they carry, beyond eating, wearing and banking: dragging them, mixing potions, and taking items off the ground. */
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

  /**
   * Mixing a potion: `slot` comes straight off the network, so anything but a slot holding a
   * mixable plant is ignored. Like a move it skips the queue and touches no action, as
   * nothing waits on it (#222).
   */
  mix(id: string, slot: number) {
    if (!this.world.canAct(id) || !isInventorySlot(slot)) return;
    const player = this.world.state.players.get(id)!;
    const potion = potionFromPlant(player.inventory[slot]!);
    if (!potion) return;
    const refusal = mixRefusal(potion, player);
    if (refusal) {
      this.world.events.push({ type: "told", player: id, line: refusal });
      return;
    }
    // One vial and one plant become one potion, wherever each was (#222).
    const { inventory, inventoryCounts } = player;
    removeItems(inventory, inventoryCounts, "vial", 1);
    removeItems(inventory, inventoryCounts, POTIONS[potion].plant, 1);
    addItems(inventory, inventoryCounts, potion, 1);
    this.world.earnXp(player, "herblawXp", POTIONS[potion].xp);
  }

  /** Whether this player can see the ground item with this id; the room sends them only those. */
  canSee(id: string, groundItem: string) {
    const player = this.world.state.players.get(id);
    return (
      player !== undefined &&
      this.world.groundItems.canSee(player.username, groundItem)
    );
  }

  /**
   * After the steps, so the take lands on the tick of arrival. Visibility is checked again, and
   * the first player to arrive takes what fits; a second on the same tick gets none, even of a remainder.
   */
  advanceTakes() {
    const takenThisTick = new Set<string>();
    for (const [id, unsynced] of this.world.unsyncedPlayers) {
      const { action } = unsynced;
      if (action?.kind !== "taking" || unsynced.path.length) continue;
      unsynced.action = undefined;
      const player = this.world.state.players.get(id)!;
      const groundItem = this.world.state.groundItems.get(action.groundItem);
      if (!groundItem || !this.canSee(id, action.groundItem)) continue;
      if (takenThisTick.has(action.groundItem)) continue;
      // With no way there, the path ran out short of the tile.
      if (player.x !== groundItem.x || player.y !== groundItem.y) continue;
      const { item } = groundItem;
      const line = takeRefusal(item, player);
      if (line) {
        this.world.events.push({ type: "told", player: id, line });
        continue;
      }
      // In one go, as a pile of coins can run to millions.
      const { inventory, inventoryCounts } = player;
      const taken =
        groundItem.count -
        addItems(inventory, inventoryCounts, item, groundItem.count);
      this.world.groundItems.take(action.groundItem, taken);
      takenThisTick.add(action.groundItem);
    }
  }
}
