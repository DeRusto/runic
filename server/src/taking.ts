import { addItems, takeRefusal } from "@runic/shared";
import type { QueuedAction } from "./playerActions.ts";
import type { World } from "./worldContext.ts";

/** Taking ground items into the inventory: walking onto one a player can see, and picking up what fits. */
export class Taking {
  constructor(private readonly world: World) {}

  /** The take a click asks for. `groundItem` comes straight off the network, so anything but the id of one this player can see is ignored. */
  takeIntent(id: string, groundItem: unknown): QueuedAction | undefined {
    if (typeof groundItem !== "string" || !this.canSee(id, groundItem))
      return undefined;
    return { kind: "taking", groundItem };
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
  advance() {
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
