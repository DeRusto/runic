import type { FixedStation } from "@runic/shared";

/**
 * How each fixed station looks and is worked: its model, scaled so its widest side spans
 * `width` tiles, and whether a player hammers at it rather than working with their hands.
 */
export const STATION_LOOKS: Record<
  FixedStation,
  { file: string; width: number; hammer?: true }
> = {
  // Kenney's building-smelter didn't read as a furnace at a tile's scale, so this is spec §15's first fallback.
  // House scale, on its 2×2 footprint.
  furnace: { file: "building_blacksmith_red.gltf", width: 2 },
  anvil: { file: "anvil.gltf", width: 0.8, hammer: true },
  // Kenney's kitchen stove, on its one tile (#221).
  range: { file: "kitchenStove.glb", width: 0.9 },
  // Kenney's survival workbench, on its one tile (#225).
  workbench: { file: "workbench.glb", width: 0.9 },
  // Kenney's graveyard altar, the rune altar's stone slab (#232).
  altar: { file: "altarStone.glb", width: 0.9 },
};
