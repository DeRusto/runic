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

/** Keeps each site's look to what the server says is left, and returns what finds the site under a click's ray. */
export function showGatheringSites(
  room: WorldConnection,
  tiles: TileKind[][],
  setRunOut: (id: string, runOut: boolean) => void,
) {
  const callbacks = Callbacks.get(room);
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
        setRunOut(id, left === 0),
      );
    });
    return sites.under;
  });
  // Each skill's boxes apart, as the earlier skill's site wins even with another in front of it.
  return (raycaster: THREE.Raycaster) =>
    unders.map((under) => under(raycaster)).find(Boolean);
}
