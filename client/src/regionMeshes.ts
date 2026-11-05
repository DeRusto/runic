import { tileHash, type GroundKind, type TileKind } from "@runic/shared";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const SLAB_HEIGHT = 0.2;
const GROUND: Record<GroundKind, { color: number; top: number }> = {
  grass: { color: 0x5d9e3c, top: 0 },
  thicket: { color: 0x3f7a35, top: -0.02 },
  path: { color: 0xa77b4f, top: -0.05 },
};
const BUSH_WIDTH = 0.9;
const BUSH_TINT = { berryBush: 0xffb0b0, herbBush: 0xb8f0ff };

const white = new THREE.Color(0xffffff);

/** One coloured piece of a prop's model, moved into place and ready to merge. */
function part(
  geometry: THREE.BufferGeometry,
  color: number,
  x: number,
  y: number,
  z: number,
) {
  const piece = geometry.index ? geometry.toNonIndexed() : geometry;
  piece.translate(x, y, z);
  const { r, g, b } = new THREE.Color(color);
  const colors = Array.from(
    { length: piece.attributes.position!.count },
    () => [r, g, b],
  ).flat();
  piece.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return piece;
}

const TRUNK = 0x6b4a2b;
const PINE = 0x24603a;
const LEAF = 0x3c8a3f;
const ROCK = 0x8a8f94;
const TUFT = 0x7cc04f;

// shortcut: trees, rocks and tufts are built here because only the bush of KayKit Forest Nature is in the repo, swap in the pack's models when it is committed.
function propVariants(): Record<
  "tree" | "rock" | "tuft",
  THREE.BufferGeometry[]
> {
  const merged = (...parts: THREE.BufferGeometry[]) => mergeGeometries(parts)!;
  const blade = (x: number, z: number, height: number) =>
    part(new THREE.ConeGeometry(0.05, height, 4), TUFT, x, height / 2, z);
  return {
    tree: [
      merged(
        part(new THREE.CylinderGeometry(0.08, 0.13, 0.6, 5), TRUNK, 0, 0.3, 0),
        part(new THREE.ConeGeometry(0.48, 1.3, 6), PINE, 0, 1.2, 0),
      ),
      merged(
        part(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 5), TRUNK, 0, 0.25, 0),
        part(new THREE.ConeGeometry(0.5, 0.8, 6), PINE, 0, 0.85, 0),
        part(new THREE.ConeGeometry(0.36, 0.7, 6), PINE, 0, 1.4, 0),
      ),
      merged(
        part(new THREE.CylinderGeometry(0.08, 0.13, 0.7, 5), TRUNK, 0, 0.35, 0),
        part(new THREE.IcosahedronGeometry(0.5, 0), LEAF, 0, 1.05, 0),
      ),
    ],
    rock: [
      merged(part(new THREE.DodecahedronGeometry(0.36, 0), ROCK, 0, 0.2, 0)),
      merged(
        part(new THREE.IcosahedronGeometry(0.3, 0), ROCK, -0.08, 0.18, 0),
        part(new THREE.IcosahedronGeometry(0.18, 0), ROCK, 0.22, 0.1, 0.12),
      ),
    ],
    tuft: [
      merged(blade(0, 0, 0.3), blade(0.14, 0.06, 0.2), blade(-0.1, 0.12, 0.24)),
      merged(
        blade(-0.15, -0.1, 0.26),
        blade(0.08, -0.04, 0.32),
        blade(0.16, 0.16, 0.18),
      ),
    ],
  };
}

/** Everything that doesn't change during play: a slab per tile, and the props on them. */
export async function addRegionMeshes(scene: THREE.Scene, tiles: TileKind[][]) {
  const bush = await new GLTFLoader().loadAsync("/models/Bush_1_A_Color1.gltf");
  const bushMesh = bush.scene.children[0] as THREE.Mesh;
  const bushMap = (bushMesh.material as THREE.MeshStandardMaterial).map;
  bushMesh.geometry.computeBoundingBox();
  const bushScale =
    BUSH_WIDTH / bushMesh.geometry.boundingBox!.getSize(new THREE.Vector3()).x;

  const slabs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, SLAB_HEIGHT, 1),
    new THREE.MeshLambertMaterial({ flatShading: true }),
    tiles.length * tiles[0]!.length,
  );
  slabs.receiveShadow = true;

  const placements = new Map<
    THREE.BufferGeometry,
    { matrix: THREE.Matrix4; color: THREE.Color }[]
  >();
  const place = (
    geometry: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    color = white,
  ) => {
    if (!placements.has(geometry)) placements.set(geometry, []);
    placements.get(geometry)!.push({ matrix, color });
  };

  const variants = propVariants();
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);

  tiles.forEach((row, y) =>
    row.forEach((tile, x) => {
      const hash = tileHash(x, y);
      const { color: groundColor, top } = GROUND[tile.ground];

      matrix.makeTranslation(x, top - SLAB_HEIGHT / 2, y);
      slabs.setMatrixAt(y * row.length + x, matrix);
      const shade = ((hash & 255) / 255 - 0.5) * 0.08;
      slabs.setColorAt(
        y * row.length + x,
        color.set(groundColor).offsetHSL(0, 0, shade),
      );

      if (!tile.prop) return;
      const rotation = new THREE.Quaternion().setFromAxisAngle(
        up,
        (((hash >>> 16) & 255) / 256) * Math.PI * 2,
      );
      const at = new THREE.Vector3(x, top, y);
      const { prop } = tile;
      if (prop === "berryBush" || prop === "herbBush") {
        const scale = new THREE.Vector3().setScalar(bushScale);
        place(
          bushMesh.geometry,
          new THREE.Matrix4().compose(at, rotation, scale),
          new THREE.Color(BUSH_TINT[prop]),
        );
      } else {
        const options = variants[prop];
        const geometry = options[((hash >>> 8) & 255) % options.length]!;
        place(
          geometry,
          new THREE.Matrix4().compose(at, rotation, new THREE.Vector3(1, 1, 1)),
        );
      }
    }),
  );
  scene.add(slabs);

  const propMaterial = new THREE.MeshLambertMaterial({
    flatShading: true,
    vertexColors: true,
  });
  const bushMaterial = new THREE.MeshLambertMaterial({
    flatShading: true,
    map: bushMap,
  });
  for (const [geometry, list] of placements) {
    const material =
      geometry === bushMesh.geometry ? bushMaterial : propMaterial;
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((item, i) => {
      mesh.setMatrixAt(i, item.matrix);
      mesh.setColorAt(i, item.color);
    });
    mesh.castShadow = true;
    scene.add(mesh);
  }
}
