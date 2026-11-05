import { TICK_MS, WALK_INTENT, type TileKind } from "@runic/shared";
import * as THREE from "three";
import type { WorldConnection } from "./players.ts";
import { camera, renderer, scene } from "./scene.ts";

const MARKER_MS = 2 * TICK_MS;

/** A click picks the tile under the ray on the ground plane, so nothing on the ground can catch it. */
export function walkOnClick(room: WorldConnection, tiles: TileKind[][]) {
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

  renderer.domElement.addEventListener("click", (event) => {
    pointer.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    const x = Math.round(hit.x);
    const y = Math.round(hit.z);
    if (!tiles[y]?.[x]) return;

    marker.position.set(x, 0.02, y);
    marker.visible = true;
    clearTimeout(hideMarker);
    hideMarker = setTimeout(() => (marker.visible = false), MARKER_MS);

    room.send(WALK_INTENT, { x, y });
  });
}
