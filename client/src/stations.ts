import {
  tilesApart,
  type StationKind,
  type Tile,
  type TileKind,
} from "@runic/shared";
import type * as THREE from "three";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";

const tilesOf = new Map<StationKind, Tile[]>();

/** The station's tile nearest `near`, for facing it or standing next to it: the furnace covers four. */
export const stationTile = (kind: StationKind, near: Tile) =>
  tilesOf
    .get(kind)!
    .reduce((a, b) => (tilesApart(b, near) < tilesApart(a, near) ? b : a));

/**
 * Hit boxes for every station, one per tile. Nothing about them depends on the room, so they stay
 * across rejoins. Returns what finds a station's kind under a click's ray.
 */
export function addStations(tiles: TileKind[][]) {
  const hitBoxes = new Map<THREE.Object3D, StationKind>();
  tiles.forEach((row, y) =>
    row.forEach(({ station }, x) => {
      if (!station) return;
      const hitBox = newHitBox();
      hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
      hitBoxes.set(hitBox, station);
      tilesOf.set(station, [...(tilesOf.get(station) ?? []), { x, y }]);
    }),
  );
  return (raycaster: THREE.Raycaster) => {
    const hit = raycaster.intersectObjects([...hitBoxes.keys()])[0];
    return hit && hitBoxes.get(hit.object);
  };
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
