import { MARKS, type MarkId, type TileKind } from "@runic/shared";
import type * as THREE from "three";
import { loadMark } from "./characters.ts";
import { standAll } from "./standing.ts";

/** Every mark on the region's tiles, like the villagers: "Pell, drunk" (#250). Returns what finds the one under a click's ray. */
export async function addMarks(tiles: TileKind[][]) {
  const under = await standAll(
    tiles,
    "mark",
    loadMark,
    (mark) => `${MARKS[mark].name}, ${MARKS[mark].role}`,
  );
  return (
    raycaster: THREE.Raycaster,
  ): { mark: MarkId; x: number; y: number } | undefined => {
    const hit = under(raycaster);
    return hit && { mark: hit.id, x: hit.x, y: hit.y };
  };
}
