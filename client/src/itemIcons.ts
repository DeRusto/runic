import { itemName, itemParts, itemTag } from "@runic/shared";

/** Where an item's or tool's icon is. The PNGs are rendered by client/render-icons and committed. An improved item shows its common form's. */
export const iconUrl = (id: string) => `/icons/${itemParts(id).base}.png`;

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

/**
 * A chat line's parts, with each item it names as its bracketed tag in a bold span, brackets and
 * all, classed by the item's Quality, which the page colours. Tags are found in the order `ids`
 * gives; anything else, a player's own brackets included, stays plain text.
 */
export function chatItems(text: string, ids: string[]) {
  const parts: (string | HTMLElement)[] = [];
  let from = 0;
  for (const id of ids) {
    const tag = itemTag(id);
    const at = text.indexOf(tag, from);
    if (at < 0) continue;
    const { quality } = itemParts(id);
    const span = document.createElement("span");
    span.className = quality === "common" ? "item-tag" : `item-tag ${quality}`;
    span.textContent = tag;
    parts.push(text.slice(from, at), span);
    from = at + tag.length;
  }
  parts.push(text.slice(from));
  return parts;
}
