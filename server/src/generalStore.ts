import {
  addItems,
  COINS,
  dealRefusal,
  dealTotals,
  INVENTORY_SLOTS,
  removeItems,
  SHELF_SLOTS,
  type Deal,
  type DealLine,
} from "@runic/shared";
import { Shelf } from "./shelf.ts";
import type { VillagerWindows } from "./villagerWindows.ts";
import { isAmount, type World } from "./worldContext.ts";

/**
 * A tray's lines copied out of an untrusted payload, or undefined if it isn't a list of at most
 * `max` items, each with a whole count above 0.
 */
function dealLines(list: unknown, max: number) {
  if (!Array.isArray(list) || list.length > max) return undefined;
  const lines = list.map((line) => ({ item: line?.item, count: line?.count }));
  return lines.every(
    (line) => typeof line.item === "string" && isAmount(line.count),
  )
    ? (lines as DealLine[])
    : undefined;
}

/** The general store: its shelf, and deals settled through the storekeeper's window (village spec §5). */
export class GeneralStore {
  private readonly shelf: Shelf;

  constructor(
    private readonly world: World,
    private readonly windows: VillagerWindows,
  ) {
    this.shelf = new Shelf(world.state.shelf, world.state.shelfCounts);
  }

  /**
   * Settles both trays at once, sales first so their coins pay for the buys (village spec §5). It comes
   * straight off the network, so anything of the wrong shape, or from a player without the
   * store open, is ignored. Like a drag it skips the queue and touches no action.
   */
  deal(id: string, intent: Deal) {
    const player = this.world.state.players.get(id);
    if (
      !player ||
      !this.world.canAct(id) ||
      !this.windows.windowOf(id, "store")
    )
      return;
    const buy = dealLines(intent?.buy, SHELF_SLOTS);
    const sell = dealLines(intent?.sell, INVENTORY_SLOTS);
    if (!buy || !sell || (!buy.length && !sell.length)) return;
    const deal = { buy, sell };
    const tell = (line: string) =>
      this.world.events.push({ type: "told", player: id, line });
    const answer = (done: boolean) =>
      this.world.events.push({ type: "dealAnswered", player: id, done });
    const refusal = dealRefusal(deal, player, this.world.state);
    if (refusal) {
      tell(refusal);
      return answer(false);
    }
    const { inventory, inventoryCounts } = player;
    const { tick } = this.world.state;
    for (const { item, count } of sell) {
      removeItems(inventory, inventoryCounts, item, count);
      this.shelf.stock(item, count, tick);
    }
    const { pay, get } = dealTotals(deal);
    addItems(inventory, inventoryCounts, COINS, get);
    removeItems(inventory, inventoryCounts, COINS, pay);
    for (const { item, count } of buy) {
      this.shelf.take(item, count, tick);
      addItems(inventory, inventoryCounts, item, count);
    }
    // What waited on a slot meant what was there before.
    this.world.queuedDrops.delete(id);
    this.world.queuedEats.delete(id);
    tell(`Deal done: you paid ${pay} coins and got ${get}.`);
    answer(true);
  }

  /** Moves the shelf's counts back toward its starting stock. */
  advance(tick: number) {
    this.shelf.advance(tick);
  }
}
