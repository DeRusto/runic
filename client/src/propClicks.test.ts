import { parseRegion, type TileKind } from "@runic/shared";
import * as THREE from "three";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { scene } from "./scene.ts";
import { addStalls } from "./stalls.ts";
import { addStations } from "./stations.ts";
import { addStrongboxes } from "./strongboxes.ts";

// The real scene module starts a WebGL renderer; a bare scene is all these rays need.
vi.mock("./scene.ts", async () => {
  const { Scene } = await import("three");
  return { scene: new Scene() };
});
// Textured models don't load outside a browser, so each loaded model stands in as a box.
vi.mock("./regionMeshes.ts", async () => ({
  groundTop: () => 0,
  loadPart: async () => standIn(),
  loadStation: async () => standIn(),
}));

/**
 * A box that stands in for a loaded model, with its base on the ground: low enough that it hides
 * none of the grass in the table from even the slanted camera, as a model too tall would.
 */
function standIn() {
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.6));
  box.position.y = 0.2;
  return new THREE.Group().add(box);
}

/** A 7×7 open region with `feature` set on the tile at (3,3), the prop's tile in every table. */
function regionWith(feature: Partial<TileKind>) {
  const tiles = parseRegion(
    ["TTTTTTT", ...Array(5).fill("T.....T"), "TTTTTTT"].join("\n"),
  );
  tiles[3]![3] = { ...tiles[3]![3]!, ...feature };
  return tiles;
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

/** Clicks on the prop's own tile: its middle and near each corner. */
const ON_TILE = [
  ["the middle of its tile", 3, 3],
  ...[
    [2.6, 2.6],
    [3.4, 2.6],
    [2.6, 3.4],
    [3.4, 3.4],
  ].map(([x, y]) => [`its tile near (${x},${y})`, x, y]),
] as [string, number, number][];
/**
 * Clicks on the eight tiles around the prop, the grass on each side and the tiles behind it, a
 * quarter tile past their middles: a model standing up off its tile, like an open strongbox's lid,
 * can hide a neighbour's middle from the camera, but not grass this far out.
 */
const OFF_TILE = [-1, 0, 1].flatMap((dy) =>
  [-1, 0, 1].flatMap((dx) =>
    dx || dy
      ? [[`the grass at (${3 + dx},${3 + dy})`, 3 + 1.25 * dx, 3 + 1.25 * dy]]
      : [],
  ),
) as [string, number, number][];

/**
 * The click table every prop kind passes: a click on its tile or its model finds `found`, a
 * click on any other tile finds nothing, so it walks. `modelAt` is a height the model stands at.
 */
function clickTable(
  name: string,
  place: () => (raycaster: THREE.Raycaster) => unknown,
  target: object | string,
  modelAt: number,
) {
  const found =
    typeof target === "string" ? target : expect.objectContaining(target);
  describe.each(VIEWS)(`clicking near ${name}, with %s`, (_, offset) => {
    test.each(ON_TILE)("on %s finds it", (__, x, y) => {
      expect(place()(clickAt(x, y, offset))).toEqual(found);
    });

    test.each(OFF_TILE)("on %s finds nothing, so it walks", (__, x, y) => {
      expect(place()(clickAt(x, y, offset))).toBeUndefined();
    });
  });

  test(`a ray onto ${name}'s model finds it`, () => {
    expect(place()(across(3, modelAt))).toEqual(found);
  });

  test(`nothing at ${name}'s height above the grass beside it finds it`, () => {
    expect(place()(across(2, modelAt))).toBeUndefined();
  });
}

/** Places the props `add` builds over a fresh scene, and returns what it finds under a ray. */
function placedWith<Under>(add: () => Under) {
  return () => {
    scene.clear();
    const under = add();
    scene.updateMatrixWorld(true);
    return under;
  };
}

/** Like `placedWith`, for props whose models load first: places them all before any test runs. */
function loadedWith<Under>(add: () => Promise<Under>) {
  let under: Under;
  beforeAll(async () => {
    scene.clear();
    under = await add();
    scene.updateMatrixWorld(true);
  });
  return () => under;
}

const BONEYARD = { strongbox: "boneyard", x: 3, y: 3 } as const;
clickTable(
  "a strongbox",
  placedWith(
    () => addStrongboxes(regionWith({ strongbox: "boneyard" })).strongboxUnder,
  ),
  BONEYARD,
  0.2,
);
clickTable(
  "an emptied strongbox",
  placedWith(() => {
    const { strongboxUnder, closedLooks } = addStrongboxes(
      regionWith({ strongbox: "boneyard" }),
    );
    closedLooks.get("boneyard")!.visible = false;
    return strongboxUnder;
  }),
  BONEYARD,
  0.2,
);

const FISH_STALL = { stall: "fish", x: 3, y: 3 } as const;
clickTable(
  "a stall",
  loadedWith(
    async () => (await addStalls(regionWith({ stall: "fish" }))).stallUnder,
  ),
  FISH_STALL,
  0.2,
);
clickTable(
  "an emptied stall",
  loadedWith(async () => {
    const { stallUnder, wares } = await addStalls(
      regionWith({ stall: "fish" }),
    );
    wares.get("fish")!.visible = false;
    return stallUnder;
  }),
  FISH_STALL,
  0.2,
);

clickTable(
  "a station",
  placedWith(() => {
    const anvil = standIn();
    anvil.position.set(3, 0, 3);
    scene.add(anvil);
    return addStations(regionWith({ station: "anvil" }), { anvil });
  }),
  "anvil",
  0.2,
);
