import { Callbacks, type Room } from "@colyseus/sdk";
import { itemParts } from "@runic/shared";
import type { WorldRoom } from "../../server/src/WorldRoom.ts";
import {
  addSeeThroughOutline,
  type Figure,
  type loadCharacters,
} from "./characters.ts";
import type * as THREE from "three";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import { Overhead } from "./overhead.ts";
import { camera, focusOn, scene } from "./scene.ts";

export type WorldConnection = Room<WorldRoom, WorldRoom["state"]>;

const figures = new Map<string, Figure>();
const overheads = new Map<string, Overhead>();
export { figures as playerFigures, overheads as playerOverheads };

/** Draws everyone at the tiles the server says. The camera follows our own. Returns how to show a line over someone's head, and what finds another player under a click. */
export function showPlayers(
  room: WorldConnection,
  newFigure: Awaited<ReturnType<typeof loadCharacters>>,
) {
  const callbacks = Callbacks.get(room);

  // A plain box, as for enemies, so a right-click between the legs still counts.
  const hitBoxes = new Map<string, THREE.Mesh>();

  callbacks.onAdd("players", (player, id) => {
    hitBoxes.set(id, newHitBox());
    const figure = newFigure(player, player.username);
    addSeeThroughOutline(figure.model);
    scene.add(figure.model);
    if (player.dead) figure.alreadyDown("Death_A");
    figures.set(id, figure);
    overheads.set(id, new Overhead(player.username));
  });
  callbacks.onRemove("players", (_, id) => {
    scene.remove(figures.get(id)!.model, hitBoxes.get(id)!);
    figures.delete(id);
    hitBoxes.delete(id);
    overheads.get(id)!.remove();
    overheads.delete(id);
  });

  const frame = (now: number) => {
    for (const [id, figure] of figures) {
      const player = room.state.players.get(id);
      const target = player?.target;
      figure.fightTile = target ? room.state.enemies.get(target) : undefined;
      // The worn look is the common form's, improved or not (spec §2).
      figure.weapon = itemParts(player?.weapon ?? "").base;
      figure.shield = itemParts(player?.shield ?? "").base;
      const action = player?.action;
      figure.action = action ?? "";
      if (action !== "making") figure.work = undefined;
      figure.update(now);
      hitBoxes
        .get(id)!
        .position.copy(figure.model.position)
        .setY(HIT_BOX_HEIGHT / 2);
    }
    const own = figures.get(room.sessionId)?.model.position;
    if (own) focusOn(own.x, own.z);
    camera.updateMatrixWorld();
    for (const [id, overhead] of overheads) {
      const player = room.state.players.get(id);
      if (player) overhead.showHealth(player.health, player.maxHealth);
      overhead.place(figures.get(id)!.model.position);
    }
    nextFrame = requestAnimationFrame(frame);
  };
  let nextFrame = requestAnimationFrame(frame);

  room.onLeave(() => {
    cancelAnimationFrame(nextFrame);
    for (const figure of figures.values()) scene.remove(figure.model);
    scene.remove(...hitBoxes.values());
    for (const overhead of overheads.values()) overhead.remove();
    figures.clear();
    hitBoxes.clear();
    overheads.clear();
  });

  return {
    sayOverhead: (id: string, text: string) => overheads.get(id)?.say(text),
    /** The session id of the other player under a click's ray; never our own. */
    otherPlayerUnder(raycaster: THREE.Raycaster) {
      const others = [...hitBoxes].filter(([id]) => id !== room.sessionId);
      const hit = raycaster.intersectObjects(others.map(([, box]) => box))[0];
      return others.find(([, box]) => box === hit?.object)?.[0];
    },
  };
}
