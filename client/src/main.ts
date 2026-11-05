import { Client, CloseCode } from "@colyseus/sdk";
import {
  LOGOUT_INTENT,
  parseRegion,
  REGION_GRID,
  respawnTile,
  TAKEN_OVER_CLOSE_CODE,
} from "@runic/shared";
import { loadCharacters } from "./characters.ts";
import { walkOnClick } from "./clicks.ts";
import { forgetToken, joinWorld } from "./login.ts";
import { showPlayers, type WorldConnection } from "./players.ts";
import { rejoin, servedVersion } from "./reconnect.ts";
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
const logout = document.getElementById("logout")!;
const client = new Client(location.origin);

function enterWorld(room: WorldConnection) {
  const hidePlayers = showPlayers(room, newFigure);
  const stopClicks = walkOnClick(room, tiles);

  logout.hidden = false;
  logout.onclick = () => room.send(LOGOUT_INTENT);
  // The server decides whether a log out goes through, so the token stays until it does.
  room.onLeave(async (code) => {
    logout.hidden = true;
    if (code === CloseCode.CONSENTED) {
      forgetToken();
      location.reload();
    } else if (code === TAKEN_OVER_CLOSE_CODE) {
      ticks.textContent = "Logged in somewhere else. Reload to play here.";
    } else {
      hidePlayers();
      stopClicks();
      ticks.textContent = "Reconnecting…";
      enterWorld(
        await rejoin(
          import.meta.env.VITE_BUILD_VERSION,
          servedVersion,
          () => joinWorld(client),
          () => location.reload(),
        ),
      );
    }
  });

  let last = performance.now();
  room.onStateChange((state: { tick: number }) => {
    const now = performance.now();
    ticks.textContent = `tick ${state.tick} (${Math.round(now - last)} ms since last patch)`;
    last = now;
  });
}

enterWorld(await joinWorld(client));
