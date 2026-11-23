import { parseRegion, type ObstacleKind } from "@runic/shared";
import * as THREE from "three";
import { describe, expect, test, vi } from "vitest";
import { addObstacles } from "./obstacles.ts";
import { scene } from "./scene.ts";

// The real scene module starts a WebGL renderer; a bare scene is all these rays need.
vi.mock("./scene.ts", async () => {
  const { Scene } = await import("three");
  return { scene: new Scene() };
});

/** A 7×7 open region with `obstacle` placed at (3,2). */
function placed(obstacle: ObstacleKind) {
  const tiles = parseRegion(
    ["TTTTTTT", ...Array(5).fill("T.....T"), "TTTTTTT"].join("\n"),
  );
  tiles[2]![3] = { ...tiles[2]![3]!, obstacle };
  const obstacleUnder = addObstacles(tiles);
  scene.updateMatrixWorld(true);
  return obstacleUnder;
}

const UP = new THREE.Vector3(0, 1, 0);
/** The game camera's offset at each quarter turn, and one slanted lower and off the diagonal. */
const VIEWS = [
  ...[0, 1, 2, 3].map(
    (quarters) =>
      [
        `the camera at ${quarters} quarter turns`,
        new THREE.Vector3(20, 20, 20).applyAxisAngle(
          UP,
          (quarters * Math.PI) / 2,
        ),
      ] as const,
  ),
  ["a slanted camera", new THREE.Vector3(24, 10, 9)] as const,
];

/** A click's ray onto the ground at (x, y), from a camera at `offset`. */
const clickAt = (x: number, y: number, offset: THREE.Vector3) => {
  const target = new THREE.Vector3(x, 0, y);
  return new THREE.Raycaster(
    target.clone().add(offset),
    offset.clone().negate().normalize(),
  );
};

/** A ray straight across the region at `height`, along x, through z = `y`. */
const across = (y: number, height: number) =>
  new THREE.Raycaster(
    new THREE.Vector3(-5, height, y),
    new THREE.Vector3(1, 0, 0),
  );

// The Charred fence runs from its start (3,2) over (3,3) to its far end (3,4).
const FENCE = { obstacle: "charredFence" } as const;
const ON_FENCE = [
  ["its start tile", 3, 2, { ...FENCE, x: 3, y: 2 }],
  ["its start marker's corner", 3.35, 2.28, { ...FENCE, x: 3, y: 2 }],
  ["the tile between its ends", 3, 3, FENCE],
  ["its far end tile", 3, 4, { ...FENCE, x: 3, y: 4 }],
  ["its far marker's corner", 2.65, 3.72, { ...FENCE, x: 3, y: 4 }],
] as const;
const OFF_FENCE = [
  ...[2, 3, 4].flatMap((y) => [
    [`grass west of (3,${y})`, 2, y],
    [`grass east of (3,${y})`, 4, y],
  ]),
  ["the tile behind its start", 3, 1],
  ["the tile behind its far end", 3, 5],
  ...[
    [2, 1],
    [4, 1],
    [2, 5],
    [4, 5],
  ].map(([x, y]) => [`the grass diagonally past an end at (${x},${y})`, x, y]),
] as [string, number, number][];

describe.each(VIEWS)("clicking near a shortcut, with %s", (_, offset) => {
  test.each(ON_FENCE)("on %s finds the fence", (__, x, y, found) => {
    expect(placed("charredFence")(clickAt(x, y, offset))).toMatchObject(found);
  });

  test.each(OFF_FENCE)("on %s finds nothing, so it walks", (__, x, y) => {
    expect(placed("charredFence")(clickAt(x, y, offset))).toBeUndefined();
  });
});

describe("clicking a shortcut's raised pieces", () => {
  test("a rail of the Charred fence finds it", () => {
    expect(placed("charredFence")(across(3, 0.6))).toMatchObject(FENCE);
  });

  test("a post of the Charred fence finds it", () => {
    // A post stands at the side of the middle tile, at (3.43, 3).
    expect(placed("charredFence")(across(3, 0.7))).toMatchObject(FENCE);
  });

  test("the bramble swing's rope, high above the ground, finds it", () => {
    // Placed at (3,2), the swing runs three tiles west; its rope hangs at 1.6.
    expect(
      placed("brambleSwing")(
        new THREE.Raycaster(
          new THREE.Vector3(1.5, 1.6, -5),
          new THREE.Vector3(0, 0, 1),
        ),
      ),
    ).toMatchObject({ obstacle: "brambleSwing" });
  });

  test("nothing high above the grass beside a shortcut finds it", () => {
    expect(placed("charredFence")(across(1, 0.6))).toBeUndefined();
  });
});
