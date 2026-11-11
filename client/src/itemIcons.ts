import { itemParts } from "@runic/shared";

/** Where an item's or tool's icon is. The PNGs are rendered by client/render-icons and committed. An improved item shows its common form's. */
export const iconUrl = (id: string) => `/icons/${itemParts(id).base}.png`;

const capitalised = (words: string) =>
  words.charAt(0).toUpperCase() + words.slice(1);

/** The name a player reads for an item id: `copperOre` is "Copper ore", and `copperChestplate:uncommon:fortitude` is "Copper chestplate of Fortitude" (spec §5). */
export function itemName(id: string) {
  const { base, virtue } = itemParts(id);
  const name = capitalised(
    base.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`),
  );
  return virtue ? `${name} of ${capitalised(virtue)}` : name;
}
