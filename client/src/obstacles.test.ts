import { parseRegion } from "@runic/shared";
import * as THREE from "three";
import { describe, expect, test, vi } from "vitest";
import { addObstacles } from "./obstacles.ts";
import { scene } from "./scene.ts";

// The real scene module starts a WebGL renderer; a bare scene is all these rays need.
vi.mock("./scene.ts", async () => {
  const { Scene } = await import("three");
  return { scene: new Scene() };
});

/** The Bramble swing placed at (5,1), its far end three tiles west at (2,1). */
function swing() {
  const tiles = parseRegion("TTTTTTTT\nT......T\nTTTTTTTT");
  tiles[1]![5] = { ...tiles[1]![5]!, obstacle: "brambleSwing" };
  const obstacleUnder = addObstacles(tiles);
  scene.updateMatrixWorld(true);
  return obstacleUnder;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A click's ray onto the ground at (x, y), seen from the game camera's offset at `quarters` turns. */
function cameraRay(x: number, y: number, quarters: number) {
  const target = new THREE.Vector3(x, 0, y);
  const offset = new THREE.Vector3(20, 20, 20).applyAxisAngle(
    UP,
    (quarters * Math.PI) / 2,
  );
  return new THREE.Raycaster(
    target.clone().add(offset),
    offset.clone().negate().normalize(),
  );
}

/** The Charred fence placed at (2,1), its far end two tiles south at (2,3). */
function fence() {
  const tiles = parseRegion("TTTTT\nT...T\nT...T\nT...T\nTTTTT");
  tiles[1]![2] = { ...tiles[1]![2]!, obstacle: "charredFence" };
  const obstacleUnder = addObstacles(tiles);
  scene.updateMatrixWorld(true);
  return obstacleUnder;
}

describe("clicking a shortcut", () => {
  test.each([0, 1, 2, 3])(
    "on either end of the short Charred fence, with the camera at %i quarter turns, marks that end",
    (quarters) => {
      const obstacleUnder = fence();
      // Near each corner of a marker, which is 0.82 wide and 0.65 deep.
      for (const [dx, dy] of [
        [-0.35, -0.28],
        [-0.35, 0.28],
        [0.35, -0.28],
        [0.35, 0.28],
      ] as const)
        for (const end of [
          { x: 2, y: 1 },
          { x: 2, y: 3 },
        ])
          expect(
            obstacleUnder(cameraRay(end.x + dx, end.y + dy, quarters)),
          ).toMatchObject(end);
    },
  );

  test.each([0, 1, 2, 3])(
    "on either end's marker, with the camera at %i quarter turns, crosses from that end",
    (quarters) => {
      const obstacleUnder = swing();
      expect(obstacleUnder(cameraRay(5, 1, quarters))).toEqual({
        obstacle: "brambleSwing",
        x: 5,
        y: 1,
      });
      expect(obstacleUnder(cameraRay(2, 1, quarters))).toEqual({
        obstacle: "brambleSwing",
        x: 2,
        y: 1,
      });
    },
  );

  test("on the swing's rope, high above the ground, still finds the shortcut", () => {
    const obstacleUnder = swing();
    expect(
      obstacleUnder(
        new THREE.Raycaster(
          new THREE.Vector3(3.5, 1.6, -5),
          new THREE.Vector3(0, 0, 1),
        ),
      ),
    ).toMatchObject({ obstacle: "brambleSwing" });
  });
});
