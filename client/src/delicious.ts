import { EVENTS, TICK_MS, type WorldEvent } from "@runic/shared";
import type { WorldConnection } from "./players.ts";

/**
 * The Delicious buff's countdown, under the health line: each `delicious` event for our own
 * player starts or refreshes it, and it runs down by the wall clock, one second at a time (#221).
 */
export function showDelicious(room: WorldConnection) {
  const buff = document.getElementById("buff")!;
  let endsAt = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const stop = () => {
    clearInterval(timer);
    timer = undefined;
  };
  const draw = () => {
    const seconds = Math.ceil((endsAt - Date.now()) / 1000);
    if (seconds <= 0) {
      stop();
      buff.hidden = true;
      return;
    }
    buff.textContent = `Delicious: extra healing for ${seconds}s`;
  };
  room.onMessage(EVENTS, (events: WorldEvent[]) => {
    for (const event of events) {
      if (event.type !== "delicious" || event.player !== room.sessionId)
        continue;
      endsAt = Date.now() + event.ticks * TICK_MS;
      buff.hidden = false;
      clearInterval(timer);
      timer = setInterval(draw, 1000);
      draw();
    }
  });
  room.onLeave(() => {
    stop();
    buff.hidden = true;
  });
}
