import {
  EMPTY_SLOT,
  GEAR_SLOTS,
  gearCountField,
  gearOf,
  gearRefusal,
  isStackingGearSlot,
  ITEMS,
  itemParts,
  wornCountOf,
  type GearSlot,
} from "@runic/shared";
import {
  isInventorySlot,
  type SyncedPlayer,
  type World,
} from "./worldContext.ts";

/** Puts `count` of `item`, or "" and 0, in a gear slot, with its count for a stacking slot (Ranged spec §2). */
export function wear(
  player: SyncedPlayer,
  gearSlot: GearSlot,
  item: string,
  count: number,
) {
  player[gearSlot] = item;
  if (isStackingGearSlot(gearSlot))
    player[gearCountField(gearSlot)] = item ? count : 0;
}

/** Takes up to `wanted` from an inventory slot's stack, emptying the slot when none are left. Returns how many it took. */
function takeFromSlot(world: World, id: string, slot: number, wanted: number) {
  const player = world.player(id);
  const taken = Math.min(wanted, player.inventoryCounts[slot]!);
  player.inventoryCounts[slot]! -= taken;
  if (!player.inventoryCounts[slot]) player.inventory[slot] = EMPTY_SLOT;
  // A drop waiting on the slot meant the stack as it was, as for any move.
  world.forgetDropOn(id, slot);
  return taken;
}

/**
 * Spends what one ranged attack throws or shoots, hit or miss: a knife from the weapon slot's
 * stack, which never refills (Ranged spec §5), or an arrow (see `spendArrow`). Returns whether
 * any are left to throw or fire.
 */
export function spendShot(world: World, id: string, thrown: boolean) {
  if (!thrown) return spendArrow(world, id);
  const player = world.player(id);
  const count = player.weaponCount - 1;
  wear(player, "weapon", count ? player.weapon : "", count);
  return count > 0;
}

/**
 * Spends one arrow from the ammo slot, hit or miss. When the last one goes, the slot refills
 * with up to a stack of the same arrow from the inventory, taken slot by slot in order (owner,
 * 2026-11-23). Returns whether any arrows are left to fire.
 */
function spendArrow(world: World, id: string) {
  const player = world.player(id);
  const arrow = player.ammo;
  let count = player.ammoCount - 1;
  const refilling = count === 0;
  const stack = ITEMS[itemParts(arrow).base].stack;
  player.inventory.forEach((item, slot) => {
    if (!refilling || count === stack || item !== arrow) return;
    count += takeFromSlot(world, id, slot, stack - count);
  });
  wear(player, "ammo", count ? arrow : "", count);
  return count > 0;
}

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
      this.world.tell(id, refusal);
      return;
    }
    if (player[gear.slot] === item && ITEMS[itemParts(item).base].stack > 1) {
      this.topUp(id, slot, gear.slot);
      return;
    }
    // Whatever was worn lands where this came from, with its count, so swapping always works (spec §4).
    const worn = player[gear.slot];
    const wornCount = wornCountOf(player, gear.slot);
    const count = player.inventoryCounts[slot]!;
    this.placeGear(id, slot, worn, wornCount);
    wear(player, gear.slot, item, count);
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
      this.world.tell(id, "You have no empty slot to take that off into.");
      return;
    }
    // The whole stack comes off together (Ranged spec §2).
    this.placeGear(id, slot, worn, wornCountOf(player, gearSlot));
    wear(player, gearSlot, "", 0);
    this.world.fitHealth(id);
  }

  /**
   * More of the stack already worn fills the slot up to the item's stack size, and the rest
   * stays where it was. This build's choice for a partial slot (Ranged spec §2).
   */
  private topUp(id: string, slot: number, gearSlot: GearSlot) {
    if (!isStackingGearSlot(gearSlot)) return;
    const player = this.world.player(id);
    const item = player[gearSlot];
    const field = gearCountField(gearSlot);
    const moved = Math.min(
      ITEMS[itemParts(item).base].stack - player[field],
      player.inventoryCounts[slot]!,
    );
    if (moved <= 0) {
      this.world.tell(id, `Your ${gearSlot} slot is full.`);
      return;
    }
    player[field] += takeFromSlot(this.world, id, slot, moved);
  }

  /** Puts `count` of gear, or "", in a slot. A drop waiting on the slot meant what was there, not this. */
  private placeGear(id: string, slot: number, item: string, count: number) {
    const player = this.world.state.players.get(id)!;
    player.inventory[slot] = item;
    player.inventoryCounts[slot] = item ? count : 0;
    this.world.forgetDropOn(id, slot);
  }
}
