import { Callbacks } from "@colyseus/sdk";
import * as THREE from "three";
import type { Figure, loadSpiders } from "./characters.ts";
import type { WorldConnection } from "./players.ts";
import { scene } from "./scene.ts";

const HIT_BOX_HEIGHT = 0.9;

/** Draws every Spider, and returns what finds the live Spider under a click's ray. */
export function showSpiders(
  room: WorldConnection,
  newSpider: Awaited<ReturnType<typeof loadSpiders>>,
) {
  const figures: { figure: Figure; hitBox: THREE.Mesh }[] = [];
  const hitBoxes = new Map<
    THREE.Object3D,
    { id: string; tile: { x: number; y: number; state: string } }
  >();
  const shape = new THREE.BoxGeometry(1, HIT_BOX_HEIGHT, 1);
  const unseen = new THREE.MeshBasicMaterial({ visible: false });

  Callbacks.get(room).onAdd("spiders", (spider, id) => {
    const figure = newSpider(spider);
    scene.add(figure.model);
    // A plain box, not the skinned mesh, so a click between the legs still counts.
    const hitBox = new THREE.Mesh(shape, unseen);
    scene.add(hitBox);
    figures.push({ figure, hitBox });
    hitBoxes.set(hitBox, { id, tile: spider });
  });

  const frame = (now: number) => {
    for (const { figure, hitBox } of figures) {
      figure.update(now);
      hitBox.position.copy(figure.model.position).setY(HIT_BOX_HEIGHT / 2);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  return (raycaster: THREE.Raycaster) => {
    const live = [...hitBoxes.keys()].filter(
      (box) => hitBoxes.get(box)!.tile.state !== "dead",
    );
    const hit = raycaster.intersectObjects(live)[0];
    return hit && hitBoxes.get(hit.object);
  };
}
