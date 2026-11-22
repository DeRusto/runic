import { VILLAGERS, type TileKind, type VillagerId } from "@runic/shared";
import type * as THREE from "three";
import { loadVillager } from "./characters.ts";
import { standAll, standPerson } from "./standing.ts";

/**
 * Every villager on the region's tiles, idling under a nameplate ("Odo, blacksmith"). Nothing
 * about them depends on the room, so they stay across rejoins. Returns what finds the one
 * under a click's ray.
 */
export async function addVillagers(tiles: TileKind[][]) {
  const under = await standAll(tiles, "villager", async (villager, tile) => {
    const { name, role } = VILLAGERS[villager];
    return standPerson(
      tile,
      await loadVillager(tile, villager),
      `${name}, ${role}`,
    );
  });
  return (
    raycaster: THREE.Raycaster,
  ): { villager: VillagerId; x: number; y: number } | undefined => {
    const found = under(raycaster);
    return found && { villager: found.id, x: found.x, y: found.y };
  };
}
