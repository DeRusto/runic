/**
 * The amount menu's choices for `verb` on a stack of `count` (#193): 1, 5, 10, X or All, where X
 * asks for a number. A lone item offers plain `verb`. The server caps an amount at what is there.
 */
export function amountChoices(
  verb: string,
  count: number,
  act: (amount: number) => void,
): (readonly [label: string, choose: () => void])[] {
  if (count <= 1) return [[verb, () => act(1)]];
  const askX = () => {
    const amount = Number(prompt(`${verb} how many?`));
    if (Number.isInteger(amount) && amount > 0) act(amount);
  };
  return [
    [`${verb} 1`, () => act(1)],
    [`${verb} 5`, () => act(5)],
    [`${verb} 10`, () => act(10)],
    [`${verb} X`, askX],
    [`${verb} All`, () => act(count)],
  ];
}

/**
 * Lets each of `slots` be dragged onto another, calling `move(from, to)` with their indexes; the
 * server decides what the drag does. Set each slot's `draggable` to whether it holds anything.
 * By keyboard, M on a slot picks it up, M on another moves it there, and Escape lets go.
 */
export function dragToReorder(
  slots: HTMLElement[],
  move: (from: number, to: number) => void,
) {
  let from = -1;
  let picked = -1;
  const letGo = () => {
    if (picked >= 0) delete slots[picked]!.dataset.moving;
    picked = -1;
  };
  slots.forEach((slot, to) => {
    slot.ariaKeyShortcuts = "M";
    slot.onkeydown = (event) => {
      if (event.key === "Escape" && picked >= 0) {
        // Or the same Escape would close the window too.
        event.stopPropagation();
        return letGo();
      }
      if (event.key.toLowerCase() !== "m") return;
      event.preventDefault();
      if (picked >= 0) {
        if (picked !== to) move(picked, to);
        return letGo();
      }
      if (!slot.draggable) return;
      picked = to;
      slot.dataset.moving = "true";
    };
    slot.ondragstart = () => (from = to);
    slot.ondragend = () => (from = -1);
    slot.ondragover = (event) => event.preventDefault();
    slot.ondrop = (event) => {
      event.preventDefault();
      if (from >= 0 && from !== to) move(from, to);
    };
  });
}
