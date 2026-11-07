import type { StationKind, Tile, TileKind } from "@runic/shared";
import type * as THREE from "three";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";

const tilesOf = new Map<StationKind, Tile>();

/** Where a station stands, for facing it. */
export const stationTile = (kind: StationKind) => tilesOf.get(kind)!;

/**
 * Hit boxes for the furnace and anvil. Nothing about them depends on the room, so they stay
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
      tilesOf.set(station, { x, y });
    }),
  );
  return (raycaster: THREE.Raycaster) => {
    const hit = raycaster.intersectObjects([...hitBoxes.keys()])[0];
    return hit && hitBoxes.get(hit.object);
  };
}
