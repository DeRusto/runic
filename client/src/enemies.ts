import { Callbacks } from "@colyseus/sdk";
import { ENEMIES, type EnemyKind, type EnemyState } from "@runic/shared";
import type * as THREE from "three";
import { ENEMY_LOOKS, type Figure } from "./characters.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { Overhead } from "./overhead.ts";
import type { WorldConnection } from "./players.ts";
import { scene } from "./scene.ts";

export const enemyFigures = new Map<string, Figure>();
export const enemyOverheads = new Map<string, Overhead>();

/** Draws every enemy, and returns what finds the live enemy under a click's ray. */
export function showEnemies(
  room: WorldConnection,
  newFigure: Record<EnemyKind, (tile: { x: number; y: number }) => Figure>,
) {
  const figures: { id: string; figure: Figure; hitBox: THREE.Mesh }[] = [];
  const hitBoxes = new Map<
    THREE.Object3D,
    { id: string; tile: { x: number; y: number; state: EnemyState } }
  >();

  Callbacks.get(room).onAdd("enemies", (enemy, id) => {
    const figure = newFigure[enemy.kind](enemy);
    scene.add(figure.model);
    // A plain box, not the skinned mesh, so a click between the legs still counts.
    const hitBox = newHitBox();
    figures.push({ id, figure, hitBox });
    hitBoxes.set(hitBox, { id, tile: enemy });
    if (enemy.state === "dead")
      figure.alreadyGone(ENEMY_LOOKS[enemy.kind].death);
    enemyFigures.set(id, figure);
    enemyOverheads.set(id, new Overhead(""));
  });

  const frame = (now: number) => {
    for (const { id, figure, hitBox } of figures) {
      const enemy = room.state.enemies.get(id)!;
      figure.fightTile = room.state.players.get(enemy.target);
      figure.update(now);
      hitBox.position.copy(figure.model.position).setY(HIT_BOX_HEIGHT / 2);
      const overhead = enemyOverheads.get(id)!;
      overhead.showHealth(enemy.health, ENEMIES[enemy.kind].health);
      overhead.place(figure.model.position);
    }
    nextFrame = requestAnimationFrame(frame);
  };
  let nextFrame = requestAnimationFrame(frame);

  room.onLeave(() => {
    cancelAnimationFrame(nextFrame);
    for (const { figure, hitBox } of figures)
      scene.remove(figure.model, hitBox);
    for (const overhead of enemyOverheads.values()) overhead.remove();
    enemyFigures.clear();
    enemyOverheads.clear();
  });

  return (raycaster: THREE.Raycaster) => {
    const live = [...hitBoxes.keys()].filter(
      (box) => hitBoxes.get(box)!.tile.state !== "dead",
    );
    const hit = raycaster.intersectObjects(live)[0];
    return hit && hitBoxes.get(hit.object);
  };
}
