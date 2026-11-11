/** The key a panel hotkey sees: none while typing in chat, held down, or with a modifier. */
export function panelKey(event: KeyboardEvent) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return "";
  if (event.target instanceof HTMLInputElement) return "";
  return event.key;
}

/** The bottom bar's height in index.html; panels stay above it (spec §6). */
const BOTTOM_BAR_PX = 160;
/** How far a first opening sits from the screen's edges. */
const EDGE_PX = 8;
/** How far each first opening is offset from the panel before it, so they cascade (spec §6). */
const CASCADE_PX = 24;

type OpenPanel = { element: HTMLElement; close: () => void };

/** The open panels, back to front. */
const open: OpenPanel[] = [];
/** Where each panel was last left. Kept for this login only: logging out reloads the page. */
const leftAt = new Map<HTMLElement, { left: number; top: number }>();

const restack = () =>
  open.forEach(({ element }, i) => {
    element.style.zIndex = String(i);
    element.classList.toggle("front", i === open.length - 1);
  });

const without = (element: HTMLElement) => {
  const i = open.findIndex((p) => p.element === element);
  return i < 0 ? undefined : open.splice(i, 1)[0];
};

/** Moves a panel as near to `left`, `top` as stays fully on screen and above the bottom bar. */
const moveTo = (element: HTMLElement, left: number, top: number) => {
  const right = innerWidth - element.offsetWidth;
  const bottom = innerHeight - BOTTOM_BAR_PX - element.offsetHeight;
  const at = {
    left: Math.max(0, Math.min(left, right)),
    top: Math.max(0, Math.min(top, bottom)),
  };
  element.style.left = `${at.left}px`;
  element.style.top = `${at.top}px`;
  leftAt.set(element, at);
};

/** Whether a press landed on an open panel, which shouldn't close the others (spec §6). */
export const onOpenPanel = (target: Node) =>
  open.some(({ element }) => element.contains(target));

/** Listens once, for the whole page, for what every panel shares: Escape and the window's size. */
export function watchPanels() {
  document.addEventListener("keydown", (event) => {
    if (panelKey(event) === "Escape") open.at(-1)?.close();
  });
  addEventListener("resize", () => {
    for (const { element } of open) {
      const { left, top } = leftAt.get(element)!;
      moveTo(element, left, top);
    }
  });
}

/**
 * Registers a panel (spec §6): a press on it brings it to the front, and its title bar drags
 * it. `close` is how Escape shuts it, and `side` is where it first opens. Call `opened` once
 * it is shown, so it can be measured, and `closed` once it is hidden.
 */
export function addPanel(
  element: HTMLElement,
  close: () => void,
  side: "left" | "right" = "left",
) {
  element.onpointerdown = () => {
    const pressed = without(element);
    if (!pressed) return;
    open.push(pressed);
    restack();
  };
  const titleBar = element.querySelector("h2")!;
  titleBar.onpointerdown = (event) => {
    if ((event.target as HTMLElement).tagName === "BUTTON") return;
    const { left, top } = leftAt.get(element)!;
    const [grabX, grabY] = [event.clientX - left, event.clientY - top];
    titleBar.setPointerCapture(event.pointerId);
    titleBar.onpointermove = (move) =>
      moveTo(element, move.clientX - grabX, move.clientY - grabY);
    titleBar.onpointerup = () => (titleBar.onpointermove = null);
  };
  return {
    opened: () => {
      without(element);
      const last = leftAt.get(element);
      if (last) moveTo(element, last.left, last.top);
      else {
        const offset = open.length * CASCADE_PX;
        const left =
          side === "right"
            ? innerWidth - element.offsetWidth - EDGE_PX - offset
            : EDGE_PX + offset;
        const top =
          innerHeight - BOTTOM_BAR_PX - element.offsetHeight - EDGE_PX - offset;
        moveTo(element, left, top);
      }
      open.push({ element, close });
      restack();
    },
    closed: () => {
      without(element);
      restack();
    },
  };
}
