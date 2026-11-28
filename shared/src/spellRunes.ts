import { heldCount, type ItemId } from "./items.ts";

/** The runes one cast of a spell spends, with how many of each. */
export type SpellRunes = Partial<Record<ItemId, number>>;

type Bag = { inventory: Iterable<string>; inventoryCounts: Iterable<number> };

/** Each rune of `runes`, with how many. */
export const runeCountsOf = (runes: SpellRunes) =>
  Object.entries(runes) as [ItemId, number][];

/** Runes as the Spellbook tab reads them: "3 fire, 2 air, 1 focus". */
export const runesLineOf = (runes: SpellRunes) =>
  runeCountsOf(runes)
    .map(([rune, count]) => `${count} ${rune.replace(/Rune$/, "")}`)
    .join(", ");

/** Whether the bag holds every rune of `runes`. */
export const holdsRunes = (player: Bag, runes: SpellRunes) => {
  const items = [...player.inventory];
  const counts = [...player.inventoryCounts];
  return runeCountsOf(runes).every(
    ([rune, count]) => heldCount(items, counts, rune) >= count,
  );
};
