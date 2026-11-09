import { itemName } from "./itemIcons.ts";

/** What the client reads of one synced ground item. */
export type SeenGroundItem = { item: string; count: number; owner: string };

const describe = ({ item, count, owner }: SeenGroundItem, me: string) =>
  `${itemName(item)}${count > 1 ? ` (${count})` : ""}${owner && owner === me ? " · yours for now" : ""}`;

/** The hover label for the ground items a player sees on one tile: the item, or the pile line by line. */
export function groundItemsLabel(items: SeenGroundItem[], me: string) {
  if (items.length === 1) return describe(items[0]!, me);
  return [
    `Pile: ${items.length} items`,
    ...items.map((item) => describe(item, me)),
  ].join("\n");
}
