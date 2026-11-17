// Renders the item icons from the owner's art packs, shown here to check before saving (spec §7).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLOW_INTENSITY, TIER_LOOKS } from "../src/tierLooks.ts";
import { VIRTUES } from "@runic/shared";

const SIZE = 144;
const RESOURCE = "/resource-bits/KayKit_ResourceBits_1.0_FREE/Assets/gltf";
const WEAPONS = "/KayKit_FantasyWeaponsBits_1.0_FREE/Assets/gltf";
const TOOLS = "/KayKit_RPGToolsBits_1.0_FREE/Assets/gltf";
const SURVIVAL = "/kenney-game-assets/3D assets/Survival Kit/Models/GLB format";
const KNIGHT = "/KayKit_Adventurers_2.0_FREE/Characters/gltf/Knight.glb";
const MINING_ICONS = "/50-rpg-mining-icons/PNG/Without background";
const SPIDER_ICONS = "/rpg-spider-loot-icons/PNG/without background";
const MONSTER_ICONS = "/rpg-monster-loot-icons/PNG/without background";
/** The icons taken from the owner's Craftpix packs rather than rendered, scaled to match (spec §7). */
const PACK_ICONS: Record<string, string> = {
  emberiteSword: "/sword-rpg-game-icon-set/PNG/without background/21.png",
  copperOre: `${MINING_ICONS}/37.png`,
  ironOre: `${MINING_ICONS}/26.png`,
  emberiteOre: `${MINING_ICONS}/38.png`,
  tin: `${MINING_ICONS}/31.png`,
  cinderglass: `${MINING_ICONS}/35.png`,
  heartflame: `${MINING_ICONS}/39.png`,
  runeEssence: `${MINING_ICONS}/49.png`,
  hollowEssence: `${MINING_ICONS}/43.png`,
  pickaxe: `${MINING_ICONS}/2.png`,
  emberbone: `${MONSTER_ICONS}/24.png`,
  feather: `${MONSTER_ICONS}/33.png`,
  berry: `${MONSTER_ICONS}/7.png`,
  herb: `${MONSTER_ICONS}/8.png`,
  spiderSilk: `${SPIDER_ICONS}/5.png`,
  mightPotion: `${SPIDER_ICONS}/33.png`,
  avoidancePotion: `${SPIDER_ICONS}/41.png`,
};

const icon = (pack: string, n: number) =>
  `/${pack}/PNG/without background/${n}.png`;
const DWARF = "rpg-dwarf-loot-icons";
const KOBOLD = "rpg-kobold-loot-icons";
const FOOD = "50-rpg-food-icons";
const FLOWER = "rpg-flower-game-icons";
/** More Craftpix icons, from the packs bought on 2026-11-16 (the owner's picks). */
Object.assign(PACK_ICONS, {
  axe: icon(DWARF, 12),
  hammer: icon(DWARF, 21),
  torch: icon(KOBOLD, 23),
  rope: icon("rpg-pirate-loot-icons", 13),
  vial: icon("rpg-pirate-loot-icons", 17),
  coins: icon("treasure-and-chest-rpg-icons", 45),
  ashstone: icon(KOBOLD, 3),
  strangeMaterial: icon(KOBOLD, 50),
  arrowShaft: icon("rpg-cooking-ingredient-icon-pack", 38),
  boneSigil: icon("magical-artifact-rpg-game-icons", 39),
  bristleHide: icon(DWARF, 50),
  cinderHide: icon("50-rpg-loot-game-icons", 7),
  tarnHide: icon(DWARF, 37),
  dewpetal: icon(FLOWER, 1),
  nightbloom: icon(FLOWER, 25),
  emberbloom: icon(FLOWER, 13),
  fortitudePotion: icon("rpg-elixir-icons", 23),
  perch: icon("rpg-sea-loot-icons", 34),
  pike: icon("rpg-sea-loot-icons", 35),
  trout: icon("rpg-pirate-loot-icons", 35),
  cookedPerch: icon(FOOD, 1),
  cookedPike: icon(FOOD, 47),
  cookedTrout: icon(FOOD, 27),
  birchBow: icon("bow-and-crossbow-rpg-icons", 1),
  oakBow: icon("bow-and-crossbow-rpg-icons", 12),
  charwoodBow: icon("bow-and-crossbow-rpg-icons", 17),
  oakLog: icon(DWARF, 35),
  gossamerCloak: icon("50-rpg-armor-icons", 38),
});

/** Pack icons recoloured: `mix` of the way from the painting to its shading in `look`'s colours. */
const RECOLOURED: { id: string; url: string; look: Look; mix?: number }[] = [
  // The pack's grey stones, blackened: as painted they read as silver ore.
  {
    id: "coal",
    url: icon(KOBOLD, 40),
    look: { tint: 0x1a1817, glow: 0x5c5853 },
  },
  // The logs as the bows: one log, pale and charred.
  { id: "birchLog", url: icon(DWARF, 35), look: { tint: 0xf0e6cc } },
  { id: "charwoodLog", url: icon(DWARF, 35), look: { tint: 0x6a3a30 } },
  // The berry and herb dishes: the cooked fish, mostly rosy or herbal (#221); at half they barely differ.
  ...(
    [
      ["Perch", 1, 0xb05429, 0x6e6320],
      ["Pike", 47, 0x8a492c, 0x565723],
      ["Trout", 27, 0xc05837, 0x77692b],
    ] as const
  ).flatMap(([fish, n, berry, herb]) => [
    { id: `berry${fish}`, url: icon(FOOD, n), look: { tint: berry }, mix: 0.8 },
    { id: `herb${fish}`, url: icon(FOOD, n), look: { tint: herb }, mix: 0.8 },
  ]),
];
/** Tiered gear: one painting a slot, in each tier's colours as in hand (spec §7). */
const TIERED_ICONS: Record<string, string> = {
  Bar: icon(DWARF, 28),
  Helmet: icon("rpg-helmet-icons", 26),
  Chestplate: icon("50-rpg-armor-icons", 23),
  Leggings: icon("rpg-greaves-icons", 16),
  Boots: icon("rpg-pirate-loot-icons", 26),
  Gloves: icon("50-rpg-glove-icons", 46),
  Ring: icon("50-rpg-jewelry-icons", 10),
  Amulet: icon("50-rpg-jewelry-icons", 24),
  Arrow: icon("rpg-undead-loot-icons", 47),
  ThrowingKnife: icon("50-rpg-dagger-icons", 31),
  // Odo's proof essences: only copper, iron and emberite exist, so the others are skipped below.
  Essence: icon("magical-artifact-rpg-game-icons", 4),
  // All three Virtues' capes share their tier's icon (#217).
  ...Object.fromEntries(
    VIRTUES.map((v) => [
      `${v[0]!.toUpperCase()}${v.slice(1)}Cape`,
      icon("50-rpg-armor-icons", 7),
    ]),
  ),
};

// Tier looks, as worn (spec §7).
const {
  copper: COPPER,
  bronze: BRONZE,
  iron: IRON,
  steel: STEEL,
  emberite: EMBERITE,
} = TIER_LOOKS;

/** The model turned to face us: a slight three-quarter view, with long items leaning corner to corner. */
const FLAT: Turn = [0.6, -0.5, 0];
const LEAN: Turn = [0.2, -0.4, -Math.PI / 4];
const SHIELD: Turn = [0.15, -0.5, 0];
const WORN: Turn = [0.25, -0.5, 0];
type Turn = [x: number, y: number, z: number];
type Look = { tint?: number; glow?: number };
type Icon = { id: string; url: string; turn: Turn; look?: Look };

const ICONS: Icon[] = [
  { id: "copperOre", url: `${RESOURCE}/Copper_Nuggets.gltf`, turn: FLAT },
  { id: "ironOre", url: `${RESOURCE}/Iron_Nuggets.gltf`, turn: FLAT },
  {
    id: "emberiteOre",
    url: `${RESOURCE}/Iron_Nuggets.gltf`,
    turn: FLAT,
    look: EMBERITE,
  },
  { id: "copperBar", url: `${RESOURCE}/Copper_Bar.gltf`, turn: FLAT },
  {
    id: "bronzeBar",
    url: `${RESOURCE}/Copper_Bar.gltf`,
    turn: FLAT,
    look: BRONZE,
  },
  { id: "ironBar", url: `${RESOURCE}/Iron_Bar.gltf`, turn: FLAT },
  { id: "steelBar", url: `${RESOURCE}/Iron_Bar.gltf`, turn: FLAT, look: STEEL },
  {
    id: "emberiteBar",
    url: `${RESOURCE}/Iron_Bar.gltf`,
    turn: FLAT,
    look: EMBERITE,
  },
  {
    id: "copperSword",
    url: `${WEAPONS}/sword_A.gltf`,
    turn: LEAN,
    look: COPPER,
  },
  {
    id: "bronzeSword",
    url: `${WEAPONS}/sword_A.gltf`,
    turn: LEAN,
    look: BRONZE,
  },
  { id: "ironSword", url: `${WEAPONS}/sword_B.gltf`, turn: LEAN, look: IRON },
  {
    id: "steelSword",
    url: `${WEAPONS}/sword_B.gltf`,
    turn: LEAN,
    look: STEEL,
  },
  {
    id: "copperShield",
    url: `${WEAPONS}/shield_A.gltf`,
    turn: SHIELD,
    look: COPPER,
  },
  {
    id: "bronzeShield",
    url: `${WEAPONS}/shield_A.gltf`,
    turn: SHIELD,
    look: BRONZE,
  },
  {
    id: "ironShield",
    url: `${WEAPONS}/shield_B.gltf`,
    turn: SHIELD,
    look: IRON,
  },
  {
    id: "steelShield",
    url: `${WEAPONS}/shield_B.gltf`,
    turn: SHIELD,
    look: STEEL,
  },
  {
    id: "emberiteShield",
    url: `${WEAPONS}/shield_C.gltf`,
    turn: SHIELD,
    look: EMBERITE,
  },
  { id: "pickaxe", url: `${TOOLS}/pickaxe.gltf`, turn: LEAN },
  { id: "hammer", url: `${TOOLS}/hammer.gltf`, turn: LEAN },
  { id: "axe", url: `${TOOLS}/axe.gltf`, turn: LEAN },
  // One log model for all three, tinted pale, left as it is, and charred.
  {
    id: "birchLog",
    url: `${RESOURCE}/Wood_Log_A.gltf`,
    turn: FLAT,
    look: { tint: 0xf0e6cc },
  },
  { id: "oakLog", url: `${RESOURCE}/Wood_Log_A.gltf`, turn: FLAT },
  {
    id: "charwoodLog",
    url: `${RESOURCE}/Wood_Log_A.gltf`,
    turn: FLAT,
    look: { tint: 0x6a3a30 },
  },
  // One fish model for perch and trout, tinted apart, and a bigger one for pike.
  {
    id: "perch",
    url: `${SURVIVAL}/fish.glb`,
    turn: FLAT,
    look: { tint: 0xc9c27a },
  },
  {
    id: "trout",
    url: `${SURVIVAL}/fish.glb`,
    turn: FLAT,
    look: { tint: 0xd9a6a0 },
  },
  {
    id: "pike",
    url: `${SURVIVAL}/fish-large.glb`,
    turn: FLAT,
    look: { tint: 0x7f9a66 },
  },
  // The cooked fish and the berry and herb dishes, the same fish browned, rosy and herbal (#221).
  {
    id: "cookedPerch",
    url: `${SURVIVAL}/fish.glb`,
    turn: FLAT,
    look: { tint: 0xb07a3c },
  },
  {
    id: "cookedTrout",
    url: `${SURVIVAL}/fish.glb`,
    turn: FLAT,
    look: { tint: 0xc08050 },
  },
  {
    id: "cookedPike",
    url: `${SURVIVAL}/fish-large.glb`,
    turn: FLAT,
    look: { tint: 0x8a6a40 },
  },
  {
    id: "berryPerch",
    url: `${SURVIVAL}/fish.glb`,
    turn: FLAT,
    look: { tint: 0xb05429 },
  },
  {
    id: "berryTrout",
    url: `${SURVIVAL}/fish.glb`,
    turn: FLAT,
    look: { tint: 0xc05837 },
  },
  {
    id: "berryPike",
    url: `${SURVIVAL}/fish-large.glb`,
    turn: FLAT,
    look: { tint: 0x8a492c },
  },
  {
    id: "herbPerch",
    url: `${SURVIVAL}/fish.glb`,
    turn: FLAT,
    look: { tint: 0x6e6320 },
  },
  {
    id: "herbTrout",
    url: `${SURVIVAL}/fish.glb`,
    turn: FLAT,
    look: { tint: 0x77692b },
  },
  {
    id: "herbPike",
    url: `${SURVIVAL}/fish-large.glb`,
    turn: FLAT,
    look: { tint: 0x565723 },
  },
  {
    id: "berry",
    url: "/kenney-game-assets/3D assets/Food Kit/Models/GLB format/grapes.glb",
    turn: FLAT,
  },
  // The herb and the potion plants, the same plant tinted apart (#222).
  {
    id: "herb",
    url: "/stylized-nature-megakit/glTF/Plant_1.gltf",
    turn: [0.3, 0, 0],
  },
  {
    id: "dewpetal",
    url: "/stylized-nature-megakit/glTF/Plant_1.gltf",
    turn: [0.3, 0, 0],
    look: { tint: 0x9fd0ff },
  },
  {
    id: "nightbloom",
    url: "/stylized-nature-megakit/glTF/Plant_1.gltf",
    turn: [0.3, 0, 0],
    look: { tint: 0x9a6ad8 },
  },
  {
    id: "emberbloom",
    url: "/stylized-nature-megakit/glTF/Plant_1.gltf",
    turn: [0.3, 0, 0],
    look: { tint: 0xe8743c },
  },
  // The empty vial, and the three potions tinted by their Virtue (#222).
  {
    id: "vial",
    url: "/KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf/bottle_B_brown.gltf",
    turn: FLAT,
    look: { tint: 0xddeeff },
  },
  {
    id: "mightPotion",
    url: "/KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf/bottle_A_green.gltf",
    turn: FLAT,
    look: { tint: 0xff5555 },
  },
  {
    id: "fortitudePotion",
    url: "/KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf/bottle_C_brown.gltf",
    turn: FLAT,
    look: { tint: 0x55e07a },
  },
  {
    id: "avoidancePotion",
    url: "/fantasy-props-megakit/Exports/glTF/Potion_4.gltf",
    turn: FLAT,
    look: { tint: 0x5599ff },
  },
  // Crafting's utilities (#225): the folded rope, the unlit torch, and the silk as pale cloth.
  {
    id: "rope",
    url: "/fantasy-props-megakit/Exports/glTF/Rope_1.gltf",
    turn: FLAT,
  },
  {
    id: "torch",
    url: "/fantasy-props-megakit/Exports/glTF/Torch_Metal.gltf",
    turn: LEAN,
    look: { tint: 0xb08a5a },
  },
  {
    id: "spiderSilk",
    url: "/resource-bits/KayKit_ResourceBits_1.0_FREE/Assets/gltf/Textiles_A.gltf",
    turn: FLAT,
    look: { tint: 0xe8e4da },
  },
  // #238's hides: the ResourceBits' folded cloth, browned by its creature and charred at Cinderhorn.
  {
    id: "tarnHide",
    url: `${RESOURCE}/Textiles_A.gltf`,
    turn: FLAT,
    look: { tint: 0xb08968 },
  },
  {
    id: "bristleHide",
    url: `${RESOURCE}/Textiles_A.gltf`,
    turn: FLAT,
    look: { tint: 0x8a6f56 },
  },
  {
    id: "cinderHide",
    url: `${RESOURCE}/Textiles_A.gltf`,
    turn: FLAT,
    look: { tint: 0x5a443a, glow: 0x4a1c08 },
  },
  {
    id: "coal",
    url: "/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf/Rock_1_E_Color1.gltf",
    turn: FLAT,
    look: { tint: 0x2e2e2e },
  },
  {
    id: "coins",
    url: "/KayKit_Dungeon_Pack_1.1_FREE/Assets/gltf/coin_stack_small.gltf",
    turn: FLAT,
  },
];

/** Each armour piece is the Knight's meshes for it, as no pack has armour on its own (spec §7). */
const ARMOUR = {
  Helmet: ["Knight_Helmet", "Knight_HelmetVisor"],
  Chestplate: ["Knight_Body"],
  Leggings: ["Knight_LegLeft", "Knight_LegRight"],
};

/** A cape: a draped half-cylinder and its shoulder yoke, as no pack has a cape (spec §7, #217). */
function capeMesh() {
  const cape = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  const cloth = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.55,
      1,
      1.8,
      20,
      1,
      true,
      -Math.PI / 2,
      Math.PI,
    ),
    material,
  );
  const yoke = new THREE.Mesh(new THREE.SphereGeometry(0.62, 20, 8), material);
  yoke.scale.set(1.15, 0.35, 0.85);
  yoke.position.y = 0.95;
  cape.add(cloth, yoke);
  return cape;
}

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setSize(SIZE, SIZE);

// The world's lights (client/src/scene.ts), with the sun in front of the item.
const scene = new THREE.Scene();
const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
sun.position.set(-2, 3, 5);
scene.add(new THREE.HemisphereLight(0xdfefff, 0x3a4a2a, 1.6), sun);

const camera = new THREE.OrthographicCamera();

/** A tint multiplies, so it goes over a grey copy of the atlas, as on worn gear (spec §7). */
function greyVersion(map: THREE.Texture) {
  const image = map.image as ImageBitmap;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d")!;
  context.filter = "grayscale(1) brightness(1.5)";
  context.drawImage(image, 0, 0);
  const grey = new THREE.CanvasTexture(canvas);
  grey.flipY = map.flipY;
  grey.colorSpace = map.colorSpace;
  return grey;
}

function applyLook(model: THREE.Object3D, { tint, glow }: Look) {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    // Some models give a mesh an array of materials, so a look covers each.
    // Some models give a mesh an array of materials, so a look covers each.
    const materials = [object.material].flat() as THREE.MeshStandardMaterial[];
    for (const material of materials) {
      if (material.map) material.map = greyVersion(material.map);
      if (tint !== undefined) material.color.setHex(tint);
      if (glow !== undefined) {
        material.emissive.setHex(glow);
        material.emissiveIntensity = GLOW_INTENSITY;
      }
    }
  });
}

/** A cylinder and four knobs: no pack has a bone for a single drop (spec §7). */
function emberbone() {
  const bone = new THREE.Group();
  const material = new THREE.MeshStandardMaterial();
  bone.add(
    new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.5), material),
  );
  for (const [x, y] of [
    [-0.17, 0.8],
    [0.17, 0.8],
    [-0.17, -0.8],
    [0.17, -0.8],
  ] as const) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.25), material);
    knob.position.set(x, y, 0);
    bone.add(knob);
  }
  return bone;
}

/** Fits the camera to the turned model and draws it. */
function draw(model: THREE.Object3D, turn: Turn) {
  const turned = new THREE.Group();
  turned.add(model);
  turned.rotation.set(...turn);
  scene.add(turned);
  turned.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turned, true);
  const centre = box.getCenter(new THREE.Vector3());
  const { x: width, y: height, z: depth } = box.getSize(new THREE.Vector3());
  const half = Math.max(width, height) / 2;
  camera.left = -half;
  camera.right = half;
  camera.top = half;
  camera.bottom = -half;
  camera.near = 0.1;
  camera.far = depth + 1;
  camera.position.set(centre.x, centre.y, box.max.z + 0.5);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  scene.remove(turned);
}

const toPng = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!)));

/** A pack PNG, scaled to match the rendered icons (spec §7), and recoloured if given a look. */
async function packIcon(url: string, look?: Look, mix = 1) {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, SIZE, SIZE);
  if (look?.tint !== undefined)
    recolour(context, look.tint, look.glow ?? 0xffffff, mix);
  return toPng(canvas);
}

/**
 * Repaints the canvas by its shading: black through `tint` (at a brightness of 110 of 255) to `light`,
 * after stretching the brightness to the full range, then mixes that `mix` of the way in.
 */
function recolour(
  context: CanvasRenderingContext2D,
  tint: number,
  light: number,
  mix: number,
) {
  const data = context.getImageData(0, 0, SIZE, SIZE);
  const px = data.data;
  const lum = (i: number) =>
    0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
  const seen: number[] = [];
  for (let i = 0; i < px.length; i += 4) if (px[i + 3]! > 0) seen.push(lum(i));
  seen.sort((a, b) => a - b);
  // The 1st and 99th centiles, so a few specks don't set the range.
  const lo = seen[Math.floor(seen.length * 0.01)] ?? 0;
  const hi = Math.max(seen[Math.floor(seen.length * 0.99)] ?? 255, lo + 1);
  const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  const [mid, top] = [channels(tint), channels(light)];
  for (let i = 0; i < px.length; i += 4) {
    const t = Math.min(Math.max(((lum(i) - lo) / (hi - lo)) * 255, 0), 255);
    for (let k = 0; k < 3; k++) {
      const shade =
        t < 110
          ? (mid[k]! * t) / 110
          : mid[k]! + ((top[k]! - mid[k]!) * (t - 110)) / 145;
      px[i + k] = px[i + k]! + (shade - px[i + k]!) * mix;
    }
  }
  context.putImageData(data, 0, 0);
}

const loader = new GLTFLoader();
const pngs = new Map<string, Blob>();
for (const { id, url, turn, look } of ICONS) {
  const { scene: model } = await loader.loadAsync(url);
  if (look) applyLook(model, look);
  draw(model, turn);
  pngs.set(id, await toPng(renderer.domElement));
}
for (const [piece, meshes] of Object.entries(ARMOUR)) {
  for (const [tier, look] of Object.entries(TIER_LOOKS)) {
    // A fresh load each time, as the look changes the model's own materials.
    const { scene: knight } = await loader.loadAsync(KNIGHT);
    const others: THREE.Object3D[] = [];
    knight.traverse((object) => {
      if (object instanceof THREE.Mesh && !meshes.includes(object.name))
        others.push(object);
    });
    for (const other of others) other.removeFromParent();
    applyLook(knight, look);
    draw(knight, WORN);
    pngs.set(`${tier}${piece}`, await toPng(renderer.domElement));
  }
}
// The 15 capes (#217), the same cape tinted by its tier: its Virtue shows in the name only.
for (const [tier, look] of Object.entries(TIER_LOOKS)) {
  for (const virtue of VIRTUES) {
    const cape = capeMesh();
    applyLook(cape, look);
    draw(cape, WORN);
    pngs.set(
      `${tier}${virtue[0]!.toUpperCase()}${virtue.slice(1)}Cape`,
      await toPng(renderer.domElement),
    );
  }
}
// The workbench row's cloak, in the silk's pale grey: the cape it comes from varies (#225).
const cloak = capeMesh();
applyLook(cloak, { tint: 0xd8dcd4 });
draw(cloak, WORN);
pngs.set("gossamerCloak", await toPng(renderer.domElement));

/** A mitt with its cuff: no pack has a glove on its own (#238). */
function glove() {
  const group = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), leather);
  mitt.scale.set(1, 0.8, 1.25);
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 0.5, 12),
    leather,
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0, -0.55);
  group.add(mitt, cuff);
  return group;
}

/** A boot's shaft and foot: no pack has a boot on its own (#238). */
function boot() {
  const group = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.44, 1.2, 12),
    leather,
  );
  shaft.position.y = 0.55;
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1.05), leather);
  foot.position.set(0, -0.25, 0.25);
  group.add(shaft, foot);
  return group;
}

/** A cord's ring with a cut gem hung from it: no pack has an amulet on its own (#238). */
function pendant() {
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.08, 8, 24),
      new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    ),
  );
  const stone = gem(0xffffff);
  stone.scale.setScalar(0.55);
  stone.position.y = -0.95;
  group.add(stone);
  return group;
}

/** A band with a cut gem set in it: no pack has a ring on its own (#238). */
function band() {
  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.18, 8, 24),
      new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.4 }),
    ),
  );
  const stone = gem(0xffffff);
  stone.scale.setScalar(0.45);
  stone.position.y = 0.75;
  group.add(stone);
  return group;
}

// Leatherworking's hands and feet (#238), the same mitt and boot tinted by their tier; the hides keep the ICONS' cloth. A flat turn, as they lie.
for (const [tier, look] of Object.entries(TIER_LOOKS)) {
  const mitt = glove();
  applyLook(mitt, look);
  draw(mitt, FLAT);
  pngs.set(`${tier}Gloves`, await toPng(renderer.domElement));
  const shoe = boot();
  applyLook(shoe, look);
  draw(shoe, LEAN);
  pngs.set(`${tier}Boots`, await toPng(renderer.domElement));
  // Jewelsmithing's neck and ring (#238), the same pendant and band tinted by their tier.
  const necklace = pendant();
  applyLook(necklace, look);
  draw(necklace, FLAT);
  pngs.set(`${tier}Amulet`, await toPng(renderer.domElement));
  const ringIcon = band();
  applyLook(ringIcon, look);
  draw(ringIcon, FLAT);
  pngs.set(`${tier}Ring`, await toPng(renderer.domElement));
}

// Fletching's stock (#228). The bows are the weapons pack's, tinted pale, as cut and charred like the logs; the arrows and throwing knives are tinted by their tier.
const BOW_LOOKS: Record<string, Look> = {
  birchBow: { tint: 0xf0e6cc },
  oakBow: {},
  charwoodBow: { tint: 0x6a3a30 },
};
for (const [id, look] of Object.entries(BOW_LOOKS)) {
  const { scene: model } = await loader.loadAsync(
    `${WEAPONS}/bow_A_withString.gltf`,
  );
  applyLook(model, look);
  draw(model, LEAN);
  pngs.set(id, await toPng(renderer.domElement));
}
for (const [tier, look] of Object.entries(TIER_LOOKS)) {
  const { scene: arrow } = await loader.loadAsync(`${WEAPONS}/arrow_A.gltf`);
  applyLook(arrow, look);
  draw(arrow, LEAN);
  pngs.set(`${tier}Arrow`, await toPng(renderer.domElement));
  const { scene: knife } = await loader.loadAsync(`${WEAPONS}/dagger_A.gltf`);
  applyLook(knife, look);
  draw(knife, LEAN);
  pngs.set(`${tier}ThrowingKnife`, await toPng(renderer.domElement));
  const head = arrowhead();
  applyLook(head, look);
  draw(head, FLAT);
  pngs.set(`${tier}Arrowhead`, await toPng(renderer.domElement));
}

/** A pile of small lumps: no pack has a tin nugget on its own. */
function nuggets() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xcfd4da,
    roughness: 0.45,
    metalness: 0.25,
  });
  for (const [x, y, z, s] of [
    [0, 0, 0, 0.55],
    [-0.5, 0.1, 0.1, 0.42],
    [0.5, 0.05, -0.05, 0.45],
    [0.1, 0.45, 0, 0.38],
    [-0.15, -0.35, 0.15, 0.4],
  ] as const) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.5), material);
    blob.position.set(x, y, z);
    blob.scale.set(s * 2, s * 1.4, s * 1.6);
    group.add(blob);
  }
  return group;
}

/** A steel case with its lid open and a striker across it: no pack has a tinderbox (#224). */
function tinderbox() {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({
    color: 0xaab2ba,
    roughness: 0.45,
    metalness: 0.25,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.1), steel);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.1), steel);
  lid.position.set(0, 0.35, -0.55);
  lid.rotation.x = -0.9;
  const striker = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.07, 8, 16, Math.PI),
    new THREE.MeshStandardMaterial({
      color: 0x6a7077,
      roughness: 0.35,
      metalness: 0.3,
    }),
  );
  striker.rotation.x = Math.PI / 2;
  striker.position.set(0, 0.28, 0.15);
  group.add(base, lid, striker);
  return group;
}

/** A tapered pole with a cork grip and a reel: no pack has a fishing rod. */
function rod() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 3), wood);
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xc9a46a }),
  );
  grip.position.y = -1.1;
  const reel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.4 }),
  );
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.17, -0.6, 0);
  group.add(pole, grip, reel);
  return group;
}

/** A cut gem, elongated: no pack has gems in the free tier. */
function gem(color: number, emissive?: number) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.25,
    metalness: 0.1,
    flatShading: true,
    emissive: emissive ?? 0x000000,
    emissiveIntensity: GLOW_INTENSITY,
  });
  const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), material);
  mesh.scale.y = 1.3;
  return mesh;
}

/** A slender tapered stick: no pack has a bare shaft (#228). */
function arrowShaft() {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0xc9b48a });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 3), wood));
  return group;
}

/** A flat vane on a quill: no pack has a feather (#228). */
function feather() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xf2efe6,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const vane = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), material);
  vane.scale.set(0.16, 1.5, 0.45);
  const quill = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 2.6),
    material,
  );
  quill.rotation.z = Math.PI / 2;
  group.add(vane, quill);
  return group;
}

/** A small flaked blade: no pack has an arrowhead on its own (#228). */
function arrowhead() {
  const material = new THREE.MeshStandardMaterial({
    metalness: 0.3,
    roughness: 0.4,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 4), material);
  mesh.scale.z = 0.35;
  return mesh;
}

/** A cluster of pale crystals: no pack has rune essence on its own (#232). */
function essence() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xbfe3f2,
    roughness: 0.25,
    metalness: 0.1,
    flatShading: true,
    emissive: 0x3a6f8a,
    emissiveIntensity: GLOW_INTENSITY,
  });
  for (const [x, z, height] of [
    [0, 0, 1],
    [0.45, 0.15, 0.65],
    [-0.4, -0.1, 0.55],
  ] as const) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), material);
    crystal.position.set(x, 0, z);
    crystal.scale.set(0.8, height * 1.5, 0.8);
    crystal.rotation.z = 0.2;
    group.add(crystal);
  }
  return group;
}

/** A Skeleton Mage's bone sigil for Hollis: a bone disc with a violet crystal set in its face. */
function boneSigil() {
  const group = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({
    color: 0xe8dcc0,
    roughness: 0.8,
    flatShading: true,
  });
  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 8), bone));
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.35),
    new THREE.MeshStandardMaterial({
      color: 0xc89cff,
      flatShading: true,
      emissive: 0x4a2370,
      emissiveIntensity: GLOW_INTENSITY,
    }),
  );
  crystal.position.y = 0.2;
  crystal.scale.y = 0.6;
  group.add(crystal);
  return group;
}

/** Kenney's rune slabs are gone: #238 re-renders the runes from the owner's four medallions (shown for review). */

const bone = emberbone();
applyLook(bone, EMBERITE);
draw(bone, LEAN);
pngs.set("emberbone", await toPng(renderer.domElement));
draw(nuggets(), FLAT);
pngs.set("tin", await toPng(renderer.domElement));
draw(gem(0x8a8d90), FLAT);
pngs.set("ashstone", await toPng(renderer.domElement));
draw(gem(0xd86a1e, 0x7a2a00), FLAT);
pngs.set("cinderglass", await toPng(renderer.domElement));
draw(gem(0xe83a10, 0xff4a10), FLAT);
pngs.set("heartflame", await toPng(renderer.domElement));
draw(rod(), LEAN);
pngs.set("rod", await toPng(renderer.domElement));
draw(tinderbox(), LEAN);
pngs.set("tinderbox", await toPng(renderer.domElement));
draw(arrowShaft(), LEAN);
pngs.set("arrowShaft", await toPng(renderer.domElement));
draw(feather(), FLAT);
pngs.set("feather", await toPng(renderer.domElement));

// #232's essence: the strange material is the tin's lumps, dull, and the essence a cluster
// of pale crystals. The runes are Kenney's rune slabs, tinted by their element.
const strange = nuggets();
applyLook(strange, { tint: 0x716a56 });
draw(strange, FLAT);
pngs.set("strangeMaterial", await toPng(renderer.domElement));
draw(essence(), FLAT);
pngs.set("runeEssence", await toPng(renderer.domElement));
// Odo's proof pieces: the essence's crystals, each tinted and lit by its vein's metal.
for (const [id, tint, glow] of [
  ["copperEssence", 0xe8955a, 0x7a3a10],
  ["ironEssence", 0x8fb4e0, 0x23436e],
  ["emberiteEssence", 0xff6a40, 0x8a1a00],
  // Hollis's Hollow essence, in the essence rocks' violet.
  ["hollowEssence", 0xc89cff, 0x4a2370],
] as const) {
  const proof = essence();
  applyLook(proof, { tint, glow });
  draw(proof, FLAT);
  pngs.set(id, await toPng(renderer.domElement));
}
draw(boneSigil(), FLAT);
pngs.set("boneSigil", await toPng(renderer.domElement));
// The owner's four rune medallions, rendered from their own models as the runes (#238),
// shown for the owner's review in place of the Kenney slabs.
const RUNES = [
  ["airRune", "Meshy_AI_Air_Rune_Medallion_1113121225_texture.glb"],
  ["waterRune", "Meshy_AI_Water_Rune_Medallion_1113121244_texture.glb"],
  ["earthRune", "Meshy_AI_Earth_Rune_Medallion_1113121251_texture.glb"],
  ["fireRune", "Meshy_AI_Fire_Rune_Medallion_1113121238_texture.glb"],
] as const;
for (const [id, file] of RUNES) {
  const { scene: medallion } = await loader.loadAsync(`/personal/${file}`);
  draw(medallion, FLAT);
  pngs.set(id, await toPng(renderer.domElement));
}

// shortcut: the icons above still render first and are replaced here; drop their renders if render time starts to matter.
for (const [id, url] of Object.entries(PACK_ICONS))
  pngs.set(id, await packIcon(url));
for (const { id, url, look, mix } of RECOLOURED)
  pngs.set(id, await packIcon(url, look, mix));
for (const [piece, url] of Object.entries(TIERED_ICONS))
  for (const [tier, look] of Object.entries(TIER_LOOKS))
    if (pngs.has(`${tier}${piece}`))
      pngs.set(`${tier}${piece}`, await packIcon(url, look));

const shown = document.getElementById("icons")!;
for (const [id, png] of pngs) {
  const figure = document.createElement("figure");
  const url = URL.createObjectURL(png);
  const large = new Image();
  const small = new Image();
  large.src = small.src = url;
  figure.append(large, small, id);
  shown.append(figure);
}

const status = document.getElementById("status")!;
const total = [...pngs.values()].reduce((sum, png) => sum + png.size, 0);
status.textContent = `${pngs.size} icons, ${Math.round(total / 1024)} KB`;

// shortcut: the canvas saves full-colour PNGs, and the painted icons then average 29 KB, past
// itemIcons.test.ts's budget. They were cut to 256 colours by hand with Pillow
// (Image.quantize(256, FASTOCTREE, FLOYDSTEINBERG), about 7 KB each); repeat that after a re-save,
// or quantise here once a PNG encoder such as upng-js is a dev dependency.
const save = document.getElementById("save") as HTMLButtonElement;
save.disabled = false;
save.onclick = async () => {
  for (const [id, png] of pngs)
    await fetch(`/save/${id}.png`, { method: "POST", body: png });
  status.textContent = `Saved ${pngs.size} icons`;
};
