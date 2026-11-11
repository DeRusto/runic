import {
  GATHERING,
  gatherRefusal,
  stationRefusal,
  TAKE_INTENT,
  TARGET_INTENT,
  TICK_MS,
  VISIT_INTENT,
  WALK_INTENT,
  type TileKind,
} from "@runic/shared";
import * as THREE from "three";
import type { addBlacksmith } from "./blacksmith.ts";
import { printChatLine } from "./bottomBar.ts";
import type { showGatheringSites } from "./gatheringSites.ts";
import type { showGroundItems } from "./groundItemSacks.ts";
import type { showPileWindow } from "./pileWindow.ts";
import type { OpenMenu } from "./characterSheet.ts";
import { playerMenuChoices } from "./playerMenu.ts";
import type { showPlayers, WorldConnection } from "./players.ts";
import { camera, renderer, scene } from "./scene.ts";
import type { showEnemies } from "./enemies.ts";
import type { showSmithingPanel } from "./smithingPanel.ts";
import { stationTile, type addStations } from "./stations.ts";

const MARKER_MS = 2 * TICK_MS;

/** A click targets the live enemy, ground item or pile, bush, vein, station or Blacksmith under the ray, or else walks to the tile under it on the ground plane. A right-click on another player opens the player menu. */
export function walkOnClick(
  room: WorldConnection,
  tiles: TileKind[][],
  enemyUnder: ReturnType<typeof showEnemies>,
  siteUnder: ReturnType<typeof showGatheringSites>,
  stationUnder: ReturnType<typeof addStations>,
  openSmithingPanel: ReturnType<typeof showSmithingPanel>,
  blacksmithUnder: Awaited<ReturnType<typeof addBlacksmith>>,
  groundItemUnder: ReturnType<typeof showGroundItems>,
  openPileWindow: ReturnType<typeof showPileWindow>,
  otherPlayerUnder: ReturnType<typeof showPlayers>["otherPlayerUnder"],
  openMenu: OpenMenu,
) {
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0));
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hit = new THREE.Vector3();

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.28, 0.42, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffe066 }),
  );
  marker.visible = false;
  scene.add(marker);
  let hideMarker: ReturnType<typeof setTimeout>;
  const showMarker = (x: number, y: number) => {
    marker.position.set(x, 0.02, y);
    marker.visible = true;
    clearTimeout(hideMarker);
    hideMarker = setTimeout(() => (marker.visible = false), MARKER_MS);
  };

  const aim = (event: MouseEvent) => {
    pointer.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
  };

  // The browser's own menu never shows on the canvas, whatever is under the click.
  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    aim(event);
    const id = otherPlayerUnder(raycaster);
    if (id) openMenu(event, [...playerMenuChoices(room, id)]);
  };

  const onClick = (event: MouseEvent) => {
    aim(event);
    const enemy = enemyUnder(raycaster);
    if (enemy) {
      showMarker(enemy.tile.x, enemy.tile.y);
      room.send(TARGET_INTENT, enemy.id);
      return;
    }
    const groundItem = groundItemUnder(raycaster);
    if (groundItem) {
      showMarker(groundItem.x, groundItem.y);
      if (groundItem.ids.length > 1) openPileWindow(groundItem);
      else room.send(TAKE_INTENT, groundItem.ids[0]);
      return;
    }
    const site = siteUnder(raycaster);
    const me = room.state.players.get(room.sessionId);
    if (site && me) {
      const refusal = gatherRefusal(site.skill, site.kind, site.left(), me);
      if (refusal) {
        printChatLine(refusal);
      } else {
        showMarker(site.x, site.y);
        room.send(GATHERING[site.skill].intent, site.id);
      }
      return;
    }
    const station = stationUnder(raycaster);
    if (station && me) {
      const refusal = stationRefusal(station, me);
      if (refusal) {
        printChatLine(refusal);
      } else {
        const { x, y } = stationTile(station, me);
        showMarker(x, y);
        openSmithingPanel(station);
      }
      return;
    }
    const blacksmith = blacksmithUnder(raycaster);
    if (blacksmith) {
      showMarker(blacksmith.x, blacksmith.y);
      room.send(VISIT_INTENT);
      return;
    }
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const x = Math.round(hit.x);
    const y = Math.round(hit.z);
    if (!tiles[y]?.[x]) return;

    showMarker(x, y);
    room.send(WALK_INTENT, { x, y });
  };
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("contextmenu", onContextMenu);

  room.onLeave(() => {
    renderer.domElement.removeEventListener("click", onClick);
    renderer.domElement.removeEventListener("contextmenu", onContextMenu);
    clearTimeout(hideMarker);
    scene.remove(marker);
  });
}
