import type * as THREE from "three";
import type { TileKind } from "@runic/shared";
import type { Figure } from "./characters.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { Overhead } from "./overhead.ts";
import { scene } from "./scene.ts";

/** Stands a person's figure on its tile, idling under a nameplate, and returns the hit box a click's ray finds them by. */
export function standPerson(
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
export async function standAll<Field extends "villager" | "mark">(
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
