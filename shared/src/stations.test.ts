import { expect, test } from "vitest";
import { TILE_KINDS } from "./region.ts";
import { STATIONS, stationRefusal } from "./stations.ts";

test("every fixed station has a test-map character", () => {
  const placed = Object.values(TILE_KINDS).flatMap((kind) =>
    "station" in kind ? [kind.station] : [],
  );
  expect(placed.sort()).toEqual(Object.keys(STATIONS).sort());
});

test("a fire and the ungated stations are never refused", () => {
  const nothing = { tools: [] };
  for (const station of ["fire", "range", "workbench", "altar"] as const)
    expect(stationRefusal(station, nothing)).toBeUndefined();
});

test("a gated station names its quest's villager, after its tool (#231)", () => {
  expect(stationRefusal("furnace", { tools: [] })).toBe(
    "You need to help Odo first.",
  );
  expect(stationRefusal("anvil", { tools: [] })).toMatch(/^You need a hammer/);
});
