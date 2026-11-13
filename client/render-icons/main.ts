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
const CRAFTPIX_SWORD = "/sword-rpg-game-icon-set/PNG/without background/21.png";

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

/** The one icon not rendered: a Craftpix PNG, scaled to match (spec §7). */
async function craftpixSword() {
  const image = new Image();
  image.src = CRAFTPIX_SWORD;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, SIZE, SIZE);
  return toPng(canvas);
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
pngs.set("emberiteSword", await craftpixSword());
draw(rod(), LEAN);
pngs.set("rod", await toPng(renderer.domElement));
draw(tinderbox(), LEAN);
pngs.set("tinderbox", await toPng(renderer.domElement));

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

const save = document.getElementById("save") as HTMLButtonElement;
save.disabled = false;
save.onclick = async () => {
  for (const [id, png] of pngs)
    await fetch(`/save/${id}.png`, { method: "POST", body: png });
  status.textContent = `Saved ${pngs.size} icons`;
};
