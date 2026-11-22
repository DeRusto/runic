import { MARKS, type MarkId, type TileKind } from "@runic/shared";
import type * as THREE from "three";
import { loadMark } from "./characters.ts";
import { standAll, standPerson } from "./standing.ts";

/** Every mark on the region's tiles, like the villagers: "Pell, drunk" (#250). Returns what finds the one under a click's ray. */
export async function addMarks(tiles: TileKind[][]) {
  const under = await standAll(tiles, "mark", async (mark, tile) => {
    const { name, role } = MARKS[mark];
    return standPerson(tile, await loadMark(tile, mark), `${name}, ${role}`);
  });
  return (
    raycaster: THREE.Raycaster,
  ): { mark: MarkId; x: number; y: number } | undefined => {
    const found = under(raycaster);
    return found && { mark: found.id, x: found.x, y: found.y };
  };
}
