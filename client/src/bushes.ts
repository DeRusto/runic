import { Callbacks } from "@colyseus/sdk";
import type { BushKind, TileKind } from "@runic/shared";
import type * as THREE from "three";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import type { WorldConnection } from "./players.ts";
import { scene } from "./scene.ts";

/** Keeps each bush's look to the server's picks, and returns what finds the bush under a click's ray. */
export function showBushes(
  room: WorldConnection,
  tiles: TileKind[][],
  setRunOut: (id: string, runOut: boolean) => void,
) {
  const hitBoxes = new Map<
    THREE.Object3D,
    {
      id: string;
      x: number;
      y: number;
      kind: BushKind;
      picksLeft: () => number;
    }
  >();

  const callbacks = Callbacks.get(room);
  callbacks.onAdd("bushes", (bush, id) => {
    const [x, y] = id.split(",").map(Number) as [number, number];
    // A plain box, like a Spider's: run-out bushes must still catch a click, to say why it's refused.
    const hitBox = newHitBox();
    hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
    hitBoxes.set(hitBox, {
      id,
      x,
      y,
      kind: tiles[y]![x]!.bush!,
      picksLeft: () => bush.picksLeft,
    });
    callbacks.listen(bush, "picksLeft", (picks) => setRunOut(id, picks === 0));
  });

  room.onLeave(() => scene.remove(...hitBoxes.keys()));

  return (raycaster: THREE.Raycaster) => {
    const hit = raycaster.intersectObjects([...hitBoxes.keys()])[0];
    return hit && hitBoxes.get(hit.object);
  };
}
