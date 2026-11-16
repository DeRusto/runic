import { Callbacks } from "@colyseus/sdk";
import type { Tile } from "@runic/shared";
import * as THREE from "three";
import { flameLook } from "./flame.ts";
import { tileHitBoxes } from "./hitBoxes.ts";
import type { WorldConnection } from "./players.ts";
import { loadPart } from "./regionMeshes.ts";
import { scene } from "./scene.ts";
import { addFireTile, removeFireTile } from "./stations.ts";

// Loaded once, on the first fire, and shared by every fire after it.
let pit: Promise<THREE.Object3D> | undefined;

/** A fire's look: Kenney's campfire pit with a flame over it (#224). */
function flame({ x, y }: Tile) {
  const group = new THREE.Group();
  pit ??= loadPart({ file: "campfirePit.glb", width: 0.8 });
  void pit.then((model) => group.add(model.clone()));
  const fire = flameLook(x, y);
  fire.position.y = 0.12;
  group.add(fire);
  return group;
}

/**
 * Shows every fire the server has as a flame, and returns what finds one under a click's ray.
 * Fires appear and vanish as they are lit and burnt out (#224).
 */
export function showFires(room: WorldConnection) {
  const callbacks = Callbacks.get(room);
  const sites = tileHitBoxes<{ log: string }>(room);
  const looks = new Map<string, THREE.Object3D>();
  const tiles = new Map<string, Tile>();
  callbacks.onAdd("fires", (fire, id) => {
    const [x, y] = id.split(",").map(Number) as [number, number];
    const tile = { x, y };
    sites.add(id, () => ({ log: (fire as { log: string }).log }));
    addFireTile(tile);
    const look = flame(tile);
    look.position.set(x, 0, y);
    tiles.set(id, tile);
    looks.set(id, look);
    scene.add(look);
  });
  callbacks.onRemove("fires", (_, id) => {
    sites.remove(id);
    removeFireTile(tiles.get(id)!);
    scene.remove(looks.get(id)!);
    tiles.delete(id);
    looks.delete(id);
  });
  // A rejoin's fires are its own; the old room's tiles and looks go with it.
  room.onLeave(() => {
    for (const [id, tile] of tiles) {
      removeFireTile(tile);
      scene.remove(looks.get(id)!);
    }
    tiles.clear();
    looks.clear();
  });
  return sites.under;
}
