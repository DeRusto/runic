// PROTOTYPE, throwaway: three tier treatments, switchable via ?variant=, on the real camera and figures.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { SWING_INTERVAL_TICKS, TICK_MS, WALK_TICKS_PER_TILE } from "@runic/shared";
import { characterFor, loadCharacters, loadSpiders } from "../src/characters.ts";
import { camera, focusOn, scene } from "../src/scene.ts";

const $ = (id: string) => document.getElementById(id) as any;

type Look = { sword: string; shield: string; tint?: number; glow?: number };
const COPPER_TINT = 0xf0935a;
const IRON_TINT = 0xd5dde4;
const EMBER_TINT = 0x7a2a22;
const EMBER_GLOW = 0xff4a10;

const VARIANTS: Record<string, { name: string; tiers: Look[] }> = {
  A: {
    name: "Colour only: one sword, one shield, tinted",
    tiers: [
      { sword: "sword_A", shield: "shield_A", tint: COPPER_TINT },
      { sword: "sword_A", shield: "shield_A", tint: IRON_TINT },
      { sword: "sword_A", shield: "shield_A", tint: EMBER_TINT, glow: EMBER_GLOW },
    ],
  },
  B: {
    name: "Shape only: a new model each tier, pack colours",
    tiers: [
      { sword: "sword_A", shield: "shield_A" },
      { sword: "sword_B", shield: "shield_B" },
      { sword: "sword_C", shield: "shield_C" },
    ],
  },
  C: {
    name: "Shape and colour: a new model each tier, tinted",
    tiers: [
      { sword: "sword_A", shield: "shield_A", tint: COPPER_TINT },
      { sword: "sword_B", shield: "shield_B", tint: IRON_TINT },
      { sword: "sword_C", shield: "shield_C", tint: EMBER_TINT, glow: EMBER_GLOW },
    ],
  },
};
const VARIANT_KEYS = Object.keys(VARIANTS);

const PUNCH = "Melee_Unarmed_Attack_Punch_A";
const PUNCH_CONTACT_MS = 550;
const CLIPS = [
  "Melee_1H_Attack_Chop",
  "Melee_1H_Attack_Slice_Diagonal",
  "Melee_1H_Attack_Slice_Horizontal",
  "Melee_1H_Attack_Stab",
  "Melee_Block_Attack",
  PUNCH,
];
const STANCES = ["Melee_Unarmed_Idle", "Melee_Blocking", "Melee_2H_Idle", "Idle_A"];
const SWING_MS = SWING_INTERVAL_TICKS * TICK_MS;
const STEP_MS = WALK_TICKS_PER_TILE * TICK_MS;

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x55803f }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const loader = new GLTFLoader();
const gearFiles = new Map<string, THREE.Object3D>();
await Promise.all(
  ["sword_A", "sword_B", "sword_C", "sword_D", "sword_E", "shield_A", "shield_B", "shield_C"].map(
    async (file) => {
      const { scene: model } = await loader.loadAsync(`/prototype-gear/assets/${file}.gltf`);
      gearFiles.set(file, model);
    },
  ),
);

const makePlayer = await loadCharacters();
const makeSpider = await loadSpiders();

function nameFor(character: string) {
  for (let i = 0; ; i++) if (characterFor(`n${i}`) === character) return `n${i}`;
}

type Fighter = {
  figure: any;
  tile: { x: number; y: number };
  home: number;
  spider: any;
  tier: number; // -1 is bare
  gear: THREE.Object3D[];
};
const fighters: Fighter[] = [];
// Each row runs flat across the screen: the view looks down the (1,1,1) diagonal.
["Knight", "Barbarian"].forEach((character, row) => {
  for (let column = 0; column < 4; column++) {
    const x = 1.25 * column - 2 - 1.5 * row;
    const y = -1.25 * column + 2 - 1.5 * row - 1;
    const tile = { x, y };
    const figure = makePlayer(tile, nameFor(character));
    const spider = makeSpider({ x: x + 1, y });
    figure.fightTile = { x: x + 1, y };
    spider.fightTile = { x, y };
    scene.add(figure.model, spider.model);
    fighters.push({ figure, tile, home: x, spider, tier: column - 1, gear: [] });
  }
});

const params = new URLSearchParams(location.search);
const state = {
  variant: VARIANT_KEYS.includes(params.get("variant")!) ? params.get("variant")! : "A",
  mode: "Fight",
  shows: "Always",
  clip: params.get("clip") ?? CLIPS[0],
  stance: STANCES[0],
  contactMs: 0,
};

const clips: Map<string, THREE.AnimationClip> = fighters[0].figure.clips;

/** Guesses a clip's contact as the moment the sword hand moves fastest. */
function fastestHandMs(name: string) {
  const model = cloneSkinned(fighters[0].figure.model);
  const hand = model.getObjectByName("handslotr")!;
  const mixer = new THREE.AnimationMixer(model);
  mixer.clipAction(clips.get(name)!).play();
  const step = 1 / 60;
  const last = new THREE.Vector3();
  const now = new THREE.Vector3();
  let best = 0;
  let bestAt = 0;
  for (let t = 0; t < clips.get(name)!.duration; t += step) {
    mixer.setTime(t);
    model.updateMatrixWorld(true);
    hand.getWorldPosition(now);
    const speed = t ? now.distanceTo(last) : 0;
    if (speed > best) [best, bestAt] = [speed, t];
    last.copy(now);
  }
  return Math.round(bestAt * 100) * 10;
}
const guessMs = new Map(CLIPS.map((c) => [c, fastestHandMs(c)]));

// A tint multiplies, so the pack's dark blue blades would stay dark: tint a grey copy of the atlas instead.
let greyAtlas: THREE.CanvasTexture | undefined;
function greyVersion(map: THREE.Texture) {
  if (greyAtlas) return greyAtlas;
  const image = map.image as ImageBitmap;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = "grayscale(1) brightness(1.5)";
  ctx.drawImage(image, 0, 0);
  greyAtlas = new THREE.CanvasTexture(canvas);
  greyAtlas.flipY = map.flipY;
  greyAtlas.colorSpace = map.colorSpace;
  return greyAtlas;
}

function makeGear(file: string, look: Look) {
  const model = gearFiles.get(file)!.clone(true);
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    o.material = o.material.clone();
    if (look.tint !== undefined) {
      o.material.map = greyVersion(o.material.map);
      o.material.color.setHex(look.tint);
    }
    if (look.glow !== undefined) {
      o.material.emissive.setHex(look.glow);
      o.material.emissiveIntensity = 0.15;
    }
  });
  return model;
}

function dressAll() {
  for (const fighter of fighters) {
    fighter.gear.forEach((g) => g.removeFromParent());
    fighter.gear = [];
    if (fighter.tier < 0) continue;
    if (state.shows !== "Always" && state.mode !== "Fight") continue;
    const look = VARIANTS[state.variant].tiers[fighter.tier];
    const sword = makeGear(look.sword, look);
    const shield = makeGear(look.shield, look);
    fighter.figure.model.getObjectByName("handslotr").add(sword);
    fighter.figure.model.getObjectByName("handslotl").add(shield);
    fighter.gear = [sword, shield];
  }
}

function setStance() {
  for (const { figure, tier } of fighters) {
    figure.gait = { ...figure.gait, fight: tier < 0 ? STANCES[0] : state.stance };
    // Figure only swaps stance when its base changes, so force the swap from here.
    if (figure.base !== figure.gait.fight && figure.base !== figure.gait.move && state.mode === "Fight") {
      figure.base = figure.gait.fight;
      if (!figure.playingOnce) figure.play(figure.gait.fight);
    }
  }
}

function setMode() {
  for (const { figure, spider, tile, home } of fighters) {
    tile.x = home;
    const fighting = state.mode === "Fight";
    figure.fightTile = fighting ? { x: home + 1, y: tile.y } : undefined;
    spider.model.visible = fighting;
  }
  dressAll();
}

function render() {
  const url = new URL(location.href);
  url.searchParams.set("variant", state.variant);
  url.searchParams.set("clip", state.clip);
  history.replaceState(null, "", url);
  $("variantLabel").textContent = `${state.variant} (${VARIANTS[state.variant].name})`;
  $("contact").value = state.contactMs;
  $("contactLabel").textContent = state.contactMs;
  const { duration } = clips.get(state.clip)!;
  $("state").textContent = [
    `variant   ${state.variant}`,
    `mode      ${state.mode}`,
    `gear      ${state.shows}`,
    `clip      ${state.clip}`,
    `length    ${Math.round(duration * 1000)} ms`,
    `interval  ${SWING_MS} ms`,
    `contact   ${state.contactMs} ms (hand peak ${guessMs.get(state.clip)})`,
    `today     punch, ${PUNCH_CONTACT_MS} ms`,
    `zoom      ${camera.zoom.toFixed(2)}`,
  ].join("\n");
}

function fill(select: any, options: string[], value: string) {
  select.innerHTML = options.map((o) => `<option>${o}</option>`).join("");
  select.value = value;
}
fill($("clip"), CLIPS, state.clip);
fill($("stance"), STANCES, state.stance);

function setClip(clip: string) {
  state.clip = clip;
  state.contactMs = clip === PUNCH ? PUNCH_CONTACT_MS : guessMs.get(clip)!;
  render();
}

function cycle(by: number) {
  const i = VARIANT_KEYS.indexOf(state.variant);
  state.variant = VARIANT_KEYS[(i + by + VARIANT_KEYS.length) % VARIANT_KEYS.length];
  dressAll();
  render();
}
$("prev").onclick = () => cycle(-1);
$("next").onclick = () => cycle(1);
addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") cycle(-1);
  if (event.key === "ArrowRight") cycle(1);
});
$("mode").onchange = (e: any) => {
  state.mode = e.target.value;
  setMode();
  render();
};
$("shows").onchange = (e: any) => {
  state.shows = e.target.value;
  dressAll();
  render();
};
$("clip").onchange = (e: any) => setClip(e.target.value);
$("stance").onchange = (e: any) => {
  state.stance = e.target.value;
  setStance();
  render();
};
$("contact").oninput = (e: any) => {
  state.contactMs = Number(e.target.value);
  render();
};
$("resetZoom").onclick = () => {
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  render();
};
addEventListener("wheel", () => setTimeout(render));

function swingAll() {
  if (state.mode !== "Fight") return;
  for (const { figure, spider, tier, tile } of fighters) {
    const clip = tier < 0 ? PUNCH : state.clip;
    const contact = tier < 0 ? PUNCH_CONTACT_MS : state.contactMs;
    figure.once(clip);
    setTimeout(() => {
      spider.flash();
      spider.nudgeFrom(tile);
    }, contact);
  }
}
setInterval(swingAll, SWING_MS);

let out = true;
setInterval(() => {
  if (state.mode !== "Run") return;
  for (const fighter of fighters) fighter.tile.x = fighter.home + (out ? 1 : 0);
  out = !out;
}, STEP_MS);

function frame(now: number) {
  for (const { figure, spider } of fighters) {
    figure.update(now);
    if (spider.model.visible) spider.update(now);
  }
  // A little left of the group, to clear the panel.
  focusOn(-1.4, 0.4);
  requestAnimationFrame(frame);
}

Object.assign(window, { proto: { fighters, state, camera, VARIANTS, dressAll } });
setMode();
setStance();
setClip(state.clip);
swingAll();
requestAnimationFrame(frame);
