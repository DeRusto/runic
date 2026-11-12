import {
  GATHERING,
  TICK_MS,
  WALK_TICKS_PER_TILE,
  type EnemyKind,
  type Tile,
  type VillagerId,
} from "@runic/shared";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { GLOW_INTENSITY, TIER_LOOKS, type TierLook } from "./tierLooks.ts";

const HEIGHT = 1.15;
const CROSSFADE_S = 0.12;
const TURN_RATE = 14;
const SLIDE_MS = WALK_TICKS_PER_TILE * TICK_MS;
// A little past the slide, so a slightly late patch for the next step doesn't flicker to Idle_A mid-walk.
const RUN_HOLD_MS = SLIDE_MS + 60;

// A step starting this long after a one-shot means walking away from it, not arriving with it.
const SAME_MOMENT_MS = 100;
const FLASH_MS = 140;
const NUDGE = 0.18;
const NUDGE_DECAY = 9;
const SINK_SPEED = 0.5;
const SINK_DEPTH = 1;
const GROW_SPEED = 2;

const PLAYER_GAIT = {
  idle: "Idle_A",
  move: "Running_A",
  moveSpeed: 2,
  fight: "Melee_Unarmed_Idle",
};
export const SPIDER_GAIT = {
  idle: "Spider_Idle",
  move: "Spider_Walk",
  moveSpeed: 2.9,
  fight: "Spider_Idle",
};
const SPIDER_WIDTH = 1.1;

const CHARACTERS = ["Knight", "Barbarian"] as const;
const CLIP_PACKS = [
  "Rig_Medium_General",
  "Rig_Medium_MovementBasic",
  "Rig_Medium_CombatMelee",
  "Rig_Medium_Tools",
];
/** The tool each gathering skill shows in hand, by its node's name. */
const GATHERING_TOOLS = { mining: "pickaxe", woodcutting: "axe" } as const;
type ToolSkill = keyof typeof GATHERING_TOOLS;
// Not "hammer": the Blacksmith's own model may hold a node of that name, and it must never hide.
const HAMMER = "hammer in hand";

const {
  copper: COPPER,
  bronze: BRONZE,
  iron: IRON,
  steel: STEEL,
  emberite: EMBERITE,
} = TIER_LOOKS;
/** Each tier's model and colour in hand, by item id (spec §7). Bronze and Steel reuse the model below them. */
const GEAR_LOOKS: Record<string, TierLook & { file: string; hand: string }> = {
  copperSword: { file: "sword_A", hand: "handslotr", ...COPPER },
  bronzeSword: { file: "sword_A", hand: "handslotr", ...BRONZE },
  ironSword: { file: "sword_B", hand: "handslotr", ...IRON },
  steelSword: { file: "sword_B", hand: "handslotr", ...STEEL },
  emberiteSword: { file: "sword_C", hand: "handslotr", ...EMBERITE },
  copperShield: { file: "shield_A", hand: "handslotl", ...COPPER },
  bronzeShield: { file: "shield_A", hand: "handslotl", ...BRONZE },
  ironShield: { file: "shield_B", hand: "handslotl", ...IRON },
  steelShield: { file: "shield_B", hand: "handslotl", ...STEEL },
  emberiteShield: { file: "shield_C", hand: "handslotl", ...EMBERITE },
};

/** Between swings, holding anything. Holding nothing is the gait's own fight stance. */
const ARMED_STANCE = "Melee_Blocking";
const ARMED_SWINGS = [
  { clip: "Melee_1H_Attack_Chop", contactMs: 580 },
  { clip: "Melee_1H_Attack_Slice_Diagonal", contactMs: 420 },
  { clip: "Melee_1H_Attack_Stab", contactMs: 380 },
];
const UNARMED_SWING = {
  clip: "Melee_Unarmed_Attack_Punch_A",
  contactMs: 550,
};
/** A blocked hit (spec §7). */
export const BLOCK_CLIP = "Melee_Block_Hit";
/** The clips that bring out what's worn, even with no fight going on. */
const GEAR_CLIPS = new Set(
  [...ARMED_SWINGS, UNARMED_SWING].map(({ clip }) => clip).concat(BLOCK_CLIP),
);

/** FNV-1a, mixed, as its low bits just follow the input's. */
function hashOf(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return (hash ^ (hash >>> 15)) >>> 0;
}

/** Which character a player is follows from their name alone, so nothing about it is stored. */
export function characterFor(name: string) {
  return CHARACTERS[hashOf(name) & 1];
}

/** The swing for a tick. It comes from the id and tick alone, so every viewer picks the same one. */
export function armedSwing(id: string, tick: number) {
  return ARMED_SWINGS[hashOf(`${id}:${tick}`) % ARMED_SWINGS.length]!;
}

/** A swing follows the weapon, so a shield with no sword punches (spec §7). */
export function swingFor(weapon: string, id: string, tick: number) {
  return weapon ? armedSwing(id, tick) : UNARMED_SWING;
}

/**
 * The clips each kind plays that aren't in its Figure's gait, and which of the Figure's returns
 * it uses. `hit` is played when a blow lands on it, if anything.
 */
export const ENEMY_CLIPS: Record<
  EnemyKind,
  {
    swing: (id: string, tick: number) => { clip: string; contactMs: number };
    death: string;
    hit?: string;
    returns: "reappear" | "respawn";
  }
> = {
  spider: {
    swing: () => ({ clip: "Spider_Attack", contactMs: 450 }),
    death: "Spider_Death",
    returns: "reappear",
  },
  skeleton: {
    swing: armedSwing,
    death: "Death_A",
    hit: "Hit_A",
    returns: "respawn",
  },
};

/** A model standing on a schema tile: slides between tiles, faces its way, and plays its clips. */
export class Figure {
  readonly mixer: THREE.AnimationMixer;
  private from: THREE.Vector3;
  private to: THREE.Vector3;
  private slideStart = -Infinity;
  private yaw = 0;
  private lastFrame = 0;
  private running = false;
  private current?: THREE.AnimationAction;
  private base: string;
  private shot?: THREE.AnimationAction;
  private shotFrame = 0;
  private held = false;
  private sinks = false;
  private sinking = false;
  private sunk = 0;
  private growth = 1;
  private fullScale: number;
  private kick = new THREE.Vector3();
  private flashTimer?: ReturnType<typeof setTimeout>;
  /** The tile of whoever this figure is fighting. It sets the stance, and faces them between moves. */
  fightTile?: Tile;
  /** The synced action, so a gathering tool stays in hand between attempts. */
  action = "";
  private tools: [ToolSkill, THREE.Object3D][] = [];
  /** The station it's working at. It faces the tile between moves, and `hammer` stays in hand between items. */
  work?: { tile: Tile; hammer: boolean };
  private hammer?: THREE.Object3D;
  /** The item ids worn, "" for none. They show in hand in a fight, and set the stance. */
  weapon = "";
  shield = "";
  /** Takes the armed stance whatever is worn: a Skeleton's blade is part of its model, not gear. */
  alwaysArmed = false;
  private gear: [item: string, model: THREE.Object3D][] = [];

  constructor(
    readonly tile: Tile,
    readonly model: THREE.Object3D,
    private clips: Map<string, THREE.AnimationClip>,
    private gait = PLAYER_GAIT,
  ) {
    model.position.set(tile.x, model.position.y, tile.y);
    this.from = model.position.clone();
    this.to = model.position.clone();
    this.fullScale = model.scale.x;
    for (const [skill, name] of Object.entries(GATHERING_TOOLS)) {
      const tool = model.getObjectByName(name);
      if (tool) this.tools.push([skill as ToolSkill, tool]);
    }
    this.hammer = model.getObjectByName(HAMMER);
    for (const item of Object.keys(GEAR_LOOKS)) {
      const held = model.getObjectByName(item);
      if (held) this.gear.push([item, held]);
    }
    this.mixer = new THREE.AnimationMixer(model);
    this.base = gait.idle;
    this.play(gait.idle);
    this.mixer.addEventListener("finished", ({ action }) => {
      if (action !== this.shot) return;
      if (this.held) this.sinking = this.sinks;
      else this.endShot();
    });
  }

  play(
    name: string,
    speed = 1,
    loop: THREE.AnimationActionLoopStyles = THREE.LoopRepeat,
  ) {
    const next = this.mixer.clipAction(this.clips.get(name)!);
    next.reset().setEffectiveTimeScale(speed).setLoop(loop, Infinity).play();
    // Clamped, so a finished one-shot holds its last pose while it fades out.
    next.clampWhenFinished = loop === THREE.LoopOnce;
    if (this.current && this.current !== next) {
      next.crossFadeFrom(this.current, CROSSFADE_S);
    }
    this.current = next;
  }

  /** Dead since before we saw it, so the fall is over: its death clip's last pose, held. */
  alreadyDown(clip: string) {
    this.once(clip, 1, true);
    this.current!.time = this.clips.get(clip)!.duration;
  }

  /** Dead and sunk since before we saw it, so only its return is still to come. */
  alreadyGone(clip: string) {
    this.alreadyDown(clip);
    this.model.visible = false;
  }

  /** Plays a clip once over the gait's clips, then goes back to them, or stays on it with `held`. */
  once(name: string, speed = 1, held = false) {
    this.play(name, speed, THREE.LoopOnce);
    this.shot = this.current;
    this.shotFrame = this.lastFrame;
    this.held = held;
  }

  /** `once`, sped up if the clip wouldn't fit in `withinMs`. Returns how long it will take. */
  onceWithin(name: string, withinMs: number) {
    const ms = this.clips.get(name)!.duration * 1000;
    const speed = Math.max(1, ms / withinMs);
    this.once(name, speed);
    return ms / speed;
  }

  get playingOnce() {
    return this.shot !== undefined;
  }

  /** On a death clip, from `once` with `held` until `respawn` or `reappear`. */
  get downed() {
    return this.held;
  }

  /** Walking, including a step the patch has brought but no frame has shown yet. */
  get moving() {
    const { tile, to } = this;
    return this.running || tile.x !== to.x || tile.y !== to.z;
  }

  private endShot() {
    this.shot = undefined;
    this.playBase();
  }

  private playBase() {
    this.play(
      this.base,
      this.base === this.gait.move ? this.gait.moveSpeed : 1,
    );
  }

  /** Holds a death clip, then sinks out of sight. */
  dieAndSink(clip: string) {
    this.once(clip, 1, true);
    this.sinks = true;
  }

  /** Jumps to its tile, wherever it died, and lets go of the death clip. */
  private backOnTile() {
    const { to, tile } = this;
    to.set(tile.x, to.y, tile.y);
    this.from.copy(to);
    this.slideStart = -Infinity;
    this.shot = undefined;
    this.held = this.sinks = this.sinking = false;
    this.sunk = 0;
  }

  /** Back from the dead, rising from the ground. A Skeleton has sunk from sight first. */
  respawn() {
    this.backOnTile();
    this.model.visible = true;
    this.once("Spawn_Ground");
  }

  /** A Spider back from the dead, scaling up. */
  reappear() {
    this.backOnTile();
    this.growth = 0;
    this.model.visible = true;
    this.playBase();
  }

  /** A red flash. The materials must be this figure's own. */
  flash() {
    const paint = (hex: number) =>
      this.model.traverse((o) => {
        if (o instanceof THREE.Mesh) o.material.emissive?.setHex(hex);
      });
    paint(0xb30d0d);
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => paint(0), FLASH_MS);
  }

  /** A small shove away from whoever hit it, gone in a moment. */
  nudgeFrom({ x, y }: Tile) {
    this.kick
      .set(this.tile.x - x, 0, this.tile.y - y)
      .normalize()
      .multiplyScalar(NUDGE);
  }

  /** Call once a frame, with the frame's timestamp in ms. */
  update(now: number) {
    const { tile, model, from, to, fightTile } = this;
    const faces = fightTile ?? this.work?.tile;
    const dx = tile.x - to.x;
    const dz = tile.y - to.z;
    if (dx || dz) {
      from.copy(model.position);
      to.set(tile.x, to.y, tile.y);
      this.slideStart = now;
      this.yaw = Math.atan2(dx, dz);
    } else if (
      faces &&
      now - this.slideStart >= SLIDE_MS &&
      (faces.x !== tile.x || faces.y !== tile.y)
    ) {
      this.yaw = Math.atan2(faces.x - tile.x, faces.y - tile.y);
    }
    model.position.lerpVectors(
      from,
      to,
      Math.min((now - this.slideStart) / SLIDE_MS, 1),
    );

    const running = now - this.slideStart < RUN_HOLD_MS;
    const walkingOff =
      running &&
      !this.running &&
      !this.held &&
      now - this.shotFrame > SAME_MOMENT_MS;
    this.running = running;
    const base = running
      ? this.gait.move
      : fightTile
        ? this.alwaysArmed || this.weapon || this.shield
          ? ARMED_STANCE
          : this.gait.fight
        : this.gait.idle;
    const baseChanged = base !== this.base;
    this.base = base;
    if (this.shot && walkingOff) this.endShot();
    else if (baseChanged && !this.shot) this.playBase();

    // Off the clip too, since a success ends the action while its clip still plays.
    const clip = this.shot?.getClip().name;
    for (const [skill, tool] of this.tools)
      tool.visible =
        clip === GATHERING[skill].clip || (this.action === skill && !running);
    if (this.hammer)
      this.hammer.visible =
        clip === "Hammering" || (!!this.work?.hammer && !running);
    // Off the swing too, since the killing blow ends the fight while its clip still plays.
    const inFight =
      !this.held &&
      !this.tools.some(([, tool]) => tool.visible) &&
      !this.hammer?.visible &&
      (GEAR_CLIPS.has(clip!) || (!!fightTile && !running));
    for (const [item, held] of this.gear)
      held.visible = inFight && (item === this.weapon || item === this.shield);

    const dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    this.mixer.update(dt);

    const turn = this.yaw - model.rotation.y;
    model.rotation.y +=
      Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * TURN_RATE);

    this.kick.multiplyScalar(Math.max(0, 1 - dt * NUDGE_DECAY));
    model.position.add(this.kick);
    if (this.sinking) {
      this.sunk += dt * SINK_SPEED;
      model.position.y -= this.sunk;
      if (this.sunk > SINK_DEPTH) model.visible = false;
    }
    if (this.growth < 1) {
      this.growth = Math.min(1, this.growth + dt * GROW_SPEED);
      model.scale.setScalar(this.fullScale * this.growth);
    }
  }
}

function fit(model: THREE.Object3D, scaleFor: (size: THREE.Vector3) => number) {
  // A skinned mesh's box comes from its bones, so they must be current before measuring.
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  const box = new THREE.Box3().setFromObject(model);
  const scale = scaleFor(box.getSize(new THREE.Vector3()));
  model.scale.setScalar(scale);
  model.position.y = -box.min.y * scale;
}

const VISIBLE_BODY = 1;

// Only where something is in front (GreaterDepth), brightest at the model's edges, each pixel once.
const seeThroughMaterial = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  depthFunc: THREE.GreaterDepth,
  stencilWrite: true,
  stencilRef: VISIBLE_BODY,
  stencilFunc: THREE.NotEqualStencilFunc,
  stencilZPass: THREE.ReplaceStencilOp,
  vertexShader: /* glsl */ `
    #include <common>
    #include <skinning_pars_vertex>
    varying vec3 viewNormal;
    void main() {
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      viewNormal = normalize(normalMatrix * objectNormal);
      #include <begin_vertex>
      #include <skinning_vertex>
      #include <project_vertex>
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 viewNormal;
    void main() {
      // The camera is orthographic, so it looks down view space's z everywhere.
      float edge = 1.0 - abs(normalize(viewNormal).z);
      gl_FragColor = vec4(vec3(1.0), 0.08 + 0.6 * edge * edge);
    }`,
});

/** Shows a soft outline of the model wherever something hides it, by a second draw of each of its meshes. */
export function addSeeThroughOutline(model: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  for (const mesh of meshes) {
    Object.assign(mesh.material, {
      stencilWrite: true,
      stencilRef: VISIBLE_BODY,
      stencilZPass: THREE.ReplaceStencilOp,
    });
    // After the scenery, or it marks pixels a tree then paints over.
    mesh.renderOrder = 1;
    const outline = mesh.clone(false);
    outline.material = seeThroughMaterial;
    outline.castShadow = false;
    mesh.parent!.add(outline);
  }
}

const load = (file: string) =>
  new GLTFLoader().loadAsync(`/models/${file}.glb`);
const loadGltf = (file: string) =>
  new GLTFLoader().loadAsync(`/models/${file}.gltf`);
const castShadows = (model: THREE.Object3D) =>
  model.traverse((o) => (o.castShadow = o instanceof THREE.Mesh));

let clipsLoaded: Promise<Map<string, THREE.AnimationClip>> | undefined;
/** The clip packs, loaded once for everyone who shares them. */
const loadClips = () =>
  (clipsLoaded ??= Promise.all(CLIP_PACKS.map(load)).then(
    (packs) =>
      new Map(packs.flatMap((pack) => pack.animations).map((c) => [c.name, c])),
  ));

/** A tint multiplies, so the pack's dark blue blades would stay dark: it goes over a grey copy of the atlas. */
function greyVersion(map: THREE.Texture) {
  const image = map.image as ImageBitmap;
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d")!;
  // shortcut: a browser without canvas filters (Safari) tints the unchanged atlas, so go per pixel if anyone plays there.
  context.filter = "grayscale(1) brightness(1.5)";
  context.drawImage(image, 0, 0);
  const grey = new THREE.CanvasTexture(canvas);
  grey.flipY = map.flipY;
  grey.colorSpace = map.colorSpace;
  return grey;
}

export function paintGear(
  model: THREE.Object3D,
  { tint, glow }: TierLook,
  grey: THREE.Texture,
) {
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.material.map = grey;
    o.material.color.setHex(tint);
    if (glow !== undefined) {
      o.material.emissive.setHex(glow);
      o.material.emissiveIntensity = GLOW_INTENSITY;
    }
  });
}

/** Loads the characters and clip packs once; every Figure it then makes shares them. */
export async function loadCharacters() {
  const gearLooks = Object.entries(GEAR_LOOKS);
  const [knight, barbarian, pickaxe, axe, hammer, clips, gear] =
    await Promise.all([
      load("Knight"),
      load("Barbarian"),
      loadGltf(GATHERING_TOOLS.mining),
      loadGltf(GATHERING_TOOLS.woodcutting),
      loadGltf("hammer"),
      loadClips(),
      Promise.all(gearLooks.map(([, { file }]) => loadGltf(file))),
    ]);
  const models = { Knight: knight.scene, Barbarian: barbarian.scene };
  Object.values(models).forEach((m) => fit(m, (size) => HEIGHT / size.y));
  // Every Figure's clone carries its own, and shows it only during the action.
  for (const [tool, name] of [
    [pickaxe, GATHERING_TOOLS.mining],
    [axe, GATHERING_TOOLS.woodcutting],
    [hammer, HAMMER],
  ] as const) {
    tool.scene.name = name;
    tool.scene.visible = false;
    castShadows(tool.scene);
    Object.values(models).forEach((m) =>
      m.getObjectByName("handslotr")!.add(tool.scene.clone()),
    );
  }
  // The same: each clone carries every tier, sharing its materials, and shows what's worn only in a fight.
  let grey: THREE.Texture | undefined;
  gearLooks.forEach(([item, look], i) => {
    const { scene: held } = gear[i]!;
    held.name = item;
    held.visible = false;
    castShadows(held);
    held.traverse((o) => {
      // All six share one atlas.
      if (o instanceof THREE.Mesh) grey ??= greyVersion(o.material.map);
    });
    paintGear(held, look, grey!);
    Object.values(models).forEach((m) =>
      m.getObjectByName(look.hand)!.add(held.clone()),
    );
  });
  return (tile: Tile, name: string) =>
    new Figure(tile, cloneSkinned(models[characterFor(name)]), clips);
}

/** Models no player has, so villagers read apart (spec D18). */
const VILLAGER_MODELS = {
  odo: "Ranger",
  marta: "Rogue",
  aldous: "Mage",
  bram: "Rogue_Hooded",
  // Every KayKit adventurer is taken, and Tamsin stands far from Marta.
  tamsin: "Rogue",
} satisfies Record<VillagerId, string>;

/** What a villager holds, by their model's node name for it. */
const VILLAGER_TOOLS: Partial<Record<VillagerId, string>> = {
  odo: "hammer",
  bram: "axe",
};

/** A villager on their tile, holding their tool if they have one. */
export async function loadVillager(tile: Tile, villager: VillagerId) {
  const [{ scene }, clips] = await Promise.all([
    load(VILLAGER_MODELS[villager]),
    loadClips(),
  ]);
  fit(scene, (size) => HEIGHT / size.y);
  const held = VILLAGER_TOOLS[villager];
  if (held) {
    const tool = (await loadGltf(held)).scene;
    castShadows(tool);
    scene.getObjectByName("handslotr")!.add(tool);
  }
  return new Figure(tile, scene, clips);
}

/** So a hit's red flash shows on this enemy alone. */
function withOwnMaterials(model: THREE.Object3D) {
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) o.material = o.material.clone();
  });
  return model;
}

/** Loads the Skeleton once. Every Figure it then makes shares the players' clips (spec D16). */
export async function loadSkeletons() {
  const [{ scene }, blade, clips] = await Promise.all([
    load("Skeleton_Warrior"),
    loadGltf("Skeleton_Blade"),
    loadClips(),
  ]);
  fit(scene, (size) => HEIGHT / size.y);
  castShadows(blade.scene);
  scene.getObjectByName("handslotr")!.add(blade.scene);
  return (tile: Tile) => {
    const figure = new Figure(
      tile,
      withOwnMaterials(cloneSkinned(scene)),
      clips,
    );
    figure.alwaysArmed = true;
    return figure;
  };
}

export function fitSpider(model: THREE.Object3D) {
  fit(model, (size) => SPIDER_WIDTH / Math.max(size.x, size.z));
}

/** Loads the Spider once; every Figure it then makes shares its clips. */
export async function loadSpiders() {
  const { scene, animations } = await load("Spider");
  fitSpider(scene);
  const clips = new Map(animations.map((c) => [c.name, c]));
  return (tile: Tile) =>
    new Figure(tile, withOwnMaterials(cloneSkinned(scene)), clips, SPIDER_GAIT);
}
