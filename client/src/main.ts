import { Client } from "@colyseus/sdk";
import { WORLD_ROOM } from "@runic/shared";

const ticks = document.getElementById("ticks")!;
const room = await new Client(location.origin).join(WORLD_ROOM);

let last = performance.now();
room.onStateChange((state: { tick: number }) => {
  const now = performance.now();
  ticks.textContent = `tick ${state.tick} (${Math.round(now - last)} ms since last patch)`;
  last = now;
});
