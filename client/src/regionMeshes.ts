import {
  siteId,
  tileHash,
  type BushKind,
  type GroundKind,
  type PropKind,
  type StationKind,
  type VeinTier,
  type TileKind,
} from "@runic/shared";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HOUSE_MODELS, houseParts } from "./houseParts.ts";

const SLAB_HEIGHT = 0.2;
const GROUND: Record<GroundKind, { color: number; top: number }> = {
  grass: { color: 0x5d9e3c, top: 0 },
  thicket: { color: 0x3f7a35, top: -0.02 },
  path: { color: 0xa77b4f, top: -0.05 },
  ashen: { color: 0x6e6862, top: -0.01 },
};
const BUSH_WIDTH = 0.9;
const BUSH_TINT = { berryBush: 0xffb0b0, herbBush: 0xb8f0ff };
// Not gear's tints, which leave veins looking like plain or dark rock. They multiply the ore's near-white vein.
const VEIN_TINT: Record<VeinTier, THREE.Color> = {
  copper: new THREE.Color(0xff8a3c),
  iron: new THREE.Color(0x4f8fd8),
  emberite: new THREE.Color(0xd42a1a),
};
export const ORE_SCALE = 0.45;
const STATIONS: Record<StationKind, { file: string; width: number }> = {
  // Kenney's building-smelter didn't read as a furnace at a tile's scale, so this is spec §15's first fallback.
  // House scale, on its 2×2 footprint.
  furnace: { file: "building_blacksmith_red.gltf", width: 2 },
  anvil: { file: "anvil.gltf", width: 0.8 },
};
const RUN_OUT_SCALE = new THREE.Vector3(0.6, 0.6, 0.6);
// A tint can only multiply, so "grey" evens out the green texture's channels; above 1 is fine, it's a float.
const RUN_OUT_TINT = new THREE.Color().setRGB(1.3, 0.65, 3.4);
// The ore's rock colour, so a run-out vein reads as plain rock.
const VEIN_RUN_OUT_TINT = new THREE.Color(0x6b6665);

const white = new THREE.Color(0xffffff);

const BUSH_MODELS: Record<BushKind, string> = {
  berryBush: "Bush_2_B",
  herbBush: "Bush_4_B",
};
const KAYKIT_PROPS = {
  tree: { scale: 0.45, models: ["Tree_1_A", "Tree_2_A", "Tree_4_A"] },
  rock: { scale: 0.65, models: ["Rock_1_E", "Rock_2_C"] },
  tuft: { scale: 0.5, models: ["Grass_1_B", "Grass_2_B"] },
};
// One Modular Village unit is a tile; a house's door already fits a character, so only the crate is cut down.
const VILLAGE_PROPS = {
  well: { scale: 1, models: ["Prop_Well_1"] },
  lamp: { scale: 1, models: ["Prop_Lamp_Street"] },
  barrel: { scale: 1, models: ["Prop_Barrel_1"] },
  crate: { scale: 0.6, models: ["Prop_Crate_1"] },
};
const PROP_MODELS: Record<PropKind, { scale: number; models: string[] }> = {
  ...KAYKIT_PROPS,
  ...VILLAGE_PROPS,
};

async function loadModel(name: string) {
  const { scene } = await new GLTFLoader().loadAsync(
    `/models/${name}_Color1.gltf`,
  );
  return scene.children[0] as THREE.Mesh;
}

/** A loaded OBJ as one geometry with its materials' colours baked into its vertices, so the model takes one draw call. */
function bakeColours(model: THREE.Group) {
  const parts = (model.children as THREE.Mesh[]).map((mesh) => {
    const materials = [mesh.material].flat() as THREE.MeshPhongMaterial[];
    const geometry = mesh.geometry.deleteAttribute("uv");
    const { count } = geometry.getAttribute("position");
    const colours = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    const groups = geometry.groups.length
      ? geometry.groups
      : [{ start: 0, count, materialIndex: 0 }];
    for (const { start, count, materialIndex } of groups) {
      const { r, g, b } = materials[materialIndex!]!.color;
      for (let i = start; i < start + count; i++) colours.setXYZ(i, r, g, b);
    }
    return geometry.setAttribute("color", colours);
  });
  return mergeGeometries(parts);
}

/** Modular Village's models by name. */
async function loadVillageModels(names: string[]) {
  const colours = await new MTLLoader().loadAsync(
    "/models/Materials_Modular_Village.mtl",
  );
  colours.preload();
  const loader = new OBJLoader().setMaterials(colours);
  return new Map(
    await Promise.all(
      names.map(
        async (name) =>
          [
            name,
            bakeColours(await loader.loadAsync(`/models/${name}.obj`)),
          ] as const,
      ),
    ),
  );
}

/** A station's model, scaled to its width. */
async function loadStation({ file, width }: (typeof STATIONS)[StationKind]) {
  const { scene } = await new GLTFLoader().loadAsync(`/models/${file}`);
  scene.traverse((o) => (o.castShadow = o instanceof THREE.Mesh));
  const { max, min } = new THREE.Box3().setFromObject(scene);
  scene.scale.setScalar(width / Math.max(max.x - min.x, max.z - min.z));
  return scene;
}

/** The ore model's two meshes, apart so that only the vein takes a tier's tint. */
export function oreParts(ore: THREE.Object3D) {
  return {
    rock: ore.getObjectByName("rock") as THREE.Mesh,
    vein: ore.getObjectByName("ore_vein") as THREE.Mesh,
  };
}

/** A slab per tile and the props, houses, veins, stations and bushes on them, all fixed but for bushes and veins: returns how to show one run out or not. */
export async function addRegionMeshes(scene: THREE.Scene, tiles: TileKind[][]) {
  const [
    [berryBush, herbBush, ...propMeshes],
    furnace,
    anvil,
    oreModel,
    village,
  ] = await Promise.all([
    Promise.all(
      [
        ...Object.values(BUSH_MODELS),
        ...Object.values(KAYKIT_PROPS).flatMap(({ models }) => models),
      ].map(loadModel),
    ),
    loadStation(STATIONS.furnace),
    loadStation(STATIONS.anvil),
    new GLTFLoader().loadAsync("/models/ore.glb"),
    loadVillageModels([
      ...Object.values(HOUSE_MODELS),
      ...Object.values(VILLAGE_PROPS).flatMap(({ models }) => models),
    ]),
  ]);
  const stations = { furnace, anvil };
  const footprints = {
    furnace: [] as THREE.Vector3[],
    anvil: [] as THREE.Vector3[],
  };
  const ore = oreParts(oreModel.scene);
  const bushMeshes = { berryBush: berryBush!, herbBush: herbBush! };
  const propVariants = {} as Record<PropKind, THREE.BufferGeometry[]>;
  for (const [kind, { models }] of Object.entries(KAYKIT_PROPS)) {
    propVariants[kind as PropKind] = propMeshes
      .splice(0, models.length)
      .map((mesh) => mesh.geometry);
  }
  for (const [kind, { models }] of Object.entries(VILLAGE_PROPS)) {
    propVariants[kind as PropKind] = models.map((name) => village.get(name)!);
  }
  // The whole pack paints from one texture, so one material covers every model.
  const material = new THREE.MeshLambertMaterial({
    map: (berryBush!.material as THREE.MeshStandardMaterial).map,
  });
  // The ore has no texture. Lambert can't shine, and metal needs an environment map to reflect, so the vein is Phong.
  const ownMaterials = new Map<THREE.BufferGeometry, THREE.Material>([
    [
      ore.rock.geometry,
      new THREE.MeshLambertMaterial({
        color: (ore.rock.material as THREE.MeshStandardMaterial).color,
      }),
    ],
    [
      ore.vein.geometry,
      new THREE.MeshPhongMaterial({
        color: (ore.vein.material as THREE.MeshStandardMaterial).color,
        specular: 0x666666,
        shininess: 60,
      }),
    ],
  ]);

  const villageMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const geometry of village.values()) {
    ownMaterials.set(geometry, villageMaterial);
  }

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
  /** Returns the placement's index in its geometry's InstancedMesh. */
  const place = (
    geometry: THREE.BufferGeometry,
    matrix: THREE.Matrix4,
    color = white,
  ) => {
    if (!placements.has(geometry)) placements.set(geometry, []);
    return placements.get(geometry)!.push({ matrix, color }) - 1;
  };

  /** Where each part of a bush or vein is drawn, by its tile's id, and the tint it takes when run out. */
  const runOutSlots = new Map<
    string,
    { geometry: THREE.BufferGeometry; slot: number; tint: THREE.Color }[]
  >();

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

      const { bush, prop, vein, station, house } = tile;
      if (station) footprints[station].push(new THREE.Vector3(x, top, y));
      if (house) {
        for (const { part, angle, height } of houseParts(tiles, x, y)) {
          place(
            village.get(HOUSE_MODELS[part])!,
            new THREE.Matrix4().compose(
              new THREE.Vector3(x, top + height, y),
              new THREE.Quaternion().setFromAxisAngle(up, angle),
              new THREE.Vector3(1, 1, 1),
            ),
          );
        }
      }
      if (!bush && !prop && !vein) return;
      const rotation = new THREE.Quaternion().setFromAxisAngle(
        up,
        (((hash >>> 16) & 255) / 256) * Math.PI * 2,
      );
      const at = new THREE.Vector3(x, top, y);
      if (bush) {
        const { geometry } = bushMeshes[bush];
        geometry.computeBoundingBox();
        const scale = new THREE.Vector3().setScalar(
          BUSH_WIDTH / geometry.boundingBox!.getSize(new THREE.Vector3()).x,
        );
        const slot = place(
          geometry,
          new THREE.Matrix4().compose(at, rotation, scale),
          new THREE.Color(BUSH_TINT[bush]),
        );
        runOutSlots.set(siteId({ x, y }), [
          { geometry, slot, tint: RUN_OUT_TINT },
        ]);
      } else if (vein) {
        const placed = new THREE.Matrix4().compose(
          at,
          rotation,
          new THREE.Vector3().setScalar(ORE_SCALE),
        );
        runOutSlots.set(siteId({ x, y }), [
          {
            geometry: ore.rock.geometry,
            slot: place(ore.rock.geometry, placed),
            tint: white,
          },
          {
            geometry: ore.vein.geometry,
            slot: place(ore.vein.geometry, placed, VEIN_TINT[vein]),
            tint: VEIN_RUN_OUT_TINT,
          },
        ]);
      } else {
        const options = propVariants[prop!];
        const geometry = options[((hash >>> 8) & 255) % options.length]!;
        const scale = new THREE.Vector3().setScalar(PROP_MODELS[prop!].scale);
        place(geometry, new THREE.Matrix4().compose(at, rotation, scale));
      }
    }),
  );
  scene.add(slabs);
  // One model per station, at the middle of the tiles it covers.
  for (const [kind, tilesUnder] of Object.entries(footprints)) {
    if (!tilesUnder.length) continue;
    const model = stations[kind as StationKind];
    new THREE.Box3().setFromPoints(tilesUnder).getCenter(model.position);
    scene.add(model);
  }

  const meshes = new Map<THREE.BufferGeometry, THREE.InstancedMesh>();
  for (const [geometry, list] of placements) {
    const mesh = new THREE.InstancedMesh(
      geometry,
      ownMaterials.get(geometry) ?? material,
      list.length,
    );
    list.forEach((item, i) => {
      mesh.setMatrixAt(i, item.matrix);
      mesh.setColorAt(i, item.color);
    });
    mesh.castShadow = true;
    scene.add(mesh);
    meshes.set(geometry, mesh);
  }

  return (id: string, runOut: boolean) => {
    for (const { geometry, slot, tint } of runOutSlots.get(id)!) {
      const instances = meshes.get(geometry)!;
      const { matrix, color } = placements.get(geometry)![slot]!;
      instances.setMatrixAt(
        slot,
        runOut ? matrix.clone().scale(RUN_OUT_SCALE) : matrix,
      );
      instances.setColorAt(slot, runOut ? tint : color);
      instances.instanceMatrix.needsUpdate = true;
      instances.instanceColor!.needsUpdate = true;
    }
  };
}
