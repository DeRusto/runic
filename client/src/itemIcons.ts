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

/**
 * `text` with each improved item's name in a span classed by its Quality, which the page
 * colours (spec §5). Names are found in the order `ids` gives; common ones stay plain text.
 */
export function colouredNames(text: string, ids: string[]) {
  const parts: (string | HTMLElement)[] = [];
  let from = 0;
  for (const id of ids) {
    const { quality } = itemParts(id);
    if (quality === "common") continue;
    const name = itemName(id);
    const at = text.indexOf(name, from);
    if (at < 0) continue;
    const span = document.createElement("span");
    span.className = quality;
    span.textContent = name;
    parts.push(text.slice(from, at), span);
    from = at + name.length;
  }
  parts.push(text.slice(from));
  return parts;
}
