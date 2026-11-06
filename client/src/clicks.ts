import {
  bushRefusal,
  FORAGE_INTENT,
  MINE_INTENT,
  stationRefusal,
  TARGET_INTENT,
  TICK_MS,
  veinRefusal,
  VISIT_INTENT,
  WALK_INTENT,
  type TileKind,
} from "@runic/shared";
import * as THREE from "three";
import type { addBlacksmith } from "./blacksmith.ts";
import { printChatLine } from "./bottomBar.ts";
import type { showBushes } from "./bushes.ts";
import type { WorldConnection } from "./players.ts";
import { camera, renderer, scene } from "./scene.ts";
import type { showEnemies } from "./enemies.ts";
import type { showSmithingPanel } from "./smithingPanel.ts";
import type { addStations } from "./stations.ts";
import type { showVeins } from "./veins.ts";

const MARKER_MS = 2 * TICK_MS;

/** A click targets the live enemy, bush, vein, station or Blacksmith under the ray, or else walks to the tile under it on the ground plane. */
export function walkOnClick(
  room: WorldConnection,
  tiles: TileKind[][],
  enemyUnder: ReturnType<typeof showEnemies>,
  bushUnder: ReturnType<typeof showBushes>,
  veinUnder: ReturnType<typeof showVeins>,
  stationUnder: ReturnType<typeof addStations>,
  openSmithingPanel: ReturnType<typeof showSmithingPanel>,
  blacksmithUnder: Awaited<ReturnType<typeof addBlacksmith>>,
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

  const onClick = (event: MouseEvent) => {
    pointer.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const enemy = enemyUnder(raycaster);
    if (enemy) {
      showMarker(enemy.tile.x, enemy.tile.y);
      room.send(TARGET_INTENT, enemy.id);
      return;
    }
    const bush = bushUnder(raycaster);
    const me = room.state.players.get(room.sessionId);
    if (bush && me) {
      const refusal = bushRefusal(bush.kind, bush.picksLeft(), me);
      if (refusal) {
        printChatLine(refusal);
      } else {
        showMarker(bush.x, bush.y);
        room.send(FORAGE_INTENT, bush.id);
      }
      return;
    }
    const vein = veinUnder(raycaster);
    if (vein && me) {
      const refusal = veinRefusal(vein.tier, vein.oreLeft(), me);
      if (refusal) {
        printChatLine(refusal);
      } else {
        showMarker(vein.x, vein.y);
        room.send(MINE_INTENT, vein.id);
      }
      return;
    }
    const station = stationUnder(raycaster);
    if (station && me) {
      const refusal = stationRefusal(station, me);
      if (refusal) printChatLine(refusal);
      else openSmithingPanel(station);
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

  room.onLeave(() => {
    renderer.domElement.removeEventListener("click", onClick);
    clearTimeout(hideMarker);
    scene.remove(marker);
  });
}
