import { Client } from "@colyseus/sdk";
import { parseRegion, REGION_GRID, respawnTile } from "@runic/shared";
import { loadCharacters, loadSpiders } from "./characters.ts";
import { walkOnClick } from "./clicks.ts";
import { joinWorld } from "./login.ts";
import { showPlayers } from "./players.ts";
import { addRegionMeshes } from "./regionMeshes.ts";
import { focusOn, scene } from "./scene.ts";
import { showSpiders } from "./spiders.ts";

const tiles = parseRegion(REGION_GRID);
const respawn = respawnTile(tiles);
focusOn(respawn.x, respawn.y);
const [newFigure, newSpider] = await Promise.all([
  loadCharacters(),
  loadSpiders(),
  addRegionMeshes(scene, tiles),
]);
document.getElementById("loading")!.remove();

const ticks = document.getElementById("ticks")!;
const room = await joinWorld(new Client(location.origin));
showPlayers(room, newFigure);
walkOnClick(room, tiles, showSpiders(room, newSpider));

let last = performance.now();
room.onStateChange((state: { tick: number }) => {
  const now = performance.now();
  ticks.textContent = `tick ${state.tick} (${Math.round(now - last)} ms since last patch)`;
  last = now;
});
