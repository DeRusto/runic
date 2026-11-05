import { TICK_MS } from "@runic/shared";

/** Turns elapsed-time frames into ticks: at most one per frame, with at most one tick of backlog kept. */
export function tickStepper(step: () => void) {
  let elapsed = 0;
  return (deltaMs: number) => {
    elapsed += deltaMs;
    if (elapsed < TICK_MS) return;
    elapsed = Math.min(elapsed - TICK_MS, TICK_MS);
    step();
  };
}
