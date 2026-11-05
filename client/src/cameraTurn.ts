const QUARTER_TURN = Math.PI / 2;

/** The view's angle, turning by quarters. A press mid-turn adds to where it was heading, so it always settles on one of the 4 angles. */
export function cameraTurner(turnMs: number, now: () => number) {
  let from = 0;
  let to = 0;
  let startedAt = 0;

  const angle = () => {
    const t = turnMs ? Math.min((now() - startedAt) / turnMs, 1) : 1;
    return from + (to - from) * t * t * (3 - 2 * t);
  };

  return {
    angle,
    turn(quarters: number) {
      from = angle();
      to += quarters * QUARTER_TURN;
      startedAt = now();
    },
  };
}

/** Quarters a key press turns the view by; 0 if it isn't a turn. Typing in chat or a login form never turns it. */
export function quartersForKey(event: KeyboardEvent) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return 0;
  if (event.target instanceof HTMLInputElement) return 0;
  const key = event.key.toLowerCase();
  return key === "q" ? -1 : key === "e" ? 1 : 0;
}
