import type { TileKind } from "@runic/shared";
import { loadBlacksmith } from "./characters.ts";
import { Overhead } from "./overhead.ts";
import { scene } from "./scene.ts";

/** The Blacksmith, idling under a nameplate. Nothing about them depends on the room, so they stay across rejoins. */
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
}
