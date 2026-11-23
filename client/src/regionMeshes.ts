import {
  GATHERING,
  GATHERING_SKILLS,
  siteId,
  tileHash,
  type BushKind,
  type GatheringSkill,
  type GroundKind,
  type PropKind,
  STATIONS,
  type FixedStation,
  type TreeKind,
  type VeinKind,
  type TileKind,
} from "@runic/shared";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BUILDING_LOOKS, HOUSE_MODELS, houseParts } from "./houseParts.ts";
import { flameLook } from "./flame.ts";
import { instancesModel } from "./instancesModel.ts";
import { STATION_LOOKS, type StationPart } from "./stationLooks.ts";

const STATION_KINDS = Object.keys(STATIONS) as FixedStation[];

const SLAB_HEIGHT = 0.2;
/** How high a ground's top stands, in tiles, for what stands on it. */
export const groundTop = (ground: GroundKind) => GROUND[ground].top;
const GROUND: Record<GroundKind, { color: number; top: number }> = {
  grass: { color: 0x5d9e3c, top: 0 },
  thicket: { color: 0x3f7a35, top: -0.02 },
  path: { color: 0xa77b4f, top: -0.05 },
  ashen: { color: 0x6e6862, top: -0.01 },
  water: { color: 0x3b78b0, top: -0.12 },
  moss: { color: 0x4f5e4a, top: -0.01 },
  // Under the cobbles, the road's dirt, which their own dirt is painted in too.
  cobble: { color: 0xa77b4f, top: -0.05 },
};
/** The village kit's cobble floor: 2×2 tiles, its middle half a tile off its origin each way, so halved and recentred. */
const COBBLES = "Cobblestone_Floor_1";
/** The kit's cobbles thinning out to dirt, four ways: dense on their -x half, sparse on their +x half. */
const COBBLE_EDGES = [1, 2, 3, 4].map(
  (n) => `Cobblestone_Dirt_Transition_${n}`,
);
// Just above the slab's top, which the floor's base would otherwise share and flicker against.
const COBBLE_LIFT = 0.004;
// Turns a +x-facing piece to face each way, as a house's parts are turned.
const FACING = [
  { dx: 1, dy: 0, angle: 0 },
  { dx: 0, dy: -1, angle: Math.PI / 2 },
  { dx: -1, dy: 0, angle: Math.PI },
  { dx: 0, dy: 1, angle: -Math.PI / 2 },
];
const cobbleFit = new THREE.Matrix4()
  .makeScale(0.5, 1, 0.5)
  .multiply(new THREE.Matrix4().makeTranslation(0.5, 0, -0.5));
const BUSH_WIDTH = 0.9;
const BUSH_TINT: Record<BushKind, number> = {
  berryBush: 0xffb0b0,
  dewpetalBush: 0xaad4ff,
  herbBush: 0xb8f0ff,
  nightbloomBush: 0xb490e8,
  emberbloomBush: 0xffa64d,
};
// Not gear's tints, which leave veins looking like plain or dark rock. They multiply the ore's near-white vein.
// The essence rock's vein is a pale violet, apart from every metal's.
const VEIN_TINT: Record<VeinKind, THREE.Color> = {
  copper: new THREE.Color(0xff8a3c),
  iron: new THREE.Color(0x4f8fd8),
  emberite: new THREE.Color(0xd42a1a),
  essence: new THREE.Color(0xc89cff),
};
export const ORE_SCALE = 0.45;
const RUN_OUT_SCALE = new THREE.Vector3(0.6, 0.6, 0.6);
/** A spot with no site on it is drawn at nothing, so it looks like its plain ground. */
const GONE_SCALE = new THREE.Vector3(0, 0, 0);
/** How a site is drawn: full, run out, gone from its spot in a site pool, or just taken off it ("spent"), which shrinks it as run out and then fades it away. */
export type SiteLook = "full" | "runOut" | "gone" | "spent";
/** How long a spent site stays at its run-out look, then how long it takes to fade, in ms. */
const SPENT_HOLD_MS = 1200;
const SPENT_FADE_MS = 800;
// A tint can only multiply, so "grey" evens out the green texture's channels; above 1 is fine, it's a float.
const RUN_OUT_TINT = new THREE.Color().setRGB(1.3, 0.65, 3.4);
// The ore's rock colour, so a run-out vein reads as plain rock.
const VEIN_RUN_OUT_TINT = new THREE.Color(0x6b6665);

const white = new THREE.Color(0xffffff);

type SiteField = (typeof GATHERING)[GatheringSkill]["site"];
const SITE_FIELDS = GATHERING_SKILLS.map((skill) => GATHERING[skill].site);

const BUSH_MODELS: Record<BushKind, string> = {
  berryBush: "Bush_2_B",
  dewpetalBush: "Bush_4_B",
  herbBush: "Bush_4_B",
  nightbloomBush: "Bush_2_B",
  emberbloomBush: "Bush_2_B",
};
/** Each kind of tree its own model and tint, apart from the tree props' models so a choppable one reads as one. */
const TREE_MODELS: Record<TreeKind, { model: string; tint: number }> = {
  birch: { model: "Tree_3_A", tint: 0xf2ffd8 },
  oak: { model: "Tree_2_B", tint: 0xffffff },
  charwood: { model: "Tree_Bare_1_A", tint: 0x8a4a3a },
};
const TREE_SCALE = 0.5;
/** Kenney's stump, about a third of a tile across, grown to most of one. */
export const STUMP_SCALE = 2.4;
/** An active fishing spot: two pale rings on the water that shimmer. */
function rippleGeometry() {
  const rings = [
    new THREE.RingGeometry(0.12, 0.17, 24),
    new THREE.RingGeometry(0.3, 0.35, 24),
  ];
  // Just above the water, so the slab can't hide it.
  return mergeGeometries(rings)
    .rotateX(-Math.PI / 2)
    .translate(0, 0.01, 0);
}
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
// Kenney's Nature Kit, flat-coloured like the stump, so their colours bake the same way. The gate keeps
// its turn, across the south road, where every other prop takes a random one; it spans its tile and
// is stretched up well past a character's height, two of them making the road's double gate.
const NATURE_PROPS = {
  gate: {
    scale: [1, 4.5, 1] as [number, number, number],
    models: ["fenceGate"],
    fixed: true,
  },
  column: { scale: 1.6, models: ["statueColumn", "statueColumnDamaged"] },
  standingStone: { scale: 1.3, models: ["stoneTallB", "stoneTallE"] },
};
/**
 * The goods outside the general store: textured models drawn whole, as a station's parts are,
 * rather than baked to vertex colours like the props above. Each faces the road, to the south.
 */
const GOODS = {
  appleBarrel: { parts: [{ file: "Barrel_Apples.glb", width: 0.55 }] },
  carrotCrate: { parts: [{ file: "FarmCrate_Carrot.glb", width: 0.75 }] },
  fruitBasket: { parts: [{ file: "display-fruit.glb", width: 0.6 }] },
} satisfies Partial<Record<PropKind, { parts: StationPart[] }>>;
type Goods = keyof typeof GOODS;
const isGoods = (prop: PropKind): prop is Goods => Object.hasOwn(GOODS, prop);

const PROP_MODELS: Record<
  Exclude<PropKind, Goods>,
  {
    scale: number | [number, number, number];
    models: string[];
    fixed?: boolean;
  }
> = {
  ...KAYKIT_PROPS,
  ...VILLAGE_PROPS,
  ...NATURE_PROPS,
};

async function loadModel(name: string) {
  const { scene } = await new GLTFLoader().loadAsync(
    `/models/${name}_Color1.gltf`,
  );
  return scene.children[0] as THREE.Mesh;
}

// The kit's dark roof tiles against its light ones, kept in a building's own roof colour.
const RED_TILES = 0.42 / 0.58;

/**
 * A loaded OBJ as one geometry with its materials' colours baked into its vertices, so the model
 * takes one draw call. `look` gives the red tiles its roof colour and the cream its plaster.
 */
function bakeColours(
  model: THREE.Group,
  look?: (typeof BUILDING_LOOKS)[keyof typeof BUILDING_LOOKS],
  dirt?: number,
) {
  const parts = (model.children as THREE.Mesh[]).map((mesh) => {
    const materials = [mesh.material].flat() as THREE.MeshPhongMaterial[];
    const geometry = mesh.geometry.deleteAttribute("uv");
    const { count } = geometry.getAttribute("position");
    const colours = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    const groups = geometry.groups.length
      ? geometry.groups
      : [{ start: 0, count, materialIndex: 0 }];
    for (const { start, count, materialIndex } of groups) {
      const material = materials[materialIndex!]!;
      const shade = new Map([
        ["Red_Roof", 1],
        ["Dark_Red_Roof", RED_TILES],
      ]).get(material.name);
      const { r, g, b } =
        dirt !== undefined && material.name === "Dirt"
          ? new THREE.Color(dirt)
          : !look
            ? material.color
            : shade
              ? new THREE.Color(look.roof).multiplyScalar(shade)
              : material.name === "Canvas" && look.cloth !== undefined
                ? new THREE.Color(look.cloth)
                : material.name === "Stucco"
                  ? material.color
                      .clone()
                      .multiply(new THREE.Color(look.plaster))
                  : material.color;
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
            bakeColours(
              await loader.loadAsync(`/models/${name.split(":")[0]}.obj`),
              BUILDING_LOOKS[name.split(":")[1] as keyof typeof BUILDING_LOOKS],
              // The cobbles' dirt in the road's, so they thin out into the road without a seam.
              [COBBLES, ...COBBLE_EDGES].includes(name)
                ? GROUND.path.color
                : undefined,
            ),
          ] as const,
      ),
    ),
  );
}

/** A model scaled to its width, laid on its side first if asked, with its base on the ground. */
export async function loadPart({ file, width, lay }: StationPart) {
  const { scene } = await new GLTFLoader().loadAsync(`/models/${file}`);
  scene.traverse((o) => (o.castShadow = o instanceof THREE.Mesh));
  if (lay) scene.rotation.z = Math.PI / 2;
  const { max, min } = new THREE.Box3().setFromObject(scene);
  scene.scale.setScalar(width / Math.max(max.x - min.x, max.z - min.z));
  if (lay) scene.position.y = -new THREE.Box3().setFromObject(scene).min.y;
  return scene;
}

/** A station's look: its parts and flame in one group, centred on the middle of its tiles. */
export async function loadStation({
  parts,
  flame,
}: (typeof STATION_LOOKS)[FixedStation]) {
  const group = new THREE.Group();
  let top = 0;
  for (const [i, model] of (await Promise.all(parts.map(loadPart))).entries()) {
    const { at = [0, 0], y = 0, yaw = 0, onTop } = parts[i]!;
    const holder = new THREE.Group().add(model);
    holder.position.set(at[0], y + (onTop ? top : 0), at[1]);
    holder.rotation.y = yaw;
    group.add(holder);
    if (!onTop) top = new THREE.Box3().setFromObject(holder).max.y;
  }
  if (flame) {
    const fire = flameLook(flame.at[0], flame.at[1]);
    fire.position.set(flame.at[0], flame.y, flame.at[1]);
    fire.scale.setScalar(flame.size);
    group.add(fire);
  }
  return group;
}

/** The ore model's two meshes, apart so that only the vein takes a tier's tint. */
export function oreParts(ore: THREE.Object3D) {
  return {
    rock: ore.getObjectByName("rock") as THREE.Mesh,
    vein: ore.getObjectByName("ore_vein") as THREE.Mesh,
  };
}

/**
 * A slab per tile and the props, houses, sites and stations on them, all fixed but for the sites.
 * Returns how to show a site full, run out or gone (a run-out tree is a stump), and each site's and
 * station's model, for clicks to find.
 */
export async function addRegionMeshes(scene: THREE.Scene, tiles: TileKind[][]) {
  const [
    [
      berryBush,
      dewpetalBush,
      herbBush,
      nightbloomBush,
      emberbloomBush,
      ...propMeshes
    ],
    treeMeshes,
    stationModels,
    oreModel,
    stumpModel,
    natureModels,
    village,
  ] = await Promise.all([
    Promise.all(
      [
        ...Object.values(BUSH_MODELS),
        ...Object.values(KAYKIT_PROPS).flatMap(({ models }) => models),
      ].map(loadModel),
    ),
    Promise.all(
      Object.values(TREE_MODELS).map(({ model }) => loadModel(model)),
    ),
    Promise.all(STATION_KINDS.map((kind) => loadStation(STATION_LOOKS[kind]))),
    new GLTFLoader().loadAsync("/models/ore.glb"),
    new GLTFLoader().loadAsync("/models/stump_round.glb"),
    Promise.all(
      Object.values(NATURE_PROPS)
        .flatMap(({ models }) => models)
        .map((name) => new GLTFLoader().loadAsync(`/models/${name}.glb`)),
    ),
    loadVillageModels([
      ...Object.values(HOUSE_MODELS),
      COBBLES,
      ...COBBLE_EDGES,
      ...Object.values(VILLAGE_PROPS).flatMap(({ models }) => models),
    ]),
  ]);
  const stations = Object.fromEntries(
    STATION_KINDS.map((kind, i) => [kind, stationModels[i]!]),
  ) as Record<FixedStation, THREE.Group>;
  const footprints = Object.fromEntries(
    STATION_KINDS.map((kind) => [kind, [] as THREE.Vector3[]]),
  ) as Record<FixedStation, THREE.Vector3[]>;
  const ore = oreParts(oreModel.scene);
  const trees = Object.fromEntries(
    Object.keys(TREE_MODELS).map((kind, i) => [kind, treeMeshes[i]!.geometry]),
  ) as Record<TreeKind, THREE.BufferGeometry>;
  // Kenney's stump is two coloured parts, baked into one geometry like the village's.
  const stump = bakeColours(
    stumpModel.scene.getObjectByProperty("type", "Mesh")!.parent as THREE.Group,
  );
  const bushMeshes = {
    berryBush: berryBush!,
    dewpetalBush: dewpetalBush!,
    herbBush: herbBush!,
    nightbloomBush: nightbloomBush!,
    emberbloomBush: emberbloomBush!,
  };
  const propVariants = {} as Record<PropKind, THREE.BufferGeometry[]>;
  for (const [kind, { models }] of Object.entries(KAYKIT_PROPS)) {
    propVariants[kind as PropKind] = propMeshes
      .splice(0, models.length)
      .map((mesh) => mesh.geometry);
  }
  for (const [kind, { models }] of Object.entries(VILLAGE_PROPS)) {
    propVariants[kind as PropKind] = models.map((name) => village.get(name)!);
  }
  // Every mesh in the model, each moved by its own node's transform, as one group for bakeColours.
  const natureGeometries = natureModels.map(({ scene }) => {
    scene.updateMatrixWorld();
    const meshes: THREE.Mesh[] = [];
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh)
        meshes.push(
          new THREE.Mesh(
            o.geometry.clone().applyMatrix4(o.matrixWorld),
            o.material,
          ),
        );
    });
    return bakeColours(new THREE.Group().add(...meshes));
  });
  for (const [kind, { models }] of Object.entries(NATURE_PROPS)) {
    propVariants[kind as PropKind] = natureGeometries.splice(0, models.length);
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
  ownMaterials.set(stump, villageMaterial);
  for (const kind of Object.keys(NATURE_PROPS))
    for (const geometry of propVariants[kind as PropKind])
      ownMaterials.set(geometry, villageMaterial);
  const ripple = rippleGeometry();
  const rippleMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  ownMaterials.set(ripple, rippleMaterial);

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

  /** Where each part of a site is drawn, by its tile's id, and the tint it takes when run out. A part with `only` shows, untinted and full size, at that look alone. */
  const runOutSlots = new Map<
    string,
    {
      geometry: THREE.BufferGeometry;
      slot: number;
      tint: THREE.Color;
      only?: SiteLook;
    }[]
  >();

  /** The parts each kind of site is drawn with, as runOutSlots keeps them, with the scale and colour each is placed at. */
  const siteParts: {
    [field in SiteField]: (kind: NonNullable<TileKind[field]>) => {
      geometry: THREE.BufferGeometry;
      scale: number;
      color?: THREE.Color;
      tint: THREE.Color;
      only?: SiteLook;
    }[];
  } = {
    bush: (kind) => {
      const { geometry } = bushMeshes[kind];
      geometry.computeBoundingBox();
      const width = geometry.boundingBox!.getSize(new THREE.Vector3()).x;
      return [
        {
          geometry,
          scale: BUSH_WIDTH / width,
          color: new THREE.Color(BUSH_TINT[kind]),
          tint: RUN_OUT_TINT,
        },
      ];
    },
    tree: (kind) => [
      {
        geometry: trees[kind],
        scale: TREE_SCALE,
        color: new THREE.Color(TREE_MODELS[kind].tint),
        tint: white,
        only: "full",
      },
      { geometry: stump, scale: STUMP_SCALE, tint: white, only: "runOut" },
    ],
    // A spot with no site, or one run out, is plain water.
    fishingSpot: () => [
      { geometry: ripple, scale: 1, tint: white, only: "full" },
    ],
    vein: (kind) => [
      { geometry: ore.rock.geometry, scale: ORE_SCALE, tint: white },
      {
        geometry: ore.vein.geometry,
        scale: ORE_SCALE,
        color: VEIN_TINT[kind],
        tint: VEIN_RUN_OUT_TINT,
      },
    ],
  };

  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);

  const goods: { prop: Goods; at: THREE.Vector3 }[] = [];
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

      if (tile.ground === "cobble") {
        // Where a dirt road leaves the cobbles, an edge piece thins them out towards it;
        // elsewhere a quarter turn by the tile's hash, so the stones don't repeat tile to tile.
        const road = FACING.find(
          ({ dx, dy }) => tiles[y + dy]?.[x + dx]?.ground === "path",
        );
        const turn = new THREE.Matrix4().makeRotationY(
          road ? road.angle : ((hash >>> 4) & 3) * (Math.PI / 2),
        );
        place(
          village.get(road ? COBBLE_EDGES[(hash >>> 6) & 3]! : COBBLES)!,
          new THREE.Matrix4()
            .makeTranslation(x, top + COBBLE_LIFT, y)
            .multiply(turn)
            .multiply(cobbleFit),
        );
      }
      const { prop, station, house } = tile;
      const site = SITE_FIELDS.find((field) => tile[field]);
      if (station) footprints[station].push(new THREE.Vector3(x, top, y));
      if (house) {
        for (const {
          part,
          angle,
          height,
          out = 0,
          along = 0,
          scale = 1,
          tint,
        } of houseParts(tiles, x, y)) {
          const turn = new THREE.Quaternion().setFromAxisAngle(up, angle);
          place(
            village.get(HOUSE_MODELS[part])!,
            new THREE.Matrix4().compose(
              new THREE.Vector3(out, 0, along)
                .applyQuaternion(turn)
                .add(new THREE.Vector3(x, top + height, y)),
              turn,
              new THREE.Vector3(scale, scale, scale),
            ),
            tint === undefined ? undefined : new THREE.Color(tint),
          );
        }
      }
      if (!site && !prop) return;
      const rotation = new THREE.Quaternion().setFromAxisAngle(
        up,
        (((hash >>> 16) & 255) / 256) * Math.PI * 2,
      );
      const at = new THREE.Vector3(x, top, y);
      if (site) {
        runOutSlots.set(
          siteId({ x, y }),
          siteParts[site](tile[site] as never).map(
            ({ geometry, scale, color, tint, only }) => ({
              geometry,
              slot: place(
                geometry,
                new THREE.Matrix4().compose(
                  at,
                  rotation,
                  new THREE.Vector3().setScalar(scale),
                ),
                color,
              ),
              tint,
              only,
            }),
          ),
        );
      } else if (isGoods(prop!)) {
        goods.push({ prop: prop as Goods, at });
      } else {
        const options = propVariants[prop!];
        const geometry = options[((hash >>> 8) & 255) % options.length]!;
        const { scale, fixed } = PROP_MODELS[prop as Exclude<PropKind, Goods>];
        place(
          geometry,
          new THREE.Matrix4().compose(
            at,
            fixed ? new THREE.Quaternion() : rotation,
            typeof scale === "number"
              ? new THREE.Vector3().setScalar(scale)
              : new THREE.Vector3(...scale),
          ),
        );
      }
    }),
  );
  scene.add(slabs);
  const goodsModels = new Map(
    await Promise.all(
      Object.entries(GOODS).map(
        async ([kind, look]) => [kind, await loadStation(look)] as const,
      ),
    ),
  );
  for (const { prop, at } of goods) {
    const model = goodsModels.get(prop)!.clone();
    model.position.add(at);
    scene.add(model);
  }
  // One model per station, at the middle of the tiles it covers.
  const placedStations: Partial<Record<FixedStation, THREE.Object3D>> = {};
  for (const [kind, tilesUnder] of Object.entries(footprints)) {
    if (!tilesUnder.length) continue;
    const model = stations[kind as FixedStation];
    new THREE.Box3().setFromPoints(tilesUnder).getCenter(model.position);
    scene.add(model);
    placedStations[kind as FixedStation] = model;
  }

  const meshes = new Map<THREE.BufferGeometry, THREE.InstancedMesh>();
  const cobbleGeometries = new Set(
    [COBBLES, ...COBBLE_EDGES].map((name) => village.get(name)!),
  );
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
    mesh.castShadow = geometry !== ripple;
    // The cobbles cover their slabs, so they take the shadows the slabs would.
    mesh.receiveShadow = cobbleGeometries.has(geometry);
    scene.add(mesh);
    meshes.set(geometry, mesh);
  }
  const ripples = meshes.get(ripple);
  if (ripples)
    ripples.onBeforeRender = () => {
      rippleMaterial.opacity = 0.45 + 0.25 * Math.sin(performance.now() / 400);
    };

  /** The fading copies of each spent site, by its tile's id. */
  const fading = new Map<string, THREE.Mesh[]>();
  const stopFading = (id: string) => {
    for (const copy of fading.get(id) ?? []) {
      scene.remove(copy);
      (copy.material as THREE.Material).dispose();
    }
    fading.delete(id);
  };
  /** An InstancedMesh can't fade one instance, so a spent site fades as its own copy. */
  const fadeOut = (id: string, copies: THREE.Mesh[]) => {
    fading.set(id, copies);
    copies.forEach((copy) => scene.add(copy));
    const start = performance.now();
    const step = (now: number) => {
      if (fading.get(id) !== copies) return;
      const faded = (now - start - SPENT_HOLD_MS) / SPENT_FADE_MS;
      if (faded >= 1) return stopFading(id);
      for (const copy of copies)
        (copy.material as THREE.Material).opacity = 1 - Math.max(faded, 0);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const setLook = (id: string, look: SiteLook) => {
    stopFading(id);
    const copies: THREE.Mesh[] = [];
    for (const { geometry, slot, tint, only } of runOutSlots.get(id)!) {
      const instances = meshes.get(geometry)!;
      const { matrix, color } = placements.get(geometry)![slot]!;
      if (look === "spent" && !only) {
        const own = instances.material as THREE.MeshLambertMaterial;
        const faded = own.clone();
        faded.transparent = true;
        faded.color.multiply(tint);
        const copy = new THREE.Mesh(geometry, faded);
        copy.applyMatrix4(matrix.clone().scale(RUN_OUT_SCALE));
        copy.castShadow = true;
        copies.push(copy);
      }
      const runOut = look === "runOut" && !only;
      const shown = only ? look === only : look !== "gone" && look !== "spent";
      instances.setMatrixAt(
        slot,
        !shown
          ? matrix.clone().scale(GONE_SCALE)
          : runOut
            ? matrix.clone().scale(RUN_OUT_SCALE)
            : matrix,
      );
      instances.setColorAt(slot, runOut ? tint : color);
      instances.instanceMatrix.needsUpdate = true;
      instances.instanceColor!.needsUpdate = true;
    }
    if (copies.length) fadeOut(id, copies);
  };
  // A tree's stump is hidden until it runs out.
  tiles.forEach((row, y) =>
    row.forEach(({ tree }, x) => tree && setLook(siteId({ x, y }), "full")),
  );
  /** A site's parts as drawn now, for clicks to find. */
  const siteModel = (id: string) =>
    instancesModel(
      runOutSlots
        .get(id)!
        .map(({ geometry, slot }) => ({ mesh: meshes.get(geometry)!, slot })),
    );
  return { setSiteLook: setLook, siteModel, stationModels: placedStations };
}
