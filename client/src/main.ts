import { Client } from "@colyseus/sdk";
import { joinWorld } from "./login.ts";

const ticks = document.getElementById("ticks")!;
const room = await joinWorld(new Client(location.origin));

let last = performance.now();
room.onStateChange((state: { tick: number }) => {
  const now = performance.now();
  ticks.textContent = `tick ${state.tick} (${Math.round(now - last)} ms since last patch)`;
  last = now;
});
