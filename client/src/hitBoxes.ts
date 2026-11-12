import * as THREE from "three";
import type { WorldConnection } from "./players.ts";
import { scene } from "./scene.ts";

export const HIT_BOX_HEIGHT = 0.9;

const shape = new THREE.BoxGeometry(1, HIT_BOX_HEIGHT, 1);
const unseen = new THREE.MeshBasicMaterial({ visible: false });

/** An invisible tile-sized box in the scene, for a click's ray to find. */
export function newHitBox() {
  const hitBox = new THREE.Mesh(shape, unseen);
  scene.add(hitBox);
  return hitBox;
}

/**
 * Hit boxes for what stands on a tile and is keyed in state by that tile (bushes and veins).
 * A plain box, like a Spider's: one that has run out must still catch a click, to say why it's refused.
 */
export function tileHitBoxes<Site>(room: WorldConnection) {
  const hitBoxes = new Map<
    THREE.Object3D,
    Site & { id: string; x: number; y: number }
  >();
  room.onLeave(() => scene.remove(...hitBoxes.keys()));
  return {
    add(id: string, siteAt: (x: number, y: number) => Site) {
      const [x, y] = id.split(",").map(Number) as [number, number];
      const hitBox = newHitBox();
      hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
      hitBoxes.set(hitBox, { ...siteAt(x, y), id, x, y });
    },
    /** Takes away the site's box, for one gone from its spot in a site pool. */
    remove(id: string) {
      for (const [hitBox, site] of hitBoxes) {
        if (site.id !== id) continue;
        scene.remove(hitBox);
        hitBoxes.delete(hitBox);
      }
    },
    /** What finds the site under a click's ray. */
    under(raycaster: THREE.Raycaster) {
      const hit = raycaster.intersectObjects([...hitBoxes.keys()])[0];
      return hit && hitBoxes.get(hit.object);
    },
  };
}
