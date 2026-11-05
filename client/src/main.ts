import { Client } from "@colyseus/sdk";
import { parseRegion, REGION_GRID, respawnTile } from "@runic/shared";
import { walkOnClick } from "./clicks.ts";
import { joinWorld } from "./login.ts";
import { showPlayers } from "./players.ts";
import { addRegionMeshes } from "./regionMeshes.ts";
import { focusOn, scene } from "./scene.ts";

const tiles = parseRegion(REGION_GRID);
const respawn = respawnTile(tiles);
focusOn(respawn.x, respawn.y);
await addRegionMeshes(scene, tiles);

const ticks = document.getElementById("ticks")!;
const room = await joinWorld(new Client(location.origin));
showPlayers(room);
walkOnClick(room, tiles);

let last = performance.now();
room.onStateChange((state: { tick: number }) => {
  const now = performance.now();
  ticks.textContent = `tick ${state.tick} (${Math.round(now - last)} ms since last patch)`;
  last = now;
});
