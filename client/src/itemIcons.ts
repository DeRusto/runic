/** Where an item's or tool's icon is. The PNGs are rendered by client/render-icons and committed. */
export const iconUrl = (id: string) => `/icons/${id}.png`;

/** The name a player reads for an item id: `copperOre` is "Copper ore". */
export function itemName(id: string) {
  const words = id.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
  return words.charAt(0).toUpperCase() + words.slice(1);
}
