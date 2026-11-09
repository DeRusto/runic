import { Callbacks } from "@colyseus/sdk";
import * as THREE from "three";
import { groundItemsLabel, type SeenGroundItem } from "./groundItems.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { iconUrl } from "./itemIcons.ts";
import type { WorldConnection } from "./players.ts";
import { camera, renderer, scene } from "./scene.ts";

const HOVER_SCALE = 1.15;

// shortcut: a sphere with a cone neck stands in for a sack, until a proper sack model is found.
const sackMaterial = new THREE.MeshStandardMaterial({
  color: 0x8a6a3e,
  roughness: 1,
});
const neckMaterial = new THREE.MeshStandardMaterial({
  color: 0x4a3420,
  roughness: 1,
});
const ringShape = new THREE.RingGeometry(0.36, 0.44, 32).rotateX(-Math.PI / 2);
const ringMaterial = new THREE.MeshBasicMaterial({
  color: 0xffd34d,
  transparent: true,
  opacity: 0.7,
});

const loader = new THREE.TextureLoader();
const icons = new Map<string, THREE.SpriteMaterial>();
const iconOf = (item: string) => {
  if (!icons.has(item)) {
    const map = loader.load(iconUrl(item));
    map.colorSpace = THREE.SRGBColorSpace;
    icons.set(item, new THREE.SpriteMaterial({ map }));
  }
  return icons.get(item)!;
};

/** One sack for a tile's ground items: bigger for a pile, with the item's icon above it for one. A gold ring marks `mine`. */
function sackFor(items: SeenGroundItem[], mine: boolean) {
  const group = new THREE.Group();
  const size = items.length > 1 ? 0.3 : 0.22;
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 12),
    sackMaterial,
  );
  body.scale.y = 0.8;
  body.position.y = size * 0.75;
  body.castShadow = true;
  const neck = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.45, size * 0.7, 10),
    neckMaterial,
  );
  neck.position.y = size * 1.55;
  group.add(body, neck);
  if (items.length === 1) {
    const icon = new THREE.Sprite(iconOf(items[0]!.item));
    icon.scale.setScalar(0.32);
    icon.position.y = size * 2.4;
    group.add(icon);
  }
  if (mine) {
    const ring = new THREE.Mesh(ringShape, ringMaterial);
    ring.position.y = 0.015;
    group.add(ring);
  }
  return group;
}

/**
 * Draws one sack on each tile with ground items this player can see (the server sends no
 * others), and labels the tile under the pointer. Returns what finds the tile of ground items
 * under a click's ray, with their ids.
 */
export function showGroundItems(room: WorldConnection) {
  const callbacks = Callbacks.get(room);
  const label = document.getElementById("ground-label")!;
  const tiles = new Map<
    string,
    {
      sack: THREE.Group;
      hitBox: THREE.Mesh;
      items: SeenGroundItem[];
      ids: string[];
      x: number;
      y: number;
    }
  >();
  /** Kept apart from state, where a removed one may still be on its way out. */
  const seen = new Map<string, SeenGroundItem & { x: number; y: number }>();
  const me = () => room.state.players.get(room.sessionId)?.username ?? "";

  const redraw = (x: number, y: number) => {
    const key = `${x},${y}`;
    const old = tiles.get(key);
    if (old) scene.remove(old.sack, old.hitBox);
    tiles.delete(key);
    const here = [...seen].filter(([, item]) => item.x === x && item.y === y);
    if (!here.length) return;
    const items = here.map(([, item]) => item);
    const ids = here.map(([id]) => id);
    const sack = sackFor(
      items,
      items.some(({ owner }) => owner && owner === me()),
    );
    sack.position.set(x, 0, y);
    const hitBox = newHitBox();
    hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
    scene.add(sack);
    tiles.set(key, { sack, hitBox, items, ids, x, y });
  };

  callbacks.onAdd("groundItems", (groundItem, id) => {
    const { x, y } = groundItem;
    seen.set(id, groundItem);
    redraw(x, y);
    // Its owner minute ending takes its ring away.
    callbacks.listen(groundItem, "owner", () => redraw(x, y), false);
  });
  callbacks.onRemove("groundItems", ({ x, y }, id) => {
    seen.delete(id);
    redraw(x, y);
  });

  const tileUnder = (raycaster: THREE.Raycaster) => {
    const hitBoxes = [...tiles.values()].map(({ hitBox }) => hitBox);
    const hit = raycaster.intersectObjects(hitBoxes)[0];
    return [...tiles.values()].find(({ hitBox }) => hitBox === hit?.object);
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered: THREE.Group | undefined;
  const onPointerMove = (event: PointerEvent) => {
    pointer.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const tile = tileUnder(raycaster);
    hovered?.scale.setScalar(1);
    hovered = tile?.sack;
    hovered?.scale.setScalar(HOVER_SCALE);
    label.hidden = !tile;
    if (!tile) return;
    label.textContent = groundItemsLabel(tile.items, me());
    label.style.left = `${event.clientX}px`;
    label.style.top = `${event.clientY - 14}px`;
  };
  renderer.domElement.addEventListener("pointermove", onPointerMove);

  room.onLeave(() => {
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    for (const { sack, hitBox } of tiles.values()) scene.remove(sack, hitBox);
    tiles.clear();
    label.hidden = true;
  });

  return (raycaster: THREE.Raycaster) => {
    const tile = tileUnder(raycaster);
    return tile && { ids: tile.ids, x: tile.x, y: tile.y };
  };
}
