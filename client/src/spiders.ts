import { Callbacks } from "@colyseus/sdk";
import { SPIDER_HEALTH, type SpiderState } from "@runic/shared";
import type * as THREE from "three";
import type { Figure, loadSpiders } from "./characters.ts";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { Overhead } from "./overhead.ts";
import type { WorldConnection } from "./players.ts";
import { scene } from "./scene.ts";

export const spiderFigures = new Map<string, Figure>();
export const spiderOverheads = new Map<string, Overhead>();

/** Draws every Spider, and returns what finds the live Spider under a click's ray. */
export function showSpiders(
  room: WorldConnection,
  newSpider: Awaited<ReturnType<typeof loadSpiders>>,
) {
  const figures: { id: string; figure: Figure; hitBox: THREE.Mesh }[] = [];
  const hitBoxes = new Map<
    THREE.Object3D,
    { id: string; tile: { x: number; y: number; state: SpiderState } }
  >();

  Callbacks.get(room).onAdd("spiders", (spider, id) => {
    const figure = newSpider(spider);
    scene.add(figure.model);
    // A plain box, not the skinned mesh, so a click between the legs still counts.
    const hitBox = newHitBox();
    figures.push({ id, figure, hitBox });
    hitBoxes.set(hitBox, { id, tile: spider });
    if (spider.state === "dead") figure.alreadyGone("Spider_Death");
    spiderFigures.set(id, figure);
    spiderOverheads.set(id, new Overhead(""));
  });

  const frame = (now: number) => {
    for (const { id, figure, hitBox } of figures) {
      const spider = room.state.spiders.get(id)!;
      figure.fightTile = room.state.players.get(spider.target);
      figure.update(now);
      hitBox.position.copy(figure.model.position).setY(HIT_BOX_HEIGHT / 2);
      const overhead = spiderOverheads.get(id)!;
      overhead.showHealth(spider.health, SPIDER_HEALTH);
      overhead.place(figure.model.position);
    }
    nextFrame = requestAnimationFrame(frame);
  };
  let nextFrame = requestAnimationFrame(frame);

  room.onLeave(() => {
    cancelAnimationFrame(nextFrame);
    for (const { figure, hitBox } of figures)
      scene.remove(figure.model, hitBox);
    for (const overhead of spiderOverheads.values()) overhead.remove();
    spiderFigures.clear();
    spiderOverheads.clear();
  });

  return (raycaster: THREE.Raycaster) => {
    const live = [...hitBoxes.keys()].filter(
      (box) => hitBoxes.get(box)!.tile.state !== "dead",
    );
    const hit = raycaster.intersectObjects(live)[0];
    return hit && hitBoxes.get(hit.object);
  };
}
