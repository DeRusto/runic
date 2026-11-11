import { colouredNames } from "./itemIcons.ts";

/**
 * Shows `text` in the page's slot tooltip beside the cursor while it points at `slot`, with
 * the name of the slot's `data-item` coloured. Not `title`, which can't colour a name (spec §5).
 */
export function addSlotTip(slot: HTMLElement, text: () => string) {
  const tip = document.getElementById("slot-tip")!;
  slot.onpointermove = (event) => {
    const shown = text();
    tip.hidden = !shown;
    tip.replaceChildren(...colouredNames(shown, [slot.dataset.item ?? ""]));
    // Up and to the right, since the slots sit low on the screen.
    tip.style.left = `${event.clientX + 12}px`;
    tip.style.bottom = `${innerHeight - event.clientY + 12}px`;
  };
  slot.onpointerleave = () => {
    tip.hidden = true;
  };
}
