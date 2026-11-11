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
 */
export function dragToReorder(
  slots: HTMLElement[],
  move: (from: number, to: number) => void,
) {
  let from = -1;
  slots.forEach((slot, to) => {
    slot.ondragstart = () => (from = to);
    slot.ondragend = () => (from = -1);
    slot.ondragover = (event) => event.preventDefault();
    slot.ondrop = (event) => {
      event.preventDefault();
      if (from >= 0 && from !== to) move(from, to);
    };
  });
}
