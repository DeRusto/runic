import { Callbacks, type Room } from "@colyseus/sdk";
import type { WorldRoom } from "../../server/src/WorldRoom.ts";
import type { Figure, loadCharacters } from "./characters.ts";
import { Overhead } from "./overhead.ts";
import { camera, focusOn, scene } from "./scene.ts";

export type WorldConnection = Room<WorldRoom, WorldRoom["state"]>;

/** Draws everyone at the tiles the server says. The camera follows our own. Returns how to show a line over someone's head. */
export function showPlayers(
  room: WorldConnection,
  newFigure: Awaited<ReturnType<typeof loadCharacters>>,
) {
  const figures = new Map<string, Figure>();
  const overheads = new Map<string, Overhead>();
  const callbacks = Callbacks.get(room);

  callbacks.onAdd("players", (player, id) => {
    const figure = newFigure(player, player.username);
    scene.add(figure.model);
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
    for (const figure of figures.values()) figure.update(now);
    const own = figures.get(room.sessionId)?.model.position;
    if (own) focusOn(own.x, own.z);
    camera.updateMatrixWorld();
    for (const [id, overhead] of overheads) {
      overhead.place(figures.get(id)!.model.position);
    }
    nextFrame = requestAnimationFrame(frame);
  };
  let nextFrame = requestAnimationFrame(frame);

  room.onLeave(() => {
    cancelAnimationFrame(nextFrame);
    for (const figure of figures.values()) scene.remove(figure.model);
    for (const overhead of overheads.values()) overhead.remove();
  });

  return (id: string, text: string) => overheads.get(id)?.say(text);
}
