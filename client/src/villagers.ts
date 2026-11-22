import {
  MARKS,
  VILLAGERS,
  type MarkId,
  type TileKind,
  type VillagerId,
} from "@runic/shared";
import type * as THREE from "three";
import { loadMark, loadVillager, type Figure } from "./characters.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { Overhead } from "./overhead.ts";
import { scene } from "./scene.ts";

/**
 * Stands everyone `standing` lists on their tile, idling under a nameplate. Nothing about them
 * depends on the room, so they stay across rejoins. Returns what finds the one under a click's ray.
 */
async function addPeople<Id>(
  standing: { id: Id; x: number; y: number }[],
  loadFigure: (tile: { x: number; y: number }, id: Id) => Promise<Figure>,
  nameplateOf: (id: Id) => string,
) {
  const found = await Promise.all(
    standing.map(async ({ id, x, y }) => {
      const figure = await loadFigure({ x, y }, id);
      scene.add(figure.model);
      const nameplate = new Overhead(nameplateOf(id));
      const frame = (now: number) => {
        figure.update(now);
        nameplate.place(figure.model.position);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      const hitBox = newHitBox();
      hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
      return { id, x, y, hitBox };
    }),
  );
  return (raycaster: THREE.Raycaster) => {
    const hit = found.find(
      ({ hitBox }) => raycaster.intersectObject(hitBox).length,
    );
    return hit && { id: hit.id, x: hit.x, y: hit.y };
  };
}

/** Every tile of the region where `idOf` names someone, with that id. */
const standingOn = <Id>(
  tiles: TileKind[][],
  idOf: (tile: TileKind) => Id | undefined,
) =>
  tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => {
      const id = idOf(tile);
      return id === undefined ? [] : [{ id, x, y }];
    }),
  );

/** Every villager on the region's tiles, under a nameplate such as "Odo, blacksmith". */
export async function addVillagers(tiles: TileKind[][]) {
  const under = await addPeople(
    standingOn(tiles, (tile) => tile.villager),
    loadVillager,
    (villager: VillagerId) =>
      `${VILLAGERS[villager].name}, ${VILLAGERS[villager].role}`,
  );
  return (
    raycaster: THREE.Raycaster,
  ): { villager: VillagerId; x: number; y: number } | undefined => {
    const hit = under(raycaster);
    return hit && { villager: hit.id, x: hit.x, y: hit.y };
  };
}

/** Every mark on the region's tiles, under their name, such as "Drunk" (#250). */
export async function addMarks(tiles: TileKind[][]) {
  const under = await addPeople(
    standingOn(tiles, (tile) => tile.mark),
    loadMark,
    (mark: MarkId) => MARKS[mark].name,
  );
  return (
    raycaster: THREE.Raycaster,
  ): { mark: MarkId; x: number; y: number } | undefined => {
    const hit = under(raycaster);
    return hit && { mark: hit.id, x: hit.x, y: hit.y };
  };
}
