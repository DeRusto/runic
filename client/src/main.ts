import { Client } from "@colyseus/sdk";
import { parseRegion, REGION_GRID, TILE_KINDS } from "@runic/shared";
import { joinWorld } from "./login.ts";
import { addRegionMeshes } from "./regionMeshes.ts";
import { focusOn, scene } from "./scene.ts";

const tiles = parseRegion(REGION_GRID);
const respawnY = tiles.findIndex((row) => row.includes(TILE_KINDS.R));
focusOn(tiles[respawnY]!.indexOf(TILE_KINDS.R), respawnY);
await addRegionMeshes(scene, tiles);

const ticks = document.getElementById("ticks")!;
const room = await joinWorld(new Client(location.origin));

let last = performance.now();
room.onStateChange((state: { tick: number }) => {
  const now = performance.now();
  ticks.textContent = `tick ${state.tick} (${Math.round(now - last)} ms since last patch)`;
  last = now;
});
