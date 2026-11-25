import * as THREE from "three";
import { expect, test, vi } from "vitest";
import type { Figure } from "./characters.ts";
import { showThorn } from "./enemies.ts";
import { scene } from "./scene.ts";

vi.mock("./scene.ts", () => ({ scene: new THREE.Scene() }));

test("a flying thorn follows the target's rendered movement until contact", () => {
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  const now = vi.spyOn(performance, "now").mockReturnValue(0);
  const enemy = new THREE.Group();
  const player = new THREE.Group();
  player.position.x = 4;
  scene.add(enemy, player);
  try {
    showThorn({ model: enemy } as Figure, { model: player } as Figure, 650);
    frame!(450);
    const thorn = scene.children[2]!;
    expect(thorn.position.x).toBeCloseTo(4 / 3);

    player.position.set(4, 0, 3);
    frame!(600);
    expect(thorn.position.x).toBeCloseTo(10 / 3);
    expect(thorn.position.z).toBeCloseTo(2.5);

    frame!(650);
    expect(thorn.parent).toBeNull();
  } finally {
    scene.clear();
    now.mockRestore();
    vi.unstubAllGlobals();
  }
});
