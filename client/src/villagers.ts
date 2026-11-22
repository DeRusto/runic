import { VILLAGERS, type TileKind, type VillagerId } from "@runic/shared";
import type * as THREE from "three";
import { loadVillager } from "./characters.ts";
import { standAll } from "./standing.ts";

/** Every villager on the region's tiles, under a nameplate such as "Odo, blacksmith". Returns what finds the one under a click's ray. */
export async function addVillagers(tiles: TileKind[][]) {
  const under = await standAll(
    tiles,
    "villager",
    loadVillager,
    (villager) => `${VILLAGERS[villager].name}, ${VILLAGERS[villager].role}`,
  );
  return (
    raycaster: THREE.Raycaster,
  ): { villager: VillagerId; x: number; y: number } | undefined => {
    const hit = under(raycaster);
    return hit && { villager: hit.id, x: hit.x, y: hit.y };
  };
}
