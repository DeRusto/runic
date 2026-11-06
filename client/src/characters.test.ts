import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { describe, expect, it, test, vi } from "vitest";
import {
  addSeeThroughOutline,
  characterFor,
  Figure,
  fitSpider,
  SPIDER_GAIT,
} from "./characters.ts";

const PICK_UP_S = 1.296;
const CLIPS = new Map(
  ["Idle_A", "Running_A", "Spider_Idle", "Spider_Walk"].map((name) => [
    name,
    new THREE.AnimationClip(name, 1, []),
  ]),
);
CLIPS.set("PickUp", new THREE.AnimationClip("PickUp", PICK_UP_S, []));
const DEATH_S = 1.5;
CLIPS.set("Death_A", new THREE.AnimationClip("Death_A", DEATH_S, []));
CLIPS.set("Spawn_Ground", new THREE.AnimationClip("Spawn_Ground", 1, []));
const PICKAXING_S = 3.733;
CLIPS.set("Pickaxing", new THREE.AnimationClip("Pickaxing", PICKAXING_S, []));

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

test("a see-through outline redraws each mesh beside it, skeleton included, with no second shadow", () => {
  const bone = new THREE.Bone();
  const skeleton = new THREE.Skeleton([bone]);
  const body = new THREE.SkinnedMesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial(),
  );
  body.castShadow = true;
  body.bind(skeleton);
  const sword = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial(),
  );
  const model = new THREE.Group().add(body, bone);
  bone.add(sword);

  addSeeThroughOutline(model);

  const outline = model.children.find(
    (o) => o !== body && o instanceof THREE.SkinnedMesh,
  ) as THREE.SkinnedMesh;
  expect(outline.skeleton).toBe(skeleton);
  expect(outline.castShadow).toBe(false);
  expect(bone.children).toHaveLength(2);
  expect(body.material.stencilWrite).toBe(true);
  expect(outline.material).not.toBe(body.material);
});

test("a Spider dead when first seen is hidden, counts as down, and can come back", () => {
  const figure = figureAt({ x: 1, y: 1 });
  figure.alreadyGone("Death_A");
  expect(figure.model.visible).toBe(false);
  expect(figure.downed).toBe(true);

  figure.reappear();
  expect(figure.model.visible).toBe(true);
  expect(figure.downed).toBe(false);
});

describe("a player already dead when first seen", () => {
  const deathClip = (figure: Figure) =>
    figure.mixer.clipAction(CLIPS.get("Death_A")!);

  it("lies in the clip's last pose, with no fall to watch", () => {
    const figure = figureAt({ x: 1, y: 1 });
    figure.alreadyDown("Death_A");
    figure.update(16);
    expect(figure.downed).toBe(true);
    expect(deathClip(figure).time).toBe(DEATH_S);
    figure.update(32);
    expect(deathClip(figure).time).toBe(DEATH_S);
    expect(figure.downed).toBe(true);
  });

  it("gets up when the respawn comes", () => {
    const figure = figureAt({ x: 1, y: 1 });
    figure.alreadyDown("Death_A");
    figure.update(16);
    figure.respawn();
    expect(figure.downed).toBe(false);
    expect(clipState(figure, "Spawn_Ground").running).toBe(true);
  });
});

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

  it("is moving from the moment its tile changes until its slide and run hold end", () => {
    const tile = { x: 0, y: 0 };
    const figure = figureAt(tile);
    figure.update(0);
    expect(figure.moving).toBe(false);

    tile.x = 1;
    expect(figure.moving).toBe(true); // Before the next frame has seen it.
    figure.update(100);
    expect(figure.moving).toBe(true);
    figure.update(2000);
    expect(figure.moving).toBe(false);
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

describe("Figure.onceWithin", () => {
  const started = (tile = { x: 0, y: 0 }, withinMs = 2400) => {
    const figure = figureAt(tile);
    figure.update(0);
    const ms = figure.onceWithin("PickUp", withinMs);
    figure.update(0);
    return { figure, ms };
  };

  it("plays at its own speed when it fits, and says how long it takes", () => {
    const { figure, ms } = started();
    expect(clipState(figure, "PickUp").speed).toBe(1);
    expect(ms).toBeCloseTo(PICK_UP_S * 1000);
  });

  it("speeds up to fit a shorter time: 1.08x at 4 ticks", () => {
    const { figure, ms } = started(undefined, 1200);
    expect(clipState(figure, "PickUp").speed).toBeCloseTo(1.08);
    expect(ms).toBeCloseTo(1200);
  });

  it("returns to Idle_A when it finishes, once", () => {
    const { figure } = started();
    figure.update(500);
    expect(clipState(figure, "PickUp").running).toBe(true);
    figure.update(1400);
    figure.update(1600);
    expect(clipState(figure, "Idle_A").weight).toBe(1);
    expect(clipState(figure, "PickUp").running).toBe(false);
  });

  it("isn't overridden by the slide of the step it arrived on ending", () => {
    const tile = { x: 0, y: 0 };
    const figure = figureAt(tile);
    figure.update(0);
    tile.x = 1;
    figure.onceWithin("PickUp", 2400);
    figure.update(0);
    expect(clipState(figure, "PickUp").running).toBe(true);
    figure.update(100);
    figure.update(700);
    expect(clipState(figure, "PickUp").weight).toBe(1);
    expect(clipState(figure, "Idle_A").weight).toBe(0);
  });

  it("is cut short by a new step", () => {
    const tile = { x: 0, y: 0 };
    const { figure } = started(tile);
    figure.update(500);
    tile.x = 1;
    figure.update(600);
    figure.update(800);
    expect(clipState(figure, "Running_A").weight).toBe(1);
    expect(clipState(figure, "PickUp").running).toBe(false);
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

describe("fight clips", () => {
  const FIGHT_CLIPS = new Map(
    [
      "Idle_A",
      "Running_A",
      "Melee_Unarmed_Idle",
      "Melee_Unarmed_Attack_Punch_A",
      "Spider_Idle",
      "Spider_Walk",
      "Spider_Death",
      "Death_A",
      "Spawn_Ground",
    ].map((name) => [name, new THREE.AnimationClip(name, 1, [])]),
  );
  const weight = (figure: Figure, name: string) =>
    figure.mixer.clipAction(FIGHT_CLIPS.get(name)!).getEffectiveWeight();
  const PUNCH = "Melee_Unarmed_Attack_Punch_A";

  const fighter = (tile = { x: 0, y: 0 }) => {
    const figure = new Figure(tile, new THREE.Object3D(), FIGHT_CLIPS);
    figure.update(1000);
    return figure;
  };

  test("stands in the fight stance while it has a target, and idles after", () => {
    const figure = fighter();
    figure.fightTile = { x: 1, y: 0 };
    figure.update(1000);
    figure.update(1200);
    expect(weight(figure, "Melee_Unarmed_Idle")).toBe(1);
    figure.fightTile = undefined;
    figure.update(1200);
    figure.update(1400);
    expect(weight(figure, "Idle_A")).toBe(1);
  });

  test("faces its target between moves", () => {
    const figure = fighter();
    figure.fightTile = { x: 1, y: 0 };
    for (let now = 1000; now <= 1600; now += 16) figure.update(now);
    expect(figure.model.rotation.y).toBeCloseTo(Math.PI / 2);
  });

  test("a one-shot plays once, then fades back to what it should be doing", () => {
    const figure = fighter();
    figure.once(PUNCH);
    expect(figure.playingOnce).toBe(true);
    figure.update(1200);
    figure.update(1400);
    expect(weight(figure, PUNCH)).toBe(1);
    figure.update(2000); // The 1 s clip is over.
    expect(figure.playingOnce).toBe(false);
    figure.update(2200);
    expect(weight(figure, "Idle_A")).toBe(1);
  });

  test("a stance change waits for the one-shot to end", () => {
    const figure = fighter();
    figure.once(PUNCH);
    figure.fightTile = { x: 1, y: 0 };
    figure.update(1200);
    figure.update(1400);
    expect(weight(figure, PUNCH)).toBe(1);
    figure.update(2100);
    figure.update(2300);
    expect(weight(figure, "Melee_Unarmed_Idle")).toBe(1);
  });

  test("arriving and swinging at the same moment keeps the swing", () => {
    const tile = { x: 0, y: 0 };
    const figure = fighter(tile);
    figure.once(PUNCH);
    tile.x = 1;
    figure.update(1016);
    expect(figure.playingOnce).toBe(true);
  });

  test("walking off later cuts the swing short", () => {
    const tile = { x: 0, y: 0 };
    const figure = fighter(tile);
    figure.once(PUNCH);
    figure.update(1300);
    tile.x = 1;
    figure.update(1316);
    expect(figure.playingOnce).toBe(false);
    figure.update(1500);
    expect(weight(figure, "Running_A")).toBe(1);
  });

  describe("a Spider's death", () => {
    const dying = (tile = { x: 2, y: 3 }) => {
      const model = new THREE.Object3D();
      model.scale.setScalar(0.5);
      const figure = new Figure(tile, model, FIGHT_CLIPS, SPIDER_GAIT);
      figure.update(1000);
      figure.dieAndSink("Spider_Death");
      return figure;
    };

    test("holds the clip, then sinks, then disappears", () => {
      const figure = dying();
      figure.update(1500);
      expect(figure.model.position.y).toBe(0);
      figure.update(2000); // The 1 s clip is over, and it starts to sink.
      expect(figure.model.position.y).toBeCloseTo(-0.25);
      expect(figure.model.visible).toBe(true);
      expect(weight(figure, "Spider_Death")).toBe(1);
      figure.update(4100);
      expect(figure.model.visible).toBe(false);
    });

    test("it comes back on its tile, not sliding, and scales up to full size", () => {
      const tile = { x: 2, y: 3 };
      const figure = dying(tile);
      figure.update(2000);
      figure.update(5000);
      Object.assign(tile, { x: 7, y: 8 });
      figure.reappear();
      expect(figure.model.visible).toBe(true);
      figure.update(5016);
      expect(figure.model.position.x).toBe(7);
      expect(figure.model.position.y).toBe(0);
      expect(figure.model.scale.x).toBeLessThan(0.1);
      figure.update(5600);
      expect(figure.model.scale.x).toBe(0.5);
      expect(weight(figure, "Spider_Idle")).toBe(1);
    });
  });

  test("a player's death holds, then the respawn jumps to the new tile and plays through to idle", () => {
    const tile = { x: 2, y: 3 };
    const figure = fighter(tile);
    figure.once("Death_A", 1, true);
    figure.update(1500);
    figure.update(2500); // The 1 s clip is over; it holds, without sinking.
    expect(weight(figure, "Death_A")).toBe(1);
    expect(figure.model.visible).toBe(true);

    Object.assign(tile, { x: 7, y: 8 });
    figure.update(2600); // A frame can land between the patch and the event.
    figure.respawn();
    figure.update(2700);
    expect(figure.model.position.x).toBe(7);
    expect(figure.model.position.z).toBe(8);
    expect(weight(figure, "Spawn_Ground")).toBeGreaterThan(0);
    figure.update(3800); // The 1 s clip is over.
    figure.update(4000);
    expect(weight(figure, "Idle_A")).toBe(1);
  });

  test("a nudge shoves it away from the attacker, and fades", () => {
    const figure = new Figure(
      { x: 2, y: 0 },
      new THREE.Object3D(),
      FIGHT_CLIPS,
      SPIDER_GAIT,
    );
    figure.update(1000);
    figure.nudgeFrom({ x: 1, y: 0 });
    figure.update(1010);
    expect(figure.model.position.x).toBeGreaterThan(2.1);
    figure.update(1500);
    figure.update(2000);
    expect(figure.model.position.x).toBe(2);
  });

  test("a flash turns its materials red, then back", () => {
    vi.useFakeTimers();
    const material = new THREE.MeshStandardMaterial();
    const figure = new Figure(
      { x: 0, y: 0 },
      new THREE.Mesh(new THREE.BoxGeometry(), material),
      FIGHT_CLIPS,
      SPIDER_GAIT,
    );
    figure.flash();
    expect(material.emissive.r).toBeGreaterThan(0.3);
    vi.advanceTimersByTime(200);
    expect(material.emissive.r).toBe(0);
    vi.useRealTimers();
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

describe("working at a station", () => {
  const worker = (tile = { x: 1, y: 1 }) => {
    const hammer = new THREE.Object3D();
    hammer.name = "hammer in hand";
    const model = new THREE.Object3D().add(hammer);
    return { hammer, figure: new Figure(tile, model, CLIPS) };
  };
  const WORK_CLIPS = ["Hammering", "Working_A"];
  WORK_CLIPS.forEach((name) =>
    CLIPS.set(name, new THREE.AnimationClip(name, 2, [])),
  );

  test("faces the station between moves", () => {
    const { figure } = worker();
    figure.work = { tile: { x: 2, y: 1 }, hammer: false };
    for (let now = 1000; now <= 1600; now += 16) figure.update(now);
    expect(figure.model.rotation.y).toBeCloseTo(Math.PI / 2);
  });

  test("the hammer shows while Hammering plays, even once the action has ended", () => {
    const { figure, hammer } = worker();
    figure.update(1000);
    expect(hammer.visible).toBe(false);
    figure.onceWithin("Hammering", 3600);
    figure.update(1010);
    expect(hammer.visible).toBe(true);
    figure.update(3500);
    figure.update(3510);
    expect(hammer.visible).toBe(false);
  });

  test("the hammer stays out between items at the anvil, but not on the walk there", () => {
    const tile = { x: 1, y: 1 };
    const { figure, hammer } = worker(tile);
    figure.work = { tile: { x: 3, y: 1 }, hammer: true };
    tile.x = 2;
    figure.update(1000);
    expect(hammer.visible).toBe(false);
    figure.update(2000);
    expect(hammer.visible).toBe(true);
    figure.work = undefined;
    figure.update(2010);
    expect(hammer.visible).toBe(false);
  });

  test("the furnace keeps hands empty", () => {
    const { figure, hammer } = worker();
    figure.work = { tile: { x: 2, y: 1 }, hammer: false };
    figure.onceWithin("Working_A", 1800);
    figure.update(1000);
    expect(hammer.visible).toBe(false);
  });

  test("a figure's own model of a hammer isn't the one that hides", () => {
    const ownHammer = new THREE.Object3D();
    ownHammer.name = "hammer";
    const figure = new Figure(
      { x: 1, y: 1 },
      new THREE.Object3D().add(ownHammer),
      CLIPS,
    );
    figure.update(1000);
    expect(ownHammer.visible).toBe(true);
  });

  test("the committed clip pack has both clips", () => {
    const glb = readFileSync("client/public/models/Rig_Medium_Tools.glb");
    for (const name of WORK_CLIPS)
      expect(glb.toString("latin1")).toContain(`"name":"${name}"`);
  });
});

describe("the pickaxe in hand", () => {
  const miner = (tile = { x: 1, y: 1 }) => {
    const pickaxe = new THREE.Object3D();
    pickaxe.name = "pickaxe";
    const model = new THREE.Object3D().add(pickaxe);
    return { pickaxe, figure: new Figure(tile, model, CLIPS) };
  };

  test("shows only while Pickaxing plays, even once the action has ended", () => {
    const { figure, pickaxe } = miner();
    figure.update(1000);
    expect(pickaxe.visible).toBe(false);
    figure.onceWithin("Pickaxing", 2400);
    figure.update(1010);
    expect(pickaxe.visible).toBe(true);
    figure.update(3500);
    figure.update(3510);
    expect(pickaxe.visible).toBe(false);
  });

  test("stays out between attempts on the mining action, but not on the walk there", () => {
    const tile = { x: 1, y: 1 };
    const { figure, pickaxe } = miner(tile);
    figure.mining = true;
    tile.x = 2;
    figure.update(1000);
    expect(pickaxe.visible).toBe(false);
    figure.update(2000);
    expect(pickaxe.visible).toBe(true);
    figure.mining = false;
    figure.update(2010);
    expect(pickaxe.visible).toBe(false);
  });

  test("another clip puts it away", () => {
    const { figure, pickaxe } = miner();
    figure.onceWithin("Pickaxing", 2400);
    figure.update(1000);
    figure.once("PickUp");
    figure.update(1010);
    expect(pickaxe.visible).toBe(false);
  });

  test("a figure with no pickaxe is fine", () => {
    const figure = figureAt({ x: 1, y: 1 });
    figure.onceWithin("Pickaxing", 2400);
    expect(() => figure.update(1000)).not.toThrow();
  });

  test("the clip is sped up to fit one attempt", () => {
    expect(miner().figure.onceWithin("Pickaxing", 2400)).toBeCloseTo(2400);
  });

  test("the committed clip pack has Pickaxing", () => {
    const glb = readFileSync("client/public/models/Rig_Medium_Tools.glb");
    expect(glb.toString("latin1")).toContain('"name":"Pickaxing"');
  });
});
