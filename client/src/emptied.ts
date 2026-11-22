import {
  EVENTS,
  TICK_MS,
  type StallKind,
  type StrongboxKind,
  type WorldEvent,
} from "@runic/shared";
import type { WorldConnection } from "./players.ts";

/** What a success hides for the thief alone: a stall's wares (#252), or a strongbox's closed lid (#253). */
type Stocked = { visible: boolean };

/**
 * Hides what a stall or strongbox shows while full, for as long as the server says it is empty for
 * this player: only their own client changes, since everyone else can still take from it.
 */
export function showEmptied(
  room: WorldConnection,
  stocked: {
    stall: Map<StallKind, Stocked>;
    strongbox: Map<StrongboxKind, Stocked>;
  },
) {
  const refills = new Map<Stocked, ReturnType<typeof setTimeout>>();
  const refill = (look: Stocked) => {
    clearTimeout(refills.get(look));
    refills.delete(look);
    look.visible = true;
  };
  room.onMessage(EVENTS, (events: WorldEvent[]) => {
    for (const event of events) {
      if (event.type !== "stallEmptied" && event.type !== "strongboxEmptied")
        continue;
      if (event.player !== room.sessionId) continue;
      const look =
        event.type === "stallEmptied"
          ? stocked.stall.get(event.stall)
          : stocked.strongbox.get(event.strongbox);
      if (!look) continue;
      refill(look);
      look.visible = false;
      refills.set(
        look,
        setTimeout(() => refill(look), event.ticks * TICK_MS),
      );
    }
  });
  room.onLeave(() => [...refills.keys()].forEach(refill));
}
