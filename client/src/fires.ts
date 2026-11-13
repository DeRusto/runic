import { Callbacks } from "@colyseus/sdk";
import type { Tile } from "@runic/shared";
import * as THREE from "three";
import { tileHitBoxes } from "./hitBoxes.ts";
import type { WorldConnection } from "./players.ts";
import { scene } from "./scene.ts";
import { addFireTile, removeFireTile } from "./stations.ts";

/** A fire's look: two crossed logs, a flame over them and a warm glow (#224). Procedural, as no pack has one. */
function flame({ x, y }: Tile) {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x4a3220 });
  for (const yaw of [Math.PI / 2, 0]) {
    const log = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.16), wood);
    log.rotation.y = yaw;
    log.position.y = 0.06;
    log.castShadow = true;
    group.add(log);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.16, 0.5, 8),
    new THREE.MeshBasicMaterial({ color: 0xff9a30 }),
  );
  flame.position.y = 0.36;
  const heart = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.3, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd866 }),
  );
  heart.position.y = 0.27;
  const glow = new THREE.PointLight(0xff8a30, 5, 5);
  glow.position.y = 0.5;
  // The flame and its glow flicker, a little differently on every tile.
  flame.onBeforeRender = () => {
    const now = performance.now();
    flame.scale.set(
      1 + 0.1 * Math.sin(now / 90 + x * 7),
      1 + 0.18 * Math.sin(now / 70 + y * 13),
      1,
    );
    glow.intensity = 5 + 0.8 * Math.sin(now / 110 + x * 3 + y);
  };
  group.add(flame, heart, glow);
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
