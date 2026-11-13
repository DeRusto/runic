import {
  AVOIDANCE_POTION_POINTS,
  EVENTS,
  FORTITUDE_POTION_PERCENT,
  MIGHT_POTION_HIT,
  TICK_MS,
  type Virtue,
  type WorldEvent,
} from "@runic/shared";
import type { WorldConnection } from "./players.ts";

/** What each Virtue potion's buff does, in the Gear tab's units (#222). */
const POTION_BUFF_DOES: Record<Virtue, string> = {
  might: `+${MIGHT_POTION_HIT} to your hit`,
  fortitude: `+${FORTITUDE_POTION_PERCENT}% max health`,
  avoidance: `+${AVOIDANCE_POTION_POINTS} to your Avoidance`,
};

const capitalised = (words: string) =>
  words.charAt(0).toUpperCase() + words.slice(1);

/**
 * A buff's countdown under the health line: each event for our own player starts or
 * refreshes it, and it runs down by the wall clock, one second at a time (#221, #222).
 * A ticks of 0 hides it.
 */
function countdown(element: HTMLElement) {
  let endsAt = 0;
  let label = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  const draw = () => {
    const seconds = Math.ceil((endsAt - Date.now()) / 1000);
    if (seconds <= 0) {
      clearInterval(timer);
      timer = undefined;
      element.hidden = true;
      return;
    }
    element.textContent = `${label} for ${seconds}s`;
  };
  return (ticks: number, text: string) => {
    label = text;
    endsAt = Date.now() + ticks * TICK_MS;
    element.hidden = false;
    clearInterval(timer);
    timer = setInterval(draw, 1000);
    draw();
  };
}

/** The Delicious fish's and a Virtue potion's buff countdowns, under the health line. Only one of each runs at a time: a new drink refreshes, never stacks (#221, #222). */
export function showBuffs(room: WorldConnection) {
  const delicious = countdown(document.getElementById("buff")!);
  const potion = countdown(document.getElementById("potion-buff")!);
  room.onMessage(EVENTS, (events: WorldEvent[]) => {
    for (const event of events) {
      if (!("player" in event) || event.player !== room.sessionId) continue;
      if (event.type === "delicious")
        delicious(event.ticks, "Delicious: extra healing");
      if (event.type === "potion")
        potion(
          event.ticks,
          `${capitalised(event.virtue)}: ${POTION_BUFF_DOES[event.virtue]}`,
        );
    }
  });
  room.onLeave(() => {
    delicious(0, "");
    potion(0, "");
  });
}
