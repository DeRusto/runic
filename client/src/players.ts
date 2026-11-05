import { Callbacks, type Room } from "@colyseus/sdk";
import {
  EVENTS,
  levelFor,
  pickIntervalTicks,
  TICK_MS,
  type GameEvent,
} from "@runic/shared";
import type { WorldRoom } from "../../server/src/WorldRoom.ts";
import { revealPick } from "./bottomBar.ts";
import type { Figure, loadCharacters } from "./characters.ts";
import { Overhead } from "./overhead.ts";
import { camera, focusOn, scene } from "./scene.ts";

export type WorldConnection = Room<WorldRoom, WorldRoom["state"]>;

/** How far through `PickUp` the result of a pick shows (spec §7). */
const PICK_RESULT_AT = 0.4;

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

  room.onMessage(EVENTS, (events: GameEvent[]) => {
    for (const event of events) {
      if (event.type !== "pick") continue;
      const { id, success } = event;
      const figure = figures.get(id);
      const player = room.state.players.get(id);
      if (!figure || !player) continue;
      const interval = pickIntervalTicks(levelFor(player.foragingXp));
      const clipMs = figure.playOnce("PickUp", interval * TICK_MS);
      setTimeout(() => {
        overheads.get(id)?.say(success ? "Picked!" : "No luck");
        if (id === room.sessionId) revealPick();
      }, PICK_RESULT_AT * clipMs);
    }
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
