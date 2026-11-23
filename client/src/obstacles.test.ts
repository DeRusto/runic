import { parseRegion } from "@runic/shared";
import * as THREE from "three";
import { describe, expect, test, vi } from "vitest";

// The real scene module starts a WebGL renderer; a bare scene is all these rays need.
const { scene } = vi.hoisted(() => ({
  scene: new (require("three") as typeof import("three")).Scene(),
}));
vi.mock("./scene.ts", () => ({ scene }));

const { addObstacles } = await import("./obstacles.ts");

/** The Bramble swing placed at (5,1), its far end three tiles west at (2,1). */
function swing() {
  const tiles = parseRegion("TTTTTTTT\nT......T\nTTTTTTTT");
  tiles[1]![5] = { ...tiles[1]![5]!, obstacle: "brambleSwing" };
  const obstacleUnder = addObstacles(tiles);
  scene.updateMatrixWorld(true);
  return obstacleUnder;
}

const ray = (origin: THREE.Vector3, direction: THREE.Vector3) =>
  new THREE.Raycaster(origin, direction.normalize());
const down = (x: number, y: number) =>
  ray(new THREE.Vector3(x, 10, y), new THREE.Vector3(0, -1, 0));

describe("clicking a shortcut", () => {
  test("on either end's marker crosses from that end", () => {
    const obstacleUnder = swing();
    expect(obstacleUnder(down(5, 1))).toEqual({
      obstacle: "brambleSwing",
      x: 5,
      y: 1,
    });
    expect(obstacleUnder(down(2, 1))).toEqual({
      obstacle: "brambleSwing",
      x: 2,
      y: 1,
    });
  });

  test("on the swing's rope, high above the ground, still finds the shortcut", () => {
    const obstacleUnder = swing();
    expect(
      obstacleUnder(
        ray(new THREE.Vector3(3.5, 1.6, -5), new THREE.Vector3(0, 0, 1)),
      ),
    ).toMatchObject({ obstacle: "brambleSwing" });
  });
});
