import { Callbacks } from "@colyseus/sdk";
import type { BushKind, TileKind } from "@runic/shared";
import { tileHitBoxes } from "./hitBoxes.ts";
import type { WorldConnection } from "./players.ts";

/** Keeps each bush's look to the server's picks, and returns what finds the bush under a click's ray. */
export function showBushes(
  room: WorldConnection,
  tiles: TileKind[][],
  setRunOut: (id: string, runOut: boolean) => void,
) {
  const sites = tileHitBoxes<{ kind: BushKind; picksLeft: () => number }>(room);
  const callbacks = Callbacks.get(room);
  callbacks.onAdd("bushes", (bush, id) => {
    sites.add(id, (x, y) => ({
      kind: tiles[y]![x]!.bush!,
      picksLeft: () => bush.picksLeft,
    }));
    callbacks.listen(bush, "picksLeft", (picks) => setRunOut(id, picks === 0));
  });
  return sites.under;
}
