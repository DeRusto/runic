import { colouredNames } from "./itemIcons.ts";

/** What a tooltip shows: a plain line, or parts already built, such as coloured names. */
export type TipContent = string | (string | HTMLElement)[];

type Point = { x: number; y: number };
type Size = { width: number; height: number };

/** Spec §5. */
const CURSOR_GAP_PX = 12;

/**
 * Where the tooltip's top left corner goes: up and to the right of the cursor, flipped to its
 * left at the window's right edge and below it at the top edge (spec §5).
 */
export function tipPosition(cursor: Point, tip: Size, window: Size) {
  const right = cursor.x + CURSOR_GAP_PX;
  const above = cursor.y - CURSOR_GAP_PX - tip.height;
  return {
    left:
      right + tip.width > window.width
        ? cursor.x - CURSOR_GAP_PX - tip.width
        : right,
    top: above < 0 ? cursor.y + CURSOR_GAP_PX : above,
  };
}

const tooltip = () => document.getElementById("tooltip")!;

/** Shows `content` in the one tooltip beside the cursor, or hides it when there is nothing to show. */
export function showTip(
  content: (string | HTMLElement)[],
  cursor: { clientX: number; clientY: number },
) {
  const tip = tooltip();
  tip.hidden = content.every((part) => part === "");
  if (tip.hidden) return;
  tip.replaceChildren(...content);
  // Measured from the left edge, so a tip last shown near the right edge isn't squeezed.
  tip.style.left = "0px";
  const { left, top } = tipPosition(
    { x: cursor.clientX, y: cursor.clientY },
    { width: tip.offsetWidth, height: tip.offsetHeight },
    { width: innerWidth, height: innerHeight },
  );
  tip.style.left = `${Math.max(0, left)}px`;
  tip.style.top = `${top}px`;
}

export function hideTip() {
  tooltip().hidden = true;
}

/**
 * Shows the tooltip while the pointer is on `element`. A plain line colours the name of the
 * element's `data-item`. Not `title`, which can't colour a name or follow the cursor (spec §5).
 */
export function addTip(element: HTMLElement, content: () => TipContent) {
  element.onpointermove = (event) => {
    const shown = content();
    showTip(
      typeof shown === "string"
        ? colouredNames(shown, [element.dataset.item ?? ""])
        : shown,
      event,
    );
  };
  // A click can change what the element describes, so the tip would be stale until the pointer moves.
  element.onpointerleave = element.onpointerdown = hideTip;
}
