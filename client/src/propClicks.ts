import type { Tile } from "@runic/shared";
import * as THREE from "three";

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tileKey = ({ x, y }: Tile) => `${x},${y}`;

/** Whether `object` is drawn: it and everything it hangs from are visible. */
function drawn(object: THREE.Object3D | null) {
  for (; object; object = object.parent) if (!object.visible) return false;
  return true;
}

/**
 * What finds a prop that stands on the ground (an obstacle, stall, strongbox, station, fire or
 * gathering site) under a click. A click finds a prop exactly when its ray meets the prop's drawn
 * model, or when the ground tile under it, the one a walk would head for, is one of the prop's own
 * tiles. Nothing invisible stands up off the ground, so the grass beside or behind it always walks,
 * and a prop that has run out still catches a click on its own tile, to say why it's refused.
 */
export function propClicks<Target>() {
  const models = new Map<THREE.Object3D, Target>();
  const ownTiles = new Map<string, Target>();
  /** The target whose model holds `object`, which may be a part deep inside it. */
  const modelOf = (object: THREE.Object3D | null) => {
    for (; object; object = object.parent)
      if (models.has(object)) return models.get(object);
    return undefined;
  };
  return {
    /** Makes `target` clickable on each of its `tiles` and, given one, on its `model`. */
    add(target: Target, tiles: Tile[], model?: THREE.Object3D) {
      for (const tile of tiles) ownTiles.set(tileKey(tile), target);
      if (model) models.set(model, target);
    },
    /** Takes `target` off its tiles and its model, for a prop that is gone. */
    remove(target: Target) {
      for (const map of [ownTiles, models] as Map<unknown, Target>[])
        for (const [key, value] of map) if (value === target) map.delete(key);
    },
    /** The prop under a click's ray, and where the ray meets the ground, or the model if it doesn't. */
    under(raycaster: THREE.Raycaster) {
      const ground = raycaster.ray.intersectPlane(GROUND, new THREE.Vector3());
      const hit = raycaster
        .intersectObjects([...models.keys()])
        .find(({ object }) => drawn(object));
      if (hit) return { target: modelOf(hit.object)!, at: ground ?? hit.point };
      const target =
        ground &&
        ownTiles.get(
          tileKey({ x: Math.round(ground.x), y: Math.round(ground.z) }),
        );
      return target === undefined || !ground
        ? undefined
        : { target, at: ground };
    },
  };
}
