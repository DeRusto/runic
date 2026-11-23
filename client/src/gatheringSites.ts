import { Callbacks } from "@colyseus/sdk";
import {
  GATHERING,
  GATHERING_SKILLS,
  type GatheringLeftField,
  type GatheringSkill,
  type TileKind,
} from "@runic/shared";
import type * as THREE from "three";
import type { WorldConnection } from "./players.ts";
import { tileSites } from "./propClicks.ts";
import { SPENT_MS, type SiteLook } from "./regionMeshes.ts";

/**
 * Keeps each site's look to what the server says is left, shows a pooled site only while the
 * server has it on its spot, and returns what finds the site under a click's ray: its tile, or
 * `modelOf` the site's tile id, as drawn. `tiles` has every spot filled in with its pool's site, so
 * its kind is known before one appears there.
 */
export function showGatheringSites(
  room: WorldConnection,
  tiles: TileKind[][],
  spots: string[],
  setLook: (id: string, look: SiteLook) => boolean,
  modelOf: (id: string) => THREE.Object3D,
) {
  const callbacks = Callbacks.get(room);
  // The next room may have its sites on other spots.
  room.onLeave(() => spots.forEach((id) => setLook(id, "gone")));
  const unders = GATHERING_SKILLS.map((skill) => {
    const { site: siteField, stateField, leftField } = GATHERING[skill];
    const sites = tileSites<{
      skill: GatheringSkill;
      kind: string;
      left: () => number;
    }>(room);
    // What makes each site on a spot read as run out, once it leaves.
    const runOuts = new Map<string, () => void>();
    callbacks.onAdd(stateField, (site, id) => {
      let left = () =>
        (site as Partial<Record<GatheringLeftField, number>>)[leftField]!;
      runOuts.set(id, () => (left = () => 0));
      sites.add(
        id,
        (x, y) => ({
          skill,
          kind: tiles[y]![x]![siteField]!,
          left: () => left(),
        }),
        modelOf(id),
      );
      // The row keeps the map and its field together, which the types can't follow.
      callbacks.listen(site, leftField as never, (left: number) =>
        setLook(id, left === 0 ? "runOut" : "full"),
      );
    });
    // A pooled site leaves its spot as it runs out, though its last change can come in the same
    // patch as its leaving. While its spent copy fades, it still says it has run out; a fishing
    // spot leaves no copy, only water, which walks at once.
    callbacks.onRemove(stateField, (_, id) => {
      runOuts.get(id)?.();
      runOuts.delete(id);
      const fades = setLook(id, "spent");
      sites.remove(id, fades ? SPENT_MS : 0);
    });
    return sites.under;
  });
  // Each skill's sites apart, as the earlier skill's site wins even with another in front of it.
  return (raycaster: THREE.Raycaster) =>
    unders.map((under) => under(raycaster)).find(Boolean);
}
