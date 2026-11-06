import { Callbacks } from "@colyseus/sdk";
import type { Tier, TileKind } from "@runic/shared";
import type * as THREE from "three";
import { HIT_BOX_HEIGHT, newHitBox } from "./hitBoxes.ts";
import type { WorldConnection } from "./players.ts";
import { scene } from "./scene.ts";

/** Keeps each vein's look to the server's ore, and returns what finds the vein under a click's ray. */
export function showVeins(
  room: WorldConnection,
  tiles: TileKind[][],
  setRunOut: (id: string, runOut: boolean) => void,
) {
  const hitBoxes = new Map<
    THREE.Object3D,
    { id: string; x: number; y: number; tier: Tier; oreLeft: () => number }
  >();

  const callbacks = Callbacks.get(room);
  callbacks.onAdd("veins", (vein, id) => {
    const [x, y] = id.split(",").map(Number) as [number, number];
    // Run-out veins must still catch a click, to say why it's refused.
    const hitBox = newHitBox();
    hitBox.position.set(x, HIT_BOX_HEIGHT / 2, y);
    hitBoxes.set(hitBox, {
      id,
      x,
      y,
      tier: tiles[y]![x]!.vein!,
      oreLeft: () => vein.oreLeft,
    });
    callbacks.listen(vein, "oreLeft", (ore) => setRunOut(id, ore === 0));
  });

  room.onLeave(() => scene.remove(...hitBoxes.keys()));

  return (raycaster: THREE.Raycaster) => {
    const hit = raycaster.intersectObjects([...hitBoxes.keys()])[0];
    return hit && hitBoxes.get(hit.object);
  };
}
