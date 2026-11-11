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
    // Up and to the right, since the slots sit low on the screen, but kept inside the window.
    tip.style.left = `${Math.min(event.clientX + 12, innerWidth - tip.offsetWidth)}px`;
    tip.style.bottom = `${innerHeight - event.clientY + 12}px`;
  };
  // A click changes what the slot holds, so the tip would be stale until the pointer moves.
  slot.onpointerleave = slot.onpointerdown = () => {
    tip.hidden = true;
  };
}
