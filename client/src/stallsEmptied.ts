import {
  EVENTS,
  TICK_MS,
  type StallKind,
  type WorldEvent,
} from "@runic/shared";
import type { WorldConnection } from "./players.ts";

/**
 * Bares a stall's counter while the server says it is empty for this player: only their own
 * client hides the wares, since everyone else can still steal from it (#252).
 */
export function showStallsEmptied(
  room: WorldConnection,
  wares: Map<StallKind, { visible: boolean }>,
) {
  const refills = new Map<StallKind, ReturnType<typeof setTimeout>>();
  const refill = (stall: StallKind) => {
    clearTimeout(refills.get(stall));
    refills.delete(stall);
    const ware = wares.get(stall);
    if (ware) ware.visible = true;
  };
  room.onMessage(EVENTS, (events: WorldEvent[]) => {
    for (const event of events) {
      if (event.type !== "stallEmptied" || event.player !== room.sessionId)
        continue;
      const { stall, ticks } = event;
      const ware = wares.get(stall);
      if (!ware) continue;
      refill(stall);
      ware.visible = false;
      refills.set(
        stall,
        setTimeout(() => refill(stall), ticks * TICK_MS),
      );
    }
  });
  room.onLeave(() => [...refills.keys()].forEach(refill));
}
