import { Callbacks, type Room } from "@colyseus/sdk";
import type { WorldRoom } from "../../server/src/WorldRoom.ts";
import type { Figure, loadCharacters } from "./characters.ts";
import { focusOn, scene } from "./scene.ts";

export type WorldConnection = Room<WorldRoom, WorldRoom["state"]>;

/** Draws everyone at the tiles the server says. The camera follows our own. */
export function showPlayers(
  room: WorldConnection,
  newFigure: Awaited<ReturnType<typeof loadCharacters>>,
) {
  const figures = new Map<string, Figure>();
  const callbacks = Callbacks.get(room);

  callbacks.onAdd("players", (player, id) => {
    // shortcut: the session id stands in for the username, until usernames reach the client.
    const figure = newFigure(player, id);
    scene.add(figure.model);
    figures.set(id, figure);
  });
  callbacks.onRemove("players", (_, id) => {
    scene.remove(figures.get(id)!.model);
    figures.delete(id);
  });

  const frame = (now: number) => {
    for (const figure of figures.values()) figure.update(now);
    const own = figures.get(room.sessionId)?.model.position;
    if (own) focusOn(own.x, own.z);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
