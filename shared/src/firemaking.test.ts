import { expect, test } from "vitest";
import { xpForLevel } from "./skills.ts";
import {
  FIRES,
  fireOf,
  lightRefusal,
  lightTileAt,
  type LightTile,
} from "./firemaking.ts";
import { parseRegion } from "./region.ts";

const tinderbox = { firemakingXp: 0, tools: ["tinderbox"] };

/** A plain grass tile with nothing on it and no fire. */
const ground: LightTile = { fire: false, ground: "grass", enemy: false };

test("each log lights a fire of its own tier, and other logs light none", () => {
  expect(fireOf("birchLog")).toEqual({
    level: 1,
    ticks: 600,
    xp: 10,
    burnPercent: 10,
  });
  expect(fireOf("oakLog")).toMatchObject({ level: 10, ticks: 1000 });
  expect(fireOf("charwoodLog")).toMatchObject({ level: 20, xp: 40 });
  expect(fireOf("berry")).toBeUndefined();
  expect(fireOf("")).toBeUndefined();
});

test("lighting needs a tinderbox, which the Forester gives", () => {
  expect(lightRefusal("birchLog", ground, { firemakingXp: 0, tools: [] })).toBe(
    "You need a tinderbox. The Forester will give you one.",
  );
});

test("a log of too high a tier is refused on Firemaking", () => {
  expect(lightRefusal("birchLog", ground, tinderbox)).toBeUndefined();
  expect(lightRefusal("oakLog", ground, tinderbox)).toBe("Needs Firemaking 10");
  expect(
    lightRefusal("charwoodLog", ground, {
      firemakingXp: xpForLevel(20),
      tools: ["tinderbox"],
    }),
  ).toBeUndefined();
});

test("a slot with no log in it is refused like a make with nothing to make", () => {
  expect(lightRefusal(undefined, ground, tinderbox)).toBe(
    "Not enough materials",
  );
  expect(lightRefusal("berry", ground, tinderbox)).toBe("Not enough materials");
});

test("one fire to a tile, whatever else the player holds", () => {
  expect(lightRefusal("birchLog", { ...ground, fire: true }, tinderbox)).toBe(
    "There is already a fire here.",
  );
});

test("nothing but plain walkable ground takes a fire", () => {
  expect(
    lightRefusal("birchLog", { ...ground, ground: "water" }, tinderbox),
  ).toBe("You can't light a fire here.");
  expect(lightRefusal("birchLog", { ...ground, prop: "tuft" }, tinderbox)).toBe(
    "You can't light a fire here.",
  );
  expect(lightRefusal("birchLog", { ...ground, enemy: true }, tinderbox)).toBe(
    "You can't light a fire here.",
  );
});

test("a tile's light reading comes from the map, the burning fires and the living enemies (#224)", () => {
  const tiles = parseRegion(".T~");
  const world = (
    fires: string[],
    enemies: { x: number; y: number; state: "idle" | "dead" }[],
  ) => ({
    tiles,
    fires: new Set(fires),
    enemies,
  });
  expect(lightTileAt({ x: 0, y: 0 }, world([], []))).toEqual({
    fire: false,
    ground: "grass",
    prop: undefined,
    enemy: false,
  });
  expect(lightTileAt({ x: 1, y: 0 }, world([], []))).toMatchObject({
    prop: "tree",
  });
  expect(lightTileAt({ x: 2, y: 0 }, world([], []))).toMatchObject({
    ground: "water",
  });
  expect(lightTileAt({ x: 0, y: 0 }, world(["0,0"], []))).toMatchObject({
    fire: true,
  });
  expect(
    lightTileAt({ x: 0, y: 0 }, world([], [{ x: 0, y: 0, state: "idle" }])),
  ).toMatchObject({ enemy: true });
  expect(
    lightTileAt({ x: 0, y: 0 }, world([], [{ x: 0, y: 0, state: "dead" }])),
  ).toMatchObject({ enemy: false });
});
