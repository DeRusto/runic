import { Callbacks } from "@colyseus/sdk";
import * as THREE from "three";
import { expect, test, vi } from "vitest";
import { ENEMY_LOOKS, Figure } from "./characters.ts";
import { showEnemies } from "./enemies.ts";
import type { WorldConnection } from "./players.ts";

vi.mock("./scene.ts", () => ({
  scene: new THREE.Scene(),
  camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100),
}));

test("the pointer and figure follow the synced variant, and the bar reads its own maximum", () => {
  type Element = {
    children: Element[];
    hidden: boolean;
    style: Record<string, string>;
    append(...children: Element[]): void;
    remove(): void;
  };
  const makeElement = (): Element => ({
    children: [],
    hidden: false,
    style: {} as Record<string, string>,
    append(...children: Element[]) {
      this.children.push(...children);
    },
    remove() {},
  });
  const overheads = makeElement();
  const tile = {
    x: 0,
    y: 0,
    kind: "spider",
    state: "idle",
    target: "",
    elite: false,
    health: 800,
    maxHealth: 800,
  };
  const ordinaryTile = { ...tile, x: 3 };
  const enemies = new Map([
    ["0", tile],
    ["1", ordinaryTile],
  ]);
  const material = new THREE.MeshStandardMaterial({ color: 0xa0a0a0 });
  const makeFigure = (at: { x: number; y: number }) => {
    const model = new THREE.Mesh(new THREE.BoxGeometry(), material.clone());
    return new Figure(
      at,
      model,
      new Map([["Idle_A", new THREE.AnimationClip("Idle_A", 1, [])]]),
    );
  };
  const models = new Map<number, Figure>();
  const newFigure = (at: { x: number; y: number }) => {
    const figure = makeFigure(at);
    models.set(at.x, figure);
    return figure;
  };
  let frame: FrameRequestCallback;
  let leave = () => {};
  const callbacks = vi.spyOn(Callbacks, "get").mockReturnValue({
    onAdd: (_field: string, add: (enemy: typeof tile, id: string) => void) =>
      enemies.forEach(add),
  } as unknown as ReturnType<typeof Callbacks.get>);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("document", {
    createElement: makeElement,
    getElementById: () => overheads,
  });
  vi.stubGlobal("innerWidth", 800);
  vi.stubGlobal("innerHeight", 600);
  try {
    const enemyUnder = showEnemies(
      {
        state: { enemies, players: new Map() },
        onLeave: (fn: () => void) => {
          leave = fn;
        },
      } as unknown as WorldConnection,
      { spider: newFigure } as Parameters<typeof showEnemies>[1],
    );
    const model = models.get(0)!.model as THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshStandardMaterial
    >;
    const ray = new THREE.Raycaster(
      new THREE.Vector3(0, 4, 0),
      new THREE.Vector3(0, -1, 0),
    );
    const bar = overheads.children[0]!.children[1]!;
    const fill = bar.children[0]!;
    frame!(16);
    expect(model.scale.x).toBe(1);

    Object.assign(tile, { elite: true, health: 1600, maxHealth: 1600 });
    frame!(32);
    expect(enemyUnder(ray)?.name).toBe("Elite Spider");
    expect(model.scale.x).toBe(1.2);
    expect(model.material.color.equals(material.color)).toBe(false);
    const other = models.get(3)!.model as typeof model;
    expect(other.material.color.equals(material.color)).toBe(true);
    expect(bar.hidden).toBe(true);
    expect(fill.style.width).toBe("100%");

    tile.health = 800;
    frame!(48);
    expect(bar.hidden).toBe(false);
    expect(fill.style.width).toBe("50%");

    Object.assign(tile, { elite: false, maxHealth: 800 });
    frame!(64);
    expect(enemyUnder(ray)?.name).toBe(ENEMY_LOOKS.spider.name);
    expect(model.scale.x).toBe(1);
    expect(model.material.color.equals(material.color)).toBe(true);
    expect(bar.hidden).toBe(true);
  } finally {
    leave();
    callbacks.mockRestore();
    vi.unstubAllGlobals();
  }
});
