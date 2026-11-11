import { COMBAT_LOCK_SECONDS, EMPTY_SLOT } from "./index.ts";
import { ITEMS, itemParts } from "./items.ts";

/** How many slots each player's bank has (#197). */
export const BANK_SLOTS = 96;

/**
 * The bank slot a deposit of `item` goes in. Whatever stacks in the inventory (materials, food,
 * coins) keeps one uncapped slot in the bank, and gear takes a slot per piece (#197). -1 means full.
 */
export function bankSlotFor(item: string, bank: Iterable<string>) {
  const slots = [...bank];
  const own = ITEMS[itemParts(item).base].stack > 1 ? slots.indexOf(item) : -1;
  return own >= 0 ? own : slots.indexOf(EMPTY_SLOT);
}

/** Why a deposit of `item` is refused, or undefined if it goes in. It stays in the inventory. */
export const depositRefusal = (item: string, bank: Iterable<string>) =>
  bankSlotFor(item, bank) < 0 ? "Your bank is full." : undefined;

/** Deposits and withdrawals wait out the combat lock, which only the server knows. */
export const bankRefusal = (locked: boolean) =>
  locked
    ? `You can't use the bank until ${COMBAT_LOCK_SECONDS} seconds after a fight.`
    : undefined;
