import type { ArraySchema } from "@colyseus/schema";
import {
  DRAIN_TICKS,
  itemParts,
  RESTOCK_TICKS,
  SHELF_SLOTS,
  STARTING_STOCK,
  type ItemId,
} from "@runic/shared";

const startingOf = (item: string) => STARTING_STOCK[item as ItemId] ?? 0;

/**
 * The general store's shelf, kept in the synced parallel arrays it is given (village spec §5). Each item
 * moves one at a time back to its starting stock: the store's own refill, and what players
 * sold drains away and then leaves its slot.
 */
// shortcut: only the server's memory holds the shelf, so a restart resets it to the starting stock and loses what players sold; save it if players miss those items.
export class Shelf {
  /** When each item off its starting stock next moves one toward it, by id. */
  private moves = new Map<string, { tick: number; rising: boolean }>();

  constructor(
    private items: ArraySchema<string>,
    private counts: ArraySchema<number>,
  ) {
    for (const [item, count] of Object.entries(STARTING_STOCK)) {
      items.push(item);
      counts.push(count);
    }
  }

  /** Puts sold items on the shelf. With no slot of theirs and none free, they are gone. */
  stock(item: string, count: number, tick: number) {
    let at = this.items.indexOf(item);
    if (at < 0) {
      if (this.items.length >= SHELF_SLOTS) return;
      at = this.items.push(item) - 1;
      this.counts.push(0);
    }
    this.counts[at]! += count;
    this.timeMove(item, at, tick);
  }

  /** Takes bought items off the shelf; the deal has checked they are there. */
  take(item: string, count: number, tick: number) {
    const at = this.items.indexOf(item);
    this.counts[at]! -= count;
    this.timeMove(item, at, tick);
    this.letGoIfGone(item, at);
  }

  /** A sold item with none left gives its slot back; the store's own keep theirs to refill. */
  private letGoIfGone(item: string, at: number) {
    if (this.counts[at] || startingOf(item)) return;
    this.moves.delete(item);
    this.items.splice(at, 1);
    this.counts.splice(at, 1);
  }

  /** Starts the wait for the next move toward the starting stock, unless one in that direction is already running. */
  private timeMove(item: string, at: number, tick: number) {
    const rising = this.counts[at]! < startingOf(item);
    if (this.counts[at] === startingOf(item)) this.moves.delete(item);
    else if (this.moves.get(item)?.rising !== rising)
      this.moves.set(item, { tick: tick + this.waitOf(item, rising), rising });
  }

  private waitOf(item: string, rising: boolean) {
    return rising ? RESTOCK_TICKS : DRAIN_TICKS[itemParts(item).quality];
  }

  advance(tick: number) {
    for (const [item, move] of this.moves) {
      if (tick < move.tick) continue;
      const at = this.items.indexOf(item);
      this.counts[at]! += move.rising ? 1 : -1;
      move.tick += this.waitOf(item, move.rising);
      if (this.counts[at] !== startingOf(item)) continue;
      this.moves.delete(item);
      this.letGoIfGone(item, at);
    }
  }
}
