import {
  addItems,
  bankRefusal,
  bankSlotFor,
  depositRefusal,
  EMPTY_SLOT,
  INVENTORY_SLOTS,
  moveStack,
  takeRefusal,
} from "@runic/shared";
import type { VillagerWindows } from "./villagerWindows.ts";
import {
  isAmount,
  isBankSlot,
  isInventorySlot,
  type SyncedPlayer,
  type World,
} from "./worldContext.ts";

/** Each player's bank, reached through the banker's window (village spec §6). */
export class Bank {
  constructor(
    private readonly world: World,
    private readonly windows: VillagerWindows,
  ) {}

  /** The player, if their bank is open and no combat lock refuses it; the refusal is told. */
  private playerAtBank(id: string) {
    if (!this.windows.windowOf(id, "bank") || !this.world.canAct(id))
      return undefined;
    const refusal = bankRefusal(this.world.lockRunning(id));
    if (refusal)
      this.world.events.push({ type: "told", player: id, line: refusal });
    return refusal ? undefined : this.world.state.players.get(id)!;
  }

  /**
   * Both come straight off the network, so anything but an inventory slot's index and a whole
   * number above 0 is ignored. Like equip it skips the queue and touches no action.
   */
  deposit(id: string, slot: number, amount: number) {
    if (!isInventorySlot(slot) || !isAmount(amount)) return;
    const player = this.playerAtBank(id);
    const line = player && this.depositSlot(id, player, slot, amount);
    if (line) this.world.events.push({ type: "told", player: id, line });
  }

  /** Whatever fits goes in, and one line says when anything didn't (village spec §6). */
  depositInventory(id: string) {
    const player = this.playerAtBank(id);
    if (!player) return;
    const refusals = Array.from({ length: INVENTORY_SLOTS }, (_, slot) =>
      this.depositSlot(id, player, slot, Infinity),
    );
    const line = refusals.find(Boolean);
    if (line) this.world.events.push({ type: "told", player: id, line });
  }

  /** Returns why the slot's item stays where it is, if it does. */
  private depositSlot(
    id: string,
    player: SyncedPlayer,
    slot: number,
    amount: number,
  ) {
    const item = player.inventory[slot]!;
    if (item === EMPTY_SLOT) return undefined;
    const refusal = depositRefusal(item, player.bank);
    if (refusal) return refusal;
    const to = bankSlotFor(item, player.bank);
    const count = Math.min(amount, player.inventoryCounts[slot]!);
    player.bank[to] = item;
    player.bankCounts[to]! += count;
    player.inventoryCounts[slot]! -= count;
    if (!player.inventoryCounts[slot]) player.inventory[slot] = EMPTY_SLOT;
    this.world.forgetDropOn(id, slot);
    return undefined;
  }

  /**
   * Both come straight off the network, as for deposit. Takes as many as fit, topping up the
   * inventory's stacks before filling free slots, and the rest stays in the bank (village spec §6).
   */
  withdraw(id: string, slot: number, amount: number) {
    if (!isBankSlot(slot) || !isAmount(amount)) return;
    const player = this.playerAtBank(id);
    const item = player?.bank[slot];
    if (!player || !item) return;
    const refusal = takeRefusal(item, player);
    if (refusal) {
      this.world.events.push({ type: "told", player: id, line: refusal });
      return;
    }
    const { inventory, inventoryCounts } = player;
    const count = Math.min(amount, player.bankCounts[slot]!);
    player.bankCounts[slot]! -=
      count - addItems(inventory, inventoryCounts, item, count);
    if (!player.bankCounts[slot]) player.bank[slot] = EMPTY_SLOT;
  }

  /** A drag in the bank, under the inventory's rules; both come straight off the network. */
  moveBankItem(id: string, from: number, to: number) {
    if (!this.world.canAct(id) || !isBankSlot(from) || !isBankSlot(to)) return;
    const player =
      this.windows.windowOf(id, "bank") && this.world.state.players.get(id);
    if (player) moveStack(player.bank, player.bankCounts, from, to);
  }
}
