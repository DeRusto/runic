import { Client, CloseCode } from "@colyseus/sdk";
import {
  loadRegion,
  LOGOUT_INTENT,
  respawnTile,
  TAKEN_OVER_CLOSE_CODE,
} from "@runic/shared";
import regionMap from "../../maps/region.tmj?raw";
import regionTileset from "../../maps/region.tsj?raw";
import { addBlacksmith } from "./blacksmith.ts";
import { showBottomBar } from "./bottomBar.ts";
import { loadCharacters, loadSkeletons, loadSpiders } from "./characters.ts";
import { walkOnClick } from "./clicks.ts";
import { showEnemies } from "./enemies.ts";
import { showFights } from "./fights.ts";
import { showGatheringSites } from "./gatheringSites.ts";
import { showGroundItems } from "./groundItemSacks.ts";
import { forgetToken, joinWorld } from "./login.ts";
import { showPileWindow } from "./pileWindow.ts";
import { showPlayers, type WorldConnection } from "./players.ts";
import { isTakenOver, rejoin, servedVersion } from "./reconnect.ts";
import { addRegionMeshes } from "./regionMeshes.ts";
import { focusOn, scene } from "./scene.ts";
import { showSmithingPanel } from "./smithingPanel.ts";
import { addStations } from "./stations.ts";

const tiles = loadRegion(regionMap, regionTileset);
const respawn = respawnTile(tiles);
focusOn(respawn.x, respawn.y);
const [newFigure, newSpider, newSkeleton, setRunOut, blacksmithUnder] =
  await Promise.all([
    loadCharacters(),
    loadSpiders(),
    loadSkeletons(),
    addRegionMeshes(scene, tiles),
    addBlacksmith(tiles),
  ]).catch((error) => {
    document.getElementById("loading")!.textContent =
      "Could not load the game. Reload to try again.";
    throw error;
  });
document.getElementById("loading")!.remove();
const stationUnder = addStations(tiles);

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
    showEnemies(room, { spider: newSpider, skeleton: newSkeleton }),
    showGatheringSites(room, tiles, setRunOut),
    stationUnder,
    showSmithingPanel(room),
    blacksmithUnder,
    showGroundItems(room),
    showPileWindow(room),
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
    // Its controls would send to the room just left. A rejoin's showBottomBar brings it back.
    document.getElementById("bar")!.hidden = true;
    document.getElementById("sheet")!.hidden = true;
    document.onkeydown = null;
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
