import { parseRegion, type TileKind } from "@runic/shared";
import * as THREE from "three";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { showFires } from "./fires.ts";
import { showGatheringSites } from "./gatheringSites.ts";
import { instancesModel } from "./instancesModel.ts";
import type { WorldConnection } from "./players.ts";
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
  SPENT_MS: 2000,
  groundTop: () => 0,
  loadPart: async () => standIn(),
  loadStation: async () => standIn(),
}));

/** What the client hears from the room's state: each field's add and remove handlers, run by hand. */
const added = new Map<string, (item: object, id: string) => void>();
const removed = new Map<string, (item: object, id: string) => void>();
vi.mock("@colyseus/sdk", () => ({
  Callbacks: {
    get: () => ({
      onAdd: (field: string, handler: (item: object, id: string) => void) =>
        added.set(field, handler),
      onRemove: (field: string, handler: (item: object, id: string) => void) =>
        removed.set(field, handler),
      listen: () => {},
    }),
  },
}));
const room = { onLeave: () => {} } as unknown as WorldConnection;

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

clickTable(
  "a fire",
  loadedWith(async () => {
    const fireUnder = showFires(room);
    added.get("fires")!({ log: "pineLog" }, "3,3");
    // The pit's model loads after the fire appears.
    await new Promise((resolve) => setTimeout(resolve));
    return fireUnder;
  }),
  { log: "pineLog", x: 3, y: 3 },
  0.3,
);

/**
 * A berry bush on (3,3) drawn as the region draws its sites, as one instance among others of a
 * stand-in geometry, at `scale` of its full size: 0.6 for one that has run out.
 */
function bushAt(scale: number) {
  return placedWith(() => {
    const bushes = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.7, 0.4, 0.6).translate(0, 0.2, 0),
      new THREE.MeshBasicMaterial(),
      2,
    );
    bushes.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 0));
    bushes.setMatrixAt(
      1,
      new THREE.Matrix4().compose(
        new THREE.Vector3(3, 0, 3),
        new THREE.Quaternion(),
        new THREE.Vector3().setScalar(scale),
      ),
    );
    scene.add(bushes);
    const tiles = regionWith({ bush: "berryBush" });
    const siteUnder = showGatheringSites(
      room,
      tiles,
      ["3,3"],
      () => {},
      () => instancesModel([{ mesh: bushes, slot: 1 }]),
    );
    added.get("bushes")!({ picksLeft: scale < 1 ? 0 : 5 }, "3,3");
    return siteUnder;
  });
}
const BERRY_BUSH = { skill: "herblaw", kind: "berryBush", x: 3, y: 3 };
clickTable("a gathering site", bushAt(1), BERRY_BUSH, 0.2);
clickTable("a gathering site that has run out", bushAt(0.6), BERRY_BUSH, 0.1);

test("a site scaled to nothing, gone from its spot, has no model for a ray to meet", () => {
  const bushes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.7, 0.4, 0.6).translate(0, 0.2, 0),
    new THREE.MeshBasicMaterial(),
    1,
  );
  bushes.setMatrixAt(
    0,
    new THREE.Matrix4().compose(
      new THREE.Vector3(3, 0, 3),
      new THREE.Quaternion(),
      new THREE.Vector3(),
    ),
  );
  bushes.updateMatrixWorld();
  const model = instancesModel([{ mesh: bushes, slot: 0 }]);
  expect(across(3, 0.01).intersectObject(model)).toEqual([]);
});

describe("a station over two tiles, like the range", () => {
  const rangeUnder = placedWith(() => {
    const tiles = regionWith({ station: "range" });
    tiles[3]![4] = { ...tiles[3]![4]!, station: "range" };
    const range = standIn();
    range.position.set(3.5, 0, 3);
    scene.add(range);
    return addStations(tiles, { range });
  });

  test.each(VIEWS)(
    "is found from either of its tiles, with %s",
    (_, offset) => {
      expect(rangeUnder()(clickAt(3, 3, offset))).toBe("range");
      expect(rangeUnder()(clickAt(4, 3, offset))).toBe("range");
    },
  );

  test.each(VIEWS)(
    "lets the grass past either end walk, with %s",
    (_, offset) => {
      expect(rangeUnder()(clickAt(1.75, 3, offset))).toBeUndefined();
      expect(rangeUnder()(clickAt(5.25, 3, offset))).toBeUndefined();
    },
  );
});

describe("a pooled vein that runs out and leaves its spot", () => {
  /** An iron vein on (3,3) with one ore left, which the server then takes off its spot. */
  const mineOut = () => {
    scene.clear();
    const veinUnder = showGatheringSites(
      room,
      regionWith({ vein: "iron" }),
      ["3,3"],
      () => {},
      () => new THREE.Object3D(),
    );
    // Its last ore and its leaving can come in one patch, so it may never show none left.
    const vein = { minesLeft: 1 };
    added.get("veins")!(vein, "3,3");
    removed.get("veins")!(vein, "3,3");
    return veinUnder;
  };
  const onItsTile = clickAt(3, 3, VIEWS[0][1]);

  test("still catches a click on its tile while it fades, as run out", () => {
    vi.useFakeTimers();
    const veinUnder = mineOut();
    vi.advanceTimersByTime(1999);
    const found = veinUnder(onItsTile);
    vi.useRealTimers();
    expect(found).toMatchObject({ skill: "mining", kind: "iron", x: 3, y: 3 });
    expect(found!.left()).toBe(0);
  });

  test("lets its tile walk once it has faded", () => {
    vi.useFakeTimers();
    const veinUnder = mineOut();
    vi.advanceTimersByTime(2000);
    const found = veinUnder(onItsTile);
    vi.useRealTimers();
    expect(found).toBeUndefined();
  });
});
