import type { StrongboxKind, TileKind } from "@runic/shared";
import * as THREE from "three";
import { propClicks } from "./propClicks.ts";
import { groundTop } from "./regionMeshes.ts";
import { scene } from "./scene.ts";

// The box's size, in tiles: its walls hold no lid, so an open one shows it bare inside.
const WIDTH = 0.62;
const DEPTH = 0.42;
const HEIGHT = 0.32;
const WALL = 0.05;
const LID = 0.07;
const STRAP = 0.012;
// How far an open lid falls back on its hinge, in radians.
const OPEN_LID = 1.9;
// Turned off the grid, like the stalls, so it reads as left there rather than built in.
const STRONGBOX_YAW = -0.35;

/** Each strongbox's wood and its iron or gilt fittings: weathered for the Boneyard, ruin-dark for Runestone Hollow. */
const LOOKS: Record<StrongboxKind, { wood: number; fittings: number }> = {
  boneyard: { wood: 0x5b3b22, fittings: 0x3a3a3e },
  hollow: { wood: 0x3c3448, fittings: 0xb08d3c },
};

function block(
  material: THREE.Material,
  [width, height, depth]: [number, number, number],
  [x, y, z]: [number, number, number],
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** The lid, hinged along the back edge, with a band across it and the lock's hasp at the front. */
function lid(wood: THREE.Material, fittings: THREE.Material) {
  const lid = new THREE.Group().add(
    block(wood, [WIDTH, LID, DEPTH], [0, LID / 2, DEPTH / 2]),
    block(fittings, [0.06, LID + 0.01, DEPTH + 0.01], [0, LID / 2, DEPTH / 2]),
    block(fittings, [0.08, 0.1, 0.02], [0, -0.02, DEPTH + 0.005]),
  );
  const hinge = new THREE.Group().add(lid);
  hinge.position.set(0, HEIGHT, -DEPTH / 2);
  return hinge;
}

/**
 * One strongbox: four walls and a floor in its wood with two iron bands outside, and a lid shown either
 * shut or fallen open. `closed` is what an empty one hides, the shut lid, which shows the open one
 * in its place.
 */
function strongbox(kind: StrongboxKind) {
  const { wood: woodColour, fittings: fittingsColour } = LOOKS[kind];
  const wood = new THREE.MeshStandardMaterial({
    color: woodColour,
    roughness: 0.9,
  });
  const fittings = new THREE.MeshStandardMaterial({
    color: fittingsColour,
    roughness: 0.4,
    metalness: 0.7,
  });
  const halfW = WIDTH / 2;
  const halfD = DEPTH / 2;
  const body = new THREE.Group().add(
    block(wood, [WIDTH, WALL, DEPTH], [0, WALL / 2, 0]),
    block(wood, [WIDTH, HEIGHT, WALL], [0, HEIGHT / 2, halfD - WALL / 2]),
    block(wood, [WIDTH, HEIGHT, WALL], [0, HEIGHT / 2, -halfD + WALL / 2]),
    block(wood, [WALL, HEIGHT, DEPTH], [halfW - WALL / 2, HEIGHT / 2, 0]),
    block(wood, [WALL, HEIGHT, DEPTH], [-halfW + WALL / 2, HEIGHT / 2, 0]),
    // Two iron bands, each a strap on the front and back faces, so an open box stays bare inside.
    ...[-1, 1].flatMap((side) =>
      [-1, 1].map((face) =>
        block(
          fittings,
          [0.06, HEIGHT, STRAP],
          [side * halfW * 0.55, HEIGHT / 2, face * (halfD + STRAP / 2)],
        ),
      ),
    ),
  );
  const shut = lid(wood, fittings);
  const open = lid(wood, fittings);
  open.rotation.x = -OPEN_LID;
  open.visible = false;
  const closed = {
    get visible() {
      return shut.visible;
    },
    set visible(full: boolean) {
      shut.visible = full;
      open.visible = !full;
    },
  };
  return { group: new THREE.Group().add(body, shut, open), closed };
}

/**
 * The strongboxes out where the danger is (#253), each clickable on its model and its tile. Nothing about
 * them depends on the room, so they stay across rejoins. Returns what finds the strongbox under a
 * click's ray, and each one's closed look by kind, which an emptied one hides.
 */
export function addStrongboxes(tiles: TileKind[][]) {
  const closedLooks = new Map<StrongboxKind, { visible: boolean }>();
  const clicks = propClicks<{
    strongbox: StrongboxKind;
    x: number;
    y: number;
  }>();
  tiles.forEach((row, y) =>
    row.forEach(({ strongbox: kind, ground }, x) => {
      if (!kind) return;
      const { group, closed } = strongbox(kind);
      group.position.set(x, groundTop(ground), y);
      group.rotation.y = STRONGBOX_YAW;
      scene.add(group);
      closedLooks.set(kind, closed);
      clicks.add({ strongbox: kind, x, y }, [{ x, y }], group);
    }),
  );
  const strongboxUnder = (raycaster: THREE.Raycaster) =>
    clicks.under(raycaster)?.target;
  return { strongboxUnder, closedLooks };
}
