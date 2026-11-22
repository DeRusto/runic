import type { StallKind, TileKind } from "@runic/shared";
import * as THREE from "three";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { groundTop, loadPart, loadStation } from "./regionMeshes.ts";
import { scene } from "./scene.ts";
import type { StationPart } from "./stationLooks.ts";

// Kenney's green stall's counter, in tiles up from the ground.
const COUNTER = 0.366;
// Turned off the grid, so each reads as set down rather than built in, facing the road to the south.
const STALL_YAW = 0.45;

/** The Food Kit wares on the food stall's counter (#252), which was the village's market stall. */
const FOOD_WARES: StationPart[] = [
  { file: "cheese.glb", width: 0.2, at: [-0.24, 0.12], y: COUNTER },
  { file: "bread.glb", width: 0.22, at: [0.02, 0.18], y: COUNTER, yaw: 0.6 },
  { file: "pumpkin.glb", width: 0.22, at: [0.25, 0.1], y: COUNTER },
  { file: "apple.glb", width: 0.08, at: [-0.05, -0.05], y: COUNTER },
  { file: "apple.glb", width: 0.08, at: [0.04, -0.08], y: COUNTER },
  { file: "pear.glb", width: 0.08, at: [-0.12, -0.12], y: COUNTER },
  { file: "grapes.glb", width: 0.14, at: [0.2, -0.15], y: COUNTER, yaw: -0.4 },
  {
    file: "carrot.glb",
    width: 0.2,
    at: [-0.27, -0.15],
    y: COUNTER,
    yaw: 0.3,
    lay: true,
  },
];

/** A fish laid on the counter, made from shapes: no kit we ship has one. Head to +x. */
function fish(colour: number, length: number) {
  const material = new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.35,
    metalness: 0.3,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), material);
  body.scale.set(length, length * 0.22, length * 0.32);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 3), material);
  tail.scale.set(length * 0.28, length * 0.3, length * 0.06);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -length * 0.6;
  const group = new THREE.Group().add(body, tail);
  group.traverse((o) => (o.castShadow = o instanceof THREE.Mesh));
  return group;
}

/** A cut gem on the counter, made from shapes like the fish. */
function gem(colour: number, size: number) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(size / 2),
    new THREE.MeshStandardMaterial({
      color: colour,
      emissive: colour,
      emissiveIntensity: 0.25,
      roughness: 0.15,
      metalness: 0.2,
      flatShading: true,
    }),
  );
  mesh.scale.y = 1.3;
  mesh.castShadow = true;
  return mesh;
}

/** Each shape-made ware stood on the counter at (x, z) from the stall's middle, turned by `yaw`. */
function onCounter(
  wares: [THREE.Object3D, number, number, number?][],
): THREE.Group {
  const group = new THREE.Group();
  for (const [ware, x, z, yaw = 0] of wares) {
    const { min } = new THREE.Box3().setFromObject(ware);
    ware.position.set(x, COUNTER - min.y, z);
    ware.rotation.y = yaw;
    group.add(ware);
  }
  return group;
}

/** What lies on each stall's counter: the part a theft takes away for the thief alone. */
const WARES: Record<StallKind, () => Promise<THREE.Object3D>> = {
  food: () => loadStation({ parts: FOOD_WARES }),
  // Perch, trout and a pike, by the colours their spots show.
  fish: async () =>
    onCounter([
      [fish(0x9fb7c4, 0.32), -0.18, 0.14, 0.3],
      [fish(0x8aa07a, 0.34), 0.08, 0.16, -0.2],
      [fish(0x6f8a6a, 0.42), 0.12, -0.1, 0.15],
      [fish(0x9fb7c4, 0.3), -0.2, -0.12, -0.4],
    ]),
  // Ashstone, cinderglass and heartflame, from Emberite veins.
  gem: async () =>
    onCounter([
      [gem(0x8a8f98, 0.15), -0.24, 0.1],
      [gem(0x8a8f98, 0.13), -0.1, -0.12],
      [gem(0xe8862a, 0.16), 0.02, 0.12],
      [gem(0xe8862a, 0.13), 0.14, -0.1],
      [gem(0xd8263a, 0.18), 0.25, 0.08],
    ]),
};

/**
 * Marta's stalls outside the general store (#252): Kenney's green stall with each one's wares on
 * its counter, and a hit box for clicks. Nothing about them depends on the room, so they stay
 * across rejoins. Returns what finds the stall under a click's ray, and each stall's wares by kind.
 */
export async function addStalls(tiles: TileKind[][]) {
  const standing = tiles.flatMap((row, y) =>
    row.flatMap(({ stall, ground }, x) =>
      stall ? [{ stall, ground, x, y }] : [],
    ),
  );
  const body = await loadPart({ file: "stall-green.glb", width: 1 });
  const wares = new Map<StallKind, THREE.Object3D>();
  const hitBoxes = new Map<
    THREE.Object3D,
    { stall: StallKind; x: number; y: number }
  >();
  for (const { stall, ground, x, y } of standing) {
    const ware = await WARES[stall]();
    const group = new THREE.Group().add(body.clone(), ware);
    group.position.set(x, groundTop(ground), y);
    group.rotation.y = STALL_YAW;
    scene.add(group);
    wares.set(stall, ware);
    const hitBox = newHitBox();
    hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
    hitBoxes.set(hitBox, { stall, x, y });
  }
  const stallUnder = (raycaster: THREE.Raycaster) => {
    const hit = raycaster.intersectObjects([...hitBoxes.keys()])[0];
    return hit && hitBoxes.get(hit.object);
  };
  return { stallUnder, wares };
}
