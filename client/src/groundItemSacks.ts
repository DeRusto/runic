import { Callbacks } from "@colyseus/sdk";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { groundItemsLabel, type SeenGroundItem } from "./groundItems.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { colouredNames, iconUrl } from "./itemIcons.ts";
import type { WorldConnection } from "./players.ts";
import { camera, renderer, scene } from "./scene.ts";
import { hideTip, showTip } from "./tooltip.ts";

const HOVER_SCALE = 1.15;
const SACK_HIT_HEIGHT = 0.6;

const BAG_HEIGHT = 0.6;
const ICON_SIZE = 0.45;

/** The owner's loot bag, loaded at the first pile and fitted to stand BAG_HEIGHT tall on the ground. */
let bag: Promise<THREE.Object3D> | undefined;
const loadBag = () =>
  (bag ??= new GLTFLoader()
    .loadAsync("/models/LootBag.glb")
    .then(({ scene }) => {
      const box = new THREE.Box3().setFromObject(scene);
      const scale = BAG_HEIGHT / box.getSize(new THREE.Vector3()).y;
      scene.scale.setScalar(scale);
      scene.position.y = -box.min.y * scale;
      scene.traverse((part) => (part.castShadow = true));
      return scene;
    }));
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

/** What marks a tile's ground items: the item's own icon for one, the loot bag for a pile. A gold ring marks `mine`. */
function sackFor(items: SeenGroundItem[], mine: boolean) {
  const group = new THREE.Group();
  if (items.length === 1) {
    const icon = new THREE.Sprite(iconOf(items[0]!.item));
    icon.scale.setScalar(ICON_SIZE);
    icon.position.y = ICON_SIZE / 2;
    group.add(icon);
  } else void loadBag().then((model) => group.add(model.clone()));
  if (mine) {
    const ring = new THREE.Mesh(ringShape, ringMaterial);
    ring.position.y = 0.015;
    group.add(ring);
  }
  return group;
}

/**
 * Draws an icon or a loot bag on each tile with ground items this player can see (the server sends no
 * others), and labels the tile under the pointer. Returns what finds the tile of ground items
 * under a click's ray, with their ids.
 */
export function showGroundItems(room: WorldConnection) {
  const callbacks = Callbacks.get(room);
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
  let hovered: THREE.Group | undefined;
  let lastPointer: PointerEvent | undefined;

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
    // Only as tall as the sack, so it doesn't cover a vein, bush or station behind it.
    hitBox.scale.y = SACK_HIT_HEIGHT / HIT_BOX_HEIGHT;
    hitBox.position.set(x, SACK_HIT_HEIGHT / 2, y);
    scene.add(sack);
    tiles.set(key, { sack, hitBox, items, ids, x, y });
  };
  /** Redraws a tile, then the hover, which may have been on what just changed. */
  const update = (x: number, y: number) => {
    redraw(x, y);
    if (lastPointer) onPointerMove(lastPointer);
  };

  callbacks.onAdd("groundItems", (groundItem, id) => {
    const { x, y } = groundItem;
    seen.set(id, groundItem);
    update(x, y);
    // Its owner minute ending takes its ring away.
    callbacks.listen(groundItem, "owner", () => update(x, y), false);
  });
  callbacks.onRemove("groundItems", ({ x, y }, id) => {
    seen.delete(id);
    update(x, y);
  });

  const tileUnder = (raycaster: THREE.Raycaster) => {
    const hitBoxes = [...tiles.values()].map(({ hitBox }) => hitBox);
    const hit = raycaster.intersectObjects(hitBoxes)[0];
    return [...tiles.values()].find(({ hitBox }) => hitBox === hit?.object);
  };

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const onPointerMove = (event: PointerEvent) => {
    lastPointer = event;
    pointer.set(
      (event.clientX / innerWidth) * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const tile = tileUnder(raycaster);
    hovered?.scale.setScalar(1);
    hovered = tile?.sack;
    hovered?.scale.setScalar(HOVER_SCALE);
    if (!tile) return hideTip();
    showTip(
      colouredNames(
        groundItemsLabel(tile.items, me()),
        tile.items.map(({ item }) => item),
      ),
      event,
    );
  };
  // Off the canvas the pointer is on the UI, whose own tips share the one tooltip.
  const onPointerLeave = () => {
    lastPointer = undefined;
    hovered?.scale.setScalar(1);
    hovered = undefined;
    hideTip();
  };
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("pointerdown", hideTip);

  room.onLeave(() => {
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
    renderer.domElement.removeEventListener("pointerdown", hideTip);
    for (const { sack, hitBox } of tiles.values()) scene.remove(sack, hitBox);
    tiles.clear();
    hideTip();
  });

  return (raycaster: THREE.Raycaster) => {
    const tile = tileUnder(raycaster);
    return tile && { ids: tile.ids, x: tile.x, y: tile.y };
  };
}
