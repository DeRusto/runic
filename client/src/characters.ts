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

const PLAYER_GAIT = { idle: "Idle_A", move: "Running_A", moveSpeed: 2 };
export const SPIDER_GAIT = {
  idle: "Spider_Idle",
  move: "Spider_Walk",
  moveSpeed: 2.9,
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

  constructor(
    private tile: Tile,
    readonly model: THREE.Object3D,
    private clips: Map<string, THREE.AnimationClip>,
    private gait = PLAYER_GAIT,
  ) {
    model.position.set(tile.x, model.position.y, tile.y);
    this.from = model.position.clone();
    this.to = model.position.clone();
    this.mixer = new THREE.AnimationMixer(model);
    this.play(gait.idle);
  }

  play(name: string, speed = 1) {
    const next = this.mixer.clipAction(this.clips.get(name)!);
    next.reset().setEffectiveTimeScale(speed).play();
    if (this.current) next.crossFadeFrom(this.current, CROSSFADE_S);
    this.current = next;
  }

  /** Call once a frame, with the frame's timestamp in ms. */
  update(now: number) {
    const { tile, model, from, to } = this;
    const dx = tile.x - to.x;
    const dz = tile.y - to.z;
    if (dx || dz) {
      from.copy(model.position);
      to.set(tile.x, to.y, tile.y);
      this.slideStart = now;
      this.yaw = Math.atan2(dx, dz);
    }
    model.position.lerpVectors(
      from,
      to,
      Math.min((now - this.slideStart) / SLIDE_MS, 1),
    );

    const running = now - this.slideStart < RUN_HOLD_MS;
    if (running !== this.running) {
      this.running = running;
      if (running) this.play(this.gait.move, this.gait.moveSpeed);
      else this.play(this.gait.idle);
    }

    const dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    this.mixer.update(dt);

    const turn = this.yaw - model.rotation.y;
    model.rotation.y +=
      Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * TURN_RATE);
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
  return (tile: Tile) =>
    new Figure(tile, cloneSkinned(scene), clips, SPIDER_GAIT);
}
