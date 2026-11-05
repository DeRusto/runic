import {
  bushRefusal,
  FORAGE_INTENT,
  TARGET_INTENT,
  TICK_MS,
  WALK_INTENT,
  type TileKind,
} from "@runic/shared";
import * as THREE from "three";
import { printChatLine } from "./bottomBar.ts";
import type { showBushes } from "./bushes.ts";
import type { WorldConnection } from "./players.ts";
import { camera, renderer, scene } from "./scene.ts";
import type { showSpiders } from "./spiders.ts";

const MARKER_MS = 2 * TICK_MS;

/** A click targets the live Spider or bush under the ray, or else walks to the tile under it on the ground plane. */
export function walkOnClick(
  room: WorldConnection,
  tiles: TileKind[][],
  spiderUnder: ReturnType<typeof showSpiders>,
  bushUnder: ReturnType<typeof showBushes>,
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

  renderer.domElement.addEventListener("click", (event) => {
    pointer.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const spider = spiderUnder(raycaster);
    if (spider) {
      showMarker(spider.tile.x, spider.tile.y);
      room.send(TARGET_INTENT, spider.id);
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
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const x = Math.round(hit.x);
    const y = Math.round(hit.z);
    if (!tiles[y]?.[x]) return;

    showMarker(x, y);
    room.send(WALK_INTENT, { x, y });
  });
}
