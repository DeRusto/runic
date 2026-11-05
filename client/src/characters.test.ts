import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it } from "vitest";
import { characterFor, Figure, fitSpider, SPIDER_GAIT } from "./characters.ts";

const CLIPS = new Map(
  ["Idle_A", "Running_A", "Spider_Idle", "Spider_Walk"].map((name) => [
    name,
    new THREE.AnimationClip(name, 1, []),
  ]),
);

function figureAt(tile: { x: number; y: number }) {
  return new Figure(tile, new THREE.Object3D(), CLIPS);
}

function clipState(figure: Figure, name: string) {
  const action = figure.mixer.clipAction(CLIPS.get(name)!);
  return {
    running: action.isRunning(),
    weight: action.getEffectiveWeight(),
    speed: action.getEffectiveTimeScale(),
  };
}

describe("characterFor", () => {
  it("gives a name the same character every time", () => {
    expect(characterFor("alice")).toBe(characterFor("alice"));
  });

  it("gives both characters across a group of names", () => {
    const names = Array.from({ length: 100 }, (_, i) => `player${i}`);
    const knights = names.filter((n) => characterFor(n) === "Knight").length;
    const barbarians = names.filter(
      (n) => characterFor(n) === "Barbarian",
    ).length;
    expect(knights + barbarians).toBe(100);
    expect(knights).toBeGreaterThan(25);
    expect(barbarians).toBeGreaterThan(25);
  });
});

describe("Figure", () => {
  it("stands on its tile playing Idle_A", () => {
    const figure = figureAt({ x: 3, y: 4 });
    figure.update(16);
    expect(figure.model.position.x).toBe(3);
    expect(figure.model.position.z).toBe(4);
    expect(clipState(figure, "Idle_A")).toMatchObject({
      running: true,
      weight: 1,
      speed: 1,
    });
  });

  it("runs at 2x, crossfading over 0.12 s, when its tile changes", () => {
    const tile = { x: 0, y: 0 };
    const figure = figureAt(tile);
    figure.update(0);

    tile.x = 1;
    figure.update(0);
    figure.update(60);
    expect(clipState(figure, "Running_A").speed).toBe(2);
    expect(clipState(figure, "Running_A").weight).toBeCloseTo(0.5);
    expect(clipState(figure, "Idle_A").weight).toBeCloseTo(0.5);

    figure.update(120);
    expect(clipState(figure, "Running_A").weight).toBe(1);
    expect(clipState(figure, "Idle_A").weight).toBe(0);
  });

  it("slides to the new tile over 600 ms", () => {
    const tile = { x: 0, y: 0 };
    const figure = figureAt(tile);
    figure.update(0);

    tile.x = 1;
    figure.update(1000);
    figure.update(1300);
    expect(figure.model.position.x).toBeCloseTo(0.5);
    figure.update(1600);
    expect(figure.model.position.x).toBe(1);
  });

  it("keeps running between tiles of a walk, then returns to Idle_A", () => {
    const tile = { x: 0, y: 0 };
    const figure = figureAt(tile);
    figure.update(0);

    tile.x = 1;
    figure.update(0);
    // The next step's patch can land a little after the 600 ms slide ends.
    figure.update(620);
    expect(clipState(figure, "Running_A").weight).toBe(1);

    figure.update(800);
    figure.update(1000);
    expect(clipState(figure, "Idle_A").weight).toBe(1);
    expect(clipState(figure, "Running_A").running).toBe(false);
  });

  it.each([
    { to: { x: 1, y: 0 }, yaw: Math.PI / 2 },
    { to: { x: -1, y: 0 }, yaw: -Math.PI / 2 },
    { to: { x: 0, y: 1 }, yaw: 0 },
    { to: { x: 1, y: -1 }, yaw: (3 * Math.PI) / 4 },
  ])("turns to face its move to $to", ({ to, yaw }) => {
    const tile = { x: 0, y: 0 };
    const figure = figureAt(tile);
    figure.update(0);

    Object.assign(tile, to);
    for (let now = 0; now <= 600; now += 16) figure.update(now);
    expect(figure.model.rotation.y).toBeCloseTo(yaw);
  });
});

describe("a Spider's Figure", () => {
  it("idles on Spider_Idle and moves on Spider_Walk looped at 2.9x", () => {
    const tile = { x: 0, y: 0 };
    const figure = new Figure(tile, new THREE.Object3D(), CLIPS, SPIDER_GAIT);
    figure.update(16);
    expect(clipState(figure, "Spider_Idle").running).toBe(true);

    tile.x = 1;
    figure.update(16);
    expect(clipState(figure, "Spider_Walk").running).toBe(true);
    expect(clipState(figure, "Spider_Walk").speed).toBe(2.9);

    figure.update(1000);
    figure.update(1200);
    expect(clipState(figure, "Spider_Idle").weight).toBe(1);
  });
});

describe("Spider.glb", () => {
  const load = async () => {
    const { buffer } = readFileSync("client/public/models/Spider.glb");
    return new GLTFLoader().parseAsync(buffer as ArrayBuffer, "");
  };

  it("has the clips the spec names, and opaque materials", async () => {
    const { scene, animations } = await load();
    expect(animations.map((clip) => clip.name)).toEqual(
      expect.arrayContaining([
        "Spider_Idle",
        "Spider_Walk",
        "Spider_Attack",
        "Spider_Death",
      ]),
    );
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const material of [o.material].flat()) {
        expect(material.opacity).toBe(1);
        expect(material.transparent).toBe(false);
      }
    });
  });

  it("fits to about 1.1 units wide, standing on the ground", async () => {
    const { scene } = await load();
    fitSpider(scene);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.z)).toBeCloseTo(1.1);
    expect(box.min.y).toBeCloseTo(0);
  });
});
