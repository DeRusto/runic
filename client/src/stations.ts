import {
  tilesApart,
  type StationKind,
  type Tile,
  type TileKind,
} from "@runic/shared";
import type * as THREE from "three";
import { propClicks } from "./propClicks.ts";

const tilesOf = new Map<StationKind, Tile[]>();

/** The station's tile nearest `near`, for facing it or standing next to it: the furnace covers four. */
export const stationTile = (kind: StationKind, near: Tile) =>
  tilesOf
    .get(kind)!
    .reduce((a, b) => (tilesApart(b, near) < tilesApart(a, near) ? b : a));

/**
 * Makes every station clickable on its drawn model, from `models` by kind, and on each of its tiles.
 * Nothing about them depends on the room, so they stay across rejoins. Returns what finds a
 * station's kind under a click's ray.
 */
export function addStations(
  tiles: TileKind[][],
  models: Partial<Record<StationKind, THREE.Object3D>>,
) {
  const own = new Map<StationKind, Tile[]>();
  tiles.forEach((row, y) =>
    row.forEach(({ station }, x) => {
      if (station) own.set(station, [...(own.get(station) ?? []), { x, y }]);
    }),
  );
  const clicks = propClicks<StationKind>();
  for (const [station, stationTiles] of own) {
    tilesOf.set(station, stationTiles);
    clicks.add(station, stationTiles, models[station]);
  }
  return (raycaster: THREE.Raycaster) => clicks.under(raycaster)?.target;
}

/** Registers a fire's tile as a station, so the panel can find and reach it while it burns (#224). */
export const addFireTile = ({ x, y }: Tile) =>
  tilesOf.set("fire", [...(tilesOf.get("fire") ?? []), { x, y }]);

/** Takes a burnt-out fire's tile back off the stations (#224). */
export const removeFireTile = ({ x, y }: Tile) =>
  tilesOf.set(
    "fire",
    (tilesOf.get("fire") ?? []).filter((tile) => tile.x !== x || tile.y !== y),
  );
