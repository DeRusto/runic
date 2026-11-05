import { TICK_MS, WALK_TICKS_PER_TILE, type Tile } from "@runic/shared";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

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
];

/** Which character a player is follows from their name alone, so nothing about it is stored. */
export function characterFor(name: string) {
  let hash = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < name.length; i++) {
    hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193);
  }
  // FNV's low bit just follows the input's, so mix before reading it.
  return CHARACTERS[(hash ^ (hash >>> 15)) & 1];
}

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
  /** The tile of whoever this figure is fighting. It sets the stance, and faces them between moves. */
  fightTile?: Tile;

  constructor(
    private tile: Tile,
    readonly model: THREE.Object3D,
    private clips: Map<string, THREE.AnimationClip>,
    private gait = PLAYER_GAIT,
  ) {
    model.position.set(tile.x, model.position.y, tile.y);
    this.from = model.position.clone();
    this.to = model.position.clone();
    this.fullScale = model.scale.x;
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

  /** A player back from the dead, rising from the ground. */
  respawn() {
    this.backOnTile();
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
    setTimeout(() => paint(0), FLASH_MS);
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
    const dx = tile.x - to.x;
    const dz = tile.y - to.z;
    if (dx || dz) {
      from.copy(model.position);
      to.set(tile.x, to.y, tile.y);
      this.slideStart = now;
      this.yaw = Math.atan2(dx, dz);
    } else if (
      fightTile &&
      now - this.slideStart >= SLIDE_MS &&
      (fightTile.x !== tile.x || fightTile.y !== tile.y)
    ) {
      this.yaw = Math.atan2(fightTile.x - tile.x, fightTile.y - tile.y);
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
        ? this.gait.fight
        : this.gait.idle;
    const baseChanged = base !== this.base;
    this.base = base;
    if (this.shot && walkingOff) this.endShot();
    else if (baseChanged && !this.shot) this.playBase();

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

/** Loads the characters and clip packs once; every Figure it then makes shares them. */
export async function loadCharacters() {
  const loader = new GLTFLoader();
  const load = (file: string) => loader.loadAsync(`/models/${file}.glb`);
  const [knight, barbarian, ...packs] = await Promise.all(
    [...CHARACTERS, ...CLIP_PACKS].map(load),
  );
  const models = { Knight: knight.scene, Barbarian: barbarian.scene };
  Object.values(models).forEach((m) => fit(m, (size) => HEIGHT / size.y));
  const clips = new Map(
    packs.flatMap((pack) => pack.animations).map((c) => [c.name, c]),
  );
  return (tile: Tile, name: string) =>
    new Figure(tile, cloneSkinned(models[characterFor(name)]), clips);
}

export function fitSpider(model: THREE.Object3D) {
  fit(model, (size) => SPIDER_WIDTH / Math.max(size.x, size.z));
}

/** Loads the Spider once; every Figure it then makes shares its clips. */
export async function loadSpiders() {
  const { scene, animations } = await new GLTFLoader().loadAsync(
    "/models/Spider.glb",
  );
  fitSpider(scene);
  const clips = new Map(animations.map((c) => [c.name, c]));
  return (tile: Tile) => {
    const model = cloneSkinned(scene);
    // Its own materials, so a hit's red flash shows on this Spider alone.
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = o.material.clone();
    });
    return new Figure(tile, model, clips, SPIDER_GAIT);
  };
}
