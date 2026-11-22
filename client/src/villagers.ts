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

/** Stands a person's figure on its tile, idling under a nameplate, and returns the hit box a click's ray finds them by. */
function standPerson(
  { x, y }: { x: number; y: number },
  figure: Figure,
  nameplateText: string,
) {
  scene.add(figure.model);
  const nameplate = new Overhead(nameplateText);
  const frame = (now: number) => {
    figure.update(now);
    nameplate.place(figure.model.position);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  const hitBox = newHitBox();
  hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
  return hitBox;
}

/** Everyone on the region's tiles whose tile field `field` is set, each with its id, tile and hit box. */
async function standAll<Field extends "villager" | "mark">(
  tiles: TileKind[][],
  field: Field,
  stand: (
    id: NonNullable<TileKind[Field]>,
    tile: { x: number; y: number },
  ) => Promise<THREE.Object3D>,
) {
  const standing = tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => {
      const id = tile[field];
      return id ? [{ id: id as NonNullable<TileKind[Field]>, x, y }] : [];
    }),
  );
  const found = await Promise.all(
    standing.map(async ({ id, x, y }) => ({
      id,
      x,
      y,
      hitBox: await stand(id, { x, y }),
    })),
  );
  return (raycaster: THREE.Raycaster) =>
    found.find(({ hitBox }) => raycaster.intersectObject(hitBox).length);
}

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
