import { VILLAGERS, type TileKind, type VillagerId } from "@runic/shared";
import type * as THREE from "three";
import { loadVillager } from "./characters.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { Overhead } from "./overhead.ts";
import { scene } from "./scene.ts";

/**
 * Every villager on the region's tiles, idling under a nameplate ("Odo, blacksmith"). Nothing
 * about them depends on the room, so they stay across rejoins. Returns what finds the one
 * under a click's ray.
 */
export async function addVillagers(tiles: TileKind[][]) {
  const standing = tiles.flatMap((row, y) =>
    row.flatMap(({ villager }, x) => (villager ? [{ villager, x, y }] : [])),
  );
  const found = await Promise.all(
    standing.map(async ({ villager, x, y }) => {
      const figure = await loadVillager({ x, y }, villager);
      scene.add(figure.model);
      const { name, role } = VILLAGERS[villager];
      const nameplate = new Overhead(`${name}, ${role}`);
      const frame = (now: number) => {
        figure.update(now);
        nameplate.place(figure.model.position);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      const hitBox = newHitBox();
      hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
      return { villager, x, y, hitBox };
    }),
  );
  return (
    raycaster: THREE.Raycaster,
  ): { villager: VillagerId; x: number; y: number } | undefined =>
    found.find(({ hitBox }) => raycaster.intersectObject(hitBox).length);
}
