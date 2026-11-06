import { Callbacks, type Room } from "@colyseus/sdk";
import type { WorldRoom } from "../../server/src/WorldRoom.ts";
import {
  addSeeThroughOutline,
  type Figure,
  type loadCharacters,
} from "./characters.ts";
import { Overhead } from "./overhead.ts";
import { camera, focusOn, scene } from "./scene.ts";

export type WorldConnection = Room<WorldRoom, WorldRoom["state"]>;

const figures = new Map<string, Figure>();
const overheads = new Map<string, Overhead>();
export { figures as playerFigures, overheads as playerOverheads };

/** Draws everyone at the tiles the server says. The camera follows our own. Returns how to show a line over someone's head. */
export function showPlayers(
  room: WorldConnection,
  newFigure: Awaited<ReturnType<typeof loadCharacters>>,
) {
  const callbacks = Callbacks.get(room);

  callbacks.onAdd("players", (player, id) => {
    const figure = newFigure(player, player.username);
    addSeeThroughOutline(figure.model);
    scene.add(figure.model);
    if (player.dead) figure.alreadyDown("Death_A");
    figures.set(id, figure);
    overheads.set(id, new Overhead(player.username));
  });
  callbacks.onRemove("players", (_, id) => {
    scene.remove(figures.get(id)!.model);
    figures.delete(id);
    overheads.get(id)!.remove();
    overheads.delete(id);
  });

  const frame = (now: number) => {
    for (const [id, figure] of figures) {
      const target = room.state.players.get(id)?.target;
      figure.fightTile = target ? room.state.enemies.get(target) : undefined;
      const action = room.state.players.get(id)?.action;
      figure.mining = action === "mining";
      if (action !== "smithing") figure.work = undefined;
      figure.update(now);
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
    for (const overhead of overheads.values()) overhead.remove();
    figures.clear();
    overheads.clear();
  });

  return (id: string, text: string) => overheads.get(id)?.say(text);
}
