import { Callbacks } from "@colyseus/sdk";
import {
  GATHERING,
  GATHERING_SKILLS,
  type GatheringLeftField,
  type GatheringSkill,
  type TileKind,
} from "@runic/shared";
import type * as THREE from "three";
import { tileHitBoxes } from "./hitBoxes.ts";
import type { WorldConnection } from "./players.ts";
import type { SiteLook } from "./regionMeshes.ts";

/**
 * Keeps each site's look to what the server says is left, shows a pooled site only while the
 * server has it on its spot, and returns what finds the site under a click's ray. `tiles` has
 * every spot filled in with its pool's site, so its kind is known before one appears there.
 */
export function showGatheringSites(
  room: WorldConnection,
  tiles: TileKind[][],
  spots: string[],
  setLook: (id: string, look: SiteLook) => void,
) {
  const callbacks = Callbacks.get(room);
  // The next room may have its sites on other spots.
  room.onLeave(() => spots.forEach((id) => setLook(id, "gone")));
  const unders = GATHERING_SKILLS.map((skill) => {
    const { site: siteField, stateField, leftField } = GATHERING[skill];
    const sites = tileHitBoxes<{
      skill: GatheringSkill;
      kind: string;
      left: () => number;
    }>(room);
    callbacks.onAdd(stateField, (site, id) => {
      sites.add(id, (x, y) => ({
        skill,
        kind: tiles[y]![x]![siteField]!,
        left: () =>
          (site as Partial<Record<GatheringLeftField, number>>)[leftField]!,
      }));
      // The row keeps the map and its field together, which the types can't follow.
      callbacks.listen(site, leftField as never, (left: number) =>
        setLook(id, left === 0 ? "runOut" : "full"),
      );
    });
    callbacks.onRemove(stateField, (_, id) => {
      sites.remove(id);
      setLook(id, "gone");
    });
    return sites.under;
  });
  // Each skill's boxes apart, as the earlier skill's site wins even with another in front of it.
  return (raycaster: THREE.Raycaster) =>
    unders.map((under) => under(raycaster)).find(Boolean);
}
