import type { TileKind } from "@runic/shared";
import type * as THREE from "three";
import type { Figure } from "./characters.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { Overhead } from "./overhead.ts";
import { scene } from "./scene.ts";

/**
 * Stands everyone whose tile names them in `field` on that tile, idling under a nameplate. Nothing
 * about them depends on the room, so they stay across rejoins. Returns what finds the one under a
 * click's ray, with their id and tile.
 */
export async function standAll<Field extends "villager" | "mark">(
  tiles: TileKind[][],
  field: Field,
  loadFigure: (
    tile: { x: number; y: number },
    id: NonNullable<TileKind[Field]>,
  ) => Promise<Figure>,
  nameplateOf: (id: NonNullable<TileKind[Field]>) => string,
) {
  const standing = tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => {
      const id = tile[field] as TileKind[Field];
      return id ? [{ id: id as NonNullable<TileKind[Field]>, x, y }] : [];
    }),
  );
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
