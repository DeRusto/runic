// Renders the item icons from the owner's art packs, shown here to check before saving (spec §7).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLOW_INTENSITY, TIER_LOOKS } from "../src/tierLooks.ts";

const SIZE = 144;
const RESOURCE = "/resource-bits/KayKit_ResourceBits_1.0_FREE/Assets/gltf";
const WEAPONS = "/KayKit_FantasyWeaponsBits_1.0_FREE/Assets/gltf";
const TOOLS = "/KayKit_RPGToolsBits_1.0_FREE/Assets/gltf";
const KNIGHT = "/KayKit_Adventurers_2.0_FREE/Characters/gltf/Knight.glb";
const CRAFTPIX_SWORD = "/sword-rpg-game-icon-set/PNG/without background/21.png";

// Tier looks, as worn (spec §7).
const { copper: COPPER, iron: IRON, emberite: EMBERITE } = TIER_LOOKS;

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
  { id: "ironBar", url: `${RESOURCE}/Iron_Bar.gltf`, turn: FLAT },
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
  { id: "ironSword", url: `${WEAPONS}/sword_B.gltf`, turn: LEAN, look: IRON },
  {
    id: "copperShield",
    url: `${WEAPONS}/shield_A.gltf`,
    turn: SHIELD,
    look: COPPER,
  },
  {
    id: "ironShield",
    url: `${WEAPONS}/shield_B.gltf`,
    turn: SHIELD,
    look: IRON,
  },
  {
    id: "emberiteShield",
    url: `${WEAPONS}/shield_C.gltf`,
    turn: SHIELD,
    look: EMBERITE,
  },
  { id: "pickaxe", url: `${TOOLS}/pickaxe.gltf`, turn: LEAN },
  { id: "hammer", url: `${TOOLS}/hammer.gltf`, turn: LEAN },
  {
    id: "berry",
    url: "/kenney-game-assets/3D assets/Food Kit/Models/GLB format/grapes.glb",
    turn: FLAT,
  },
  {
    id: "herb",
    url: "/stylized-nature-megakit/glTF/Plant_1.gltf",
    turn: [0.3, 0, 0],
  },
];

/** Each armour piece is the Knight's meshes for it, as no pack has armour on its own (spec §7). */
const ARMOUR = {
  Helmet: ["Knight_Helmet", "Knight_HelmetVisor"],
  Chestplate: ["Knight_Body"],
  Leggings: ["Knight_LegLeft", "Knight_LegRight"],
};

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
    const material = object.material as THREE.MeshStandardMaterial;
    if (material.map) material.map = greyVersion(material.map);
    if (tint !== undefined) material.color.setHex(tint);
    if (glow !== undefined) {
      material.emissive.setHex(glow);
      material.emissiveIntensity = GLOW_INTENSITY;
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
const bone = emberbone();
applyLook(bone, EMBERITE);
draw(bone, LEAN);
pngs.set("emberbone", await toPng(renderer.domElement));
pngs.set("emberiteSword", await craftpixSword());

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
