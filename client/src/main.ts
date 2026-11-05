import { Client, CloseCode } from "@colyseus/sdk";
import {
  LOGOUT_INTENT,
  parseRegion,
  REGION_GRID,
  respawnTile,
  TAKEN_OVER_CLOSE_CODE,
} from "@runic/shared";
import { showBottomBar } from "./bottomBar.ts";
import { showBushes } from "./bushes.ts";
import { loadCharacters, loadSpiders } from "./characters.ts";
import { walkOnClick } from "./clicks.ts";
import { showFights } from "./fights.ts";
import { forgetToken, joinWorld } from "./login.ts";
import { showPlayers, type WorldConnection } from "./players.ts";
import { isTakenOver, rejoin, servedVersion } from "./reconnect.ts";
import { addRegionMeshes } from "./regionMeshes.ts";
import { focusOn, scene } from "./scene.ts";
import { showSpiders } from "./spiders.ts";

const tiles = parseRegion(REGION_GRID);
const respawn = respawnTile(tiles);
focusOn(respawn.x, respawn.y);
const [newFigure, newSpider, setBushRunOut] = await Promise.all([
  loadCharacters(),
  loadSpiders(),
  addRegionMeshes(scene, tiles),
]);
document.getElementById("loading")!.remove();

const status = document.getElementById("status")!;
const logout = document.getElementById("logout")!;
const client = new Client(location.origin);

/** Everything that shows a room tidies up after itself in that room's onLeave. */
function enterWorld(room: WorldConnection) {
  status.textContent = "";
  const sayOverhead = showPlayers(room, newFigure);
  walkOnClick(
    room,
    tiles,
    showSpiders(room, newSpider),
    showBushes(room, tiles, setBushRunOut),
  );
  showBottomBar(room, sayOverhead);
  showFights(room);

  logout.hidden = false;
  logout.onclick = () => room.send(LOGOUT_INTENT);
  // If the SDK can't get back in, onLeave rejoins.
  room.onDrop(() => (status.textContent = "Reconnecting…"));
  room.onReconnect(() => (status.textContent = ""));
  // The server decides whether a log out goes through, so the token stays until it does.
  room.onLeave(async (code) => {
    logout.hidden = true;
    if (code === CloseCode.CONSENTED) {
      forgetToken();
      location.reload();
    } else if (code === TAKEN_OVER_CLOSE_CODE) {
      showTakenOver();
    } else {
      status.textContent = "Reconnecting…";
      await enter(() =>
        rejoin(
          import.meta.env.VITE_BUILD_VERSION,
          servedVersion,
          () => joinWorld(client),
          () => location.reload(),
        ),
      );
    }
  });
}

function showTakenOver() {
  status.textContent = "Logged in somewhere else. Reload to play here.";
}

/** A newer login can replace this one while its join still waits on a lock. */
async function enter(join: () => Promise<WorldConnection>) {
  try {
    enterWorld(await join());
  } catch (error) {
    if (!isTakenOver(error)) throw error;
    showTakenOver();
  }
}

await enter(() => joinWorld(client));
