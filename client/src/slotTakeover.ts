import type { amountChoices } from "./movingItems.ts";

/** What an inventory slot's clicks do while something takes them over: the store window sells (village spec §5), the bank deposits (village spec §6), and Coin-turn picks its item (Magic spec §9). */
export type SlotTakeover = {
  click: (slot: number, item: string) => void;
  menu: (slot: number, item: string) => ReturnType<typeof amountChoices>;
};
let takeover: SlotTakeover | undefined;

/** Hands the inventory slots' clicks to a window or a spell, and back with undefined. Returns who had them before. */
export function takeOverSlots(to: SlotTakeover | undefined) {
  const before = takeover;
  takeover = to;
  return before;
}

/** Who has the inventory slots' clicks now, if anyone. */
export const slotTakeover = () => takeover;
