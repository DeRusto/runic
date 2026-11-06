import { Callbacks } from "@colyseus/sdk";
import type { Tier, TileKind } from "@runic/shared";
import { tileHitBoxes } from "./hitBoxes.ts";
import type { WorldConnection } from "./players.ts";

/** Keeps each vein's look to the server's ore, and returns what finds the vein under a click's ray. */
export function showVeins(
  room: WorldConnection,
  tiles: TileKind[][],
  setRunOut: (id: string, runOut: boolean) => void,
) {
  const sites = tileHitBoxes<{ tier: Tier; oreLeft: () => number }>(room);
  const callbacks = Callbacks.get(room);
  callbacks.onAdd("veins", (vein, id) => {
    sites.add(id, (x, y) => ({
      tier: tiles[y]![x]!.vein!,
      oreLeft: () => vein.oreLeft,
    }));
    callbacks.listen(vein, "oreLeft", (ore) => setRunOut(id, ore === 0));
  });
  return sites.under;
}
