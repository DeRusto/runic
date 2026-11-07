import type { TileKind } from "@runic/shared";
import type * as THREE from "three";
import { loadBlacksmith } from "./characters.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { Overhead } from "./overhead.ts";
import { scene } from "./scene.ts";

/**
 * The Blacksmith, idling under a nameplate. Nothing about them depends on the room, so they
 * stay across rejoins. Returns what finds them under a click's ray.
 */
export async function addBlacksmith(tiles: TileKind[][]) {
  const y = tiles.findIndex((row) => row.some((tile) => tile.blacksmith));
  const x = tiles[y]!.findIndex((tile) => tile.blacksmith);
  const figure = await loadBlacksmith({ x, y });
  scene.add(figure.model);
  const nameplate = new Overhead("Blacksmith");
  const frame = (now: number) => {
    figure.update(now);
    nameplate.place(figure.model.position);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const hitBox = newHitBox();
  hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
  return (raycaster: THREE.Raycaster) =>
    raycaster.intersectObject(hitBox).length ? { x, y } : undefined;
}
