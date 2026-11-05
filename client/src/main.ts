import { Client } from "@colyseus/sdk";
import { parseRegion, REGION_GRID, respawnTile } from "@runic/shared";
import { loadCharacters } from "./characters.ts";
import { walkOnClick } from "./clicks.ts";
import { joinWorld } from "./login.ts";
import { showPlayers } from "./players.ts";
import { addRegionMeshes } from "./regionMeshes.ts";
import { focusOn, scene } from "./scene.ts";

const tiles = parseRegion(REGION_GRID);
const respawn = respawnTile(tiles);
focusOn(respawn.x, respawn.y);
const [newFigure] = await Promise.all([
  loadCharacters(),
  addRegionMeshes(scene, tiles),
]);
document.getElementById("loading")!.remove();

const ticks = document.getElementById("ticks")!;
const room = await joinWorld(new Client(location.origin));
showPlayers(room, newFigure);
walkOnClick(room, tiles);

let last = performance.now();
room.onStateChange((state: { tick: number }) => {
  const now = performance.now();
  ticks.textContent = `tick ${state.tick} (${Math.round(now - last)} ms since last patch)`;
  last = now;
});
