import {
  EMPTY_SLOT,
  GEAR_SLOTS,
  gearOf,
  gearRefusal,
  type GearSlot,
} from "@runic/shared";
import { isInventorySlot, type World } from "./worldContext.ts";

/** Putting gear on and taking it off, which can change max health (spec §2, §4). */
export class Gear {
  constructor(private readonly world: World) {}

  /**
   * `slot` comes straight off the network, so anything but a slot holding gear is ignored.
   * Like pins it skips the queue, so a second click within the tick isn't lost, and it
   * touches no action or timer (spec §4).
   */
  equip(id: string, slot: number) {
    if (!this.world.canAct(id)) return;
    if (!isInventorySlot(slot)) return;
    const player = this.world.state.players.get(id)!;
    const item = player.inventory[slot]!;
    const gear = gearOf(item);
    if (!gear) return;
    const refusal = gearRefusal(item, player);
    if (refusal) {
      this.world.events.push({ type: "told", player: id, line: refusal });
      return;
    }
    // Whatever was worn lands where this came from, so swapping always works (spec §4).
    this.placeGear(id, slot, player[gear.slot]);
    player[gear.slot] = item;
    this.world.fitHealth(id);
  }

  /** `gearSlot` comes straight off the network, so anything but a gear slot is ignored. */
  takeOff(id: string, gearSlot: GearSlot) {
    if (!this.world.canAct(id) || !GEAR_SLOTS.includes(gearSlot)) return;
    const player = this.world.state.players.get(id)!;
    const worn = player[gearSlot];
    if (!worn) return;
    const slot = player.inventory.indexOf(EMPTY_SLOT);
    if (slot < 0) {
      const line = "You have no empty slot to take that off into.";
      this.world.events.push({ type: "told", player: id, line });
      return;
    }
    this.placeGear(id, slot, worn);
    player[gearSlot] = "";
    this.world.fitHealth(id);
  }

  /** Puts gear, or "", in a slot. A drop waiting on the slot meant what was there, not this. */
  private placeGear(id: string, slot: number, item: string) {
    const player = this.world.state.players.get(id)!;
    player.inventory[slot] = item;
    player.inventoryCounts[slot] = item ? 1 : 0;
    this.world.forgetDropOn(id, slot);
  }
}
