import { Client, CloseCode } from "@colyseus/sdk";
import {
  GATHERING,
  loadRegion,
  respawnTile,
  siteId,
  TAKEN_OVER_CLOSE_CODE,
} from "@runic/shared";
import { DefaultLoadingManager } from "three";
import regionMap from "../../maps/region.tmj?raw";
import regionTileset from "../../maps/region.tsj?raw";
import { showBankWindow } from "./bankWindow.ts";
import { addBarButtons } from "./barButtons.ts";
import { addVillagers } from "./villagers.ts";
import { showBottomBar } from "./bottomBar.ts";
import { loadCharacters, loadSkeletons, loadSpiders } from "./characters.ts";
import { walkOnClick } from "./clicks.ts";
import { showBuffs } from "./delicious.ts";
import { showDialogueBox } from "./dialogueBox.ts";
import { showEnemies } from "./enemies.ts";
import { showFights } from "./fights.ts";
import { showGatheringSites } from "./gatheringSites.ts";
import { showGroundItems } from "./groundItemSacks.ts";
import { forgetToken, joinWorld } from "./login.ts";
import { showLogoutConfirm } from "./logoutConfirm.ts";
import { watchPanels } from "./panels.ts";
import { showPileWindow } from "./pileWindow.ts";
import { showPlayers, type WorldConnection } from "./players.ts";
import { isTakenOver, rejoin, servedVersion } from "./reconnect.ts";
import { addRegionMeshes } from "./regionMeshes.ts";
import { focusOn, scene } from "./scene.ts";
import { showSmithingPanel } from "./smithingPanel.ts";
import { showSocialPanel } from "./socialPanel.ts";
import { showStoreWindow } from "./storeWindow.ts";
import { addStations } from "./stations.ts";

const loading = document.getElementById("loading")!;
let loaded = 0;
// Every model loader uses the default manager; its total grows as files are found, so never step back.
DefaultLoadingManager.onProgress = (_url, done, total) => {
  // A glTF can count as done before its own textures are found, so only the models settling make 100.
  loaded = Math.max(loaded, Math.min(99, Math.round((done / total) * 100)));
  loading.querySelector("i")!.style.width = `${loaded}%`;
  loading.setAttribute("aria-valuenow", String(loaded));
};

const { tiles, pools } = loadRegion(regionMap, regionTileset);
// Every spot gets a site drawn on it, gone until the server puts one there.
const spots = pools.flatMap(({ skill, kind, spots }) =>
  spots.map(({ x, y }) => {
    Object.assign(tiles[y]![x]!, { [GATHERING[skill].site]: kind });
    return siteId({ x, y });
  }),
);
const respawn = respawnTile(tiles);
focusOn(respawn.x, respawn.y);
const [newFigure, newSpider, newSkeleton, setSiteLook, villagerUnder] =
  await Promise.all([
    loadCharacters(),
    loadSpiders(),
    loadSkeletons(),
    addRegionMeshes(scene, tiles),
    addVillagers(tiles),
  ])
    // Loads still in flight after a failure would look for a bar that is gone.
    .finally(() => (DefaultLoadingManager.onProgress = () => {}))
    .catch((error) => {
      loading.dataset.failed = "";
      loading.setAttribute("role", "alert");
      loading.removeAttribute("aria-label");
      loading.textContent = "Could not load the game. Reload to try again.";
      throw error;
    });
for (const id of spots) setSiteLook(id, "gone");
// The splash stays behind the login form until the first join settles.
loading.remove();
const stationUnder = addStations(tiles);
watchPanels();

const status = document.getElementById("status")!;
const logout = document.getElementById("logout")!;
const client = new Client(location.origin);
addBarButtons();

/** Everything that shows a room tidies up after itself in that room's onLeave. */
function enterWorld(room: WorldConnection) {
  status.textContent = "";
  const { sayOverhead, otherPlayerUnder } = showPlayers(room, newFigure);
  const openMenu = showBottomBar(room, sayOverhead);
  walkOnClick(
    room,
    tiles,
    showEnemies(room, { spider: newSpider, skeleton: newSkeleton }),
    showGatheringSites(room, tiles, spots, setSiteLook),
    stationUnder,
    showSmithingPanel(room),
    villagerUnder,
    showGroundItems(room),
    showPileWindow(room),
    otherPlayerUnder,
    openMenu,
  );
  showSocialPanel(room);
  showFights(room);
  showBuffs(room);
  showDialogueBox(room);
  showStoreWindow(room, openMenu);
  showBankWindow(room, openMenu);

  logout.hidden = false;
  showLogoutConfirm(room);
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
  } finally {
    document.getElementById("splash")?.remove();
  }
}

await enter(() => joinWorld(client));
