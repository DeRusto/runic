import type { TileKind } from "@runic/shared";
import { expect, test, vi } from "vitest";
import { addStations, stationTile } from "./stations.ts";

// The real hit boxes join the three.js scene, which needs a browser.
vi.mock("./hitBoxes.ts", () => ({
  HIT_BOX_HEIGHT: 1,
  newHitBox: () => ({ position: { set() {} } }),
}));

/** A row-major grid whose `F` tiles are the furnace and `A` the anvil. */
const grid = (...rows: string[]) =>
  rows.map((row) =>
    [...row].map(
      (cell) =>
        ({
          station:
            cell === "F" ? "furnace" : cell === "A" ? "anvil" : undefined,
        }) as unknown as TileKind,
    ),
  );

test("a station facing picks its tile nearest the player, the first in row order on a tie", () => {
  addStations(grid("......", ".FF..A", ".FF...", "......"));
  expect(stationTile("furnace", { x: 0, y: 1 })).toEqual({ x: 1, y: 1 });
  expect(stationTile("furnace", { x: 3, y: 3 })).toEqual({ x: 2, y: 2 });
  expect(stationTile("furnace", { x: 3, y: 0 })).toEqual({ x: 2, y: 1 });
  expect(stationTile("furnace", { x: 2, y: 0 })).toEqual({ x: 1, y: 1 });
  expect(stationTile("anvil", { x: 0, y: 0 })).toEqual({ x: 5, y: 1 });
});
