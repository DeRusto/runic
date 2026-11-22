import type { FixedStation } from "@runic/shared";

/**
 * One model in a station's look: scaled so its widest side spans `width` tiles, and stood at `at`
 * (x, z in tiles from the middle of the station's tiles), `y` tiles up. `onTop` stands it on the
 * last part without it instead, as clutter on a table. `lay` tips it onto its side first.
 */
export type StationPart = {
  file: string;
  width: number;
  at?: [number, number];
  y?: number;
  yaw?: number;
  lay?: true;
  onTop?: true;
};

/**
 * How each fixed station looks and is worked: its models, an optional flame (as a fire's, at `at`
 * and `size` times as big), and whether a player hammers at it rather than working with their hands.
 */
export const STATION_LOOKS: Record<
  FixedStation,
  {
    parts: StationPart[];
    flame?: { at: [number, number]; y: number; size: number };
    hammer?: true;
  }
> = {
  // Kenney's building-smelter didn't read as a furnace at a tile's scale, so this is spec §15's first fallback.
  // House scale, on its 2×2 footprint.
  furnace: { parts: [{ file: "building_blacksmith_red.gltf", width: 2 }] },
  anvil: { parts: [{ file: "anvil.gltf", width: 0.8 }], hammer: true },
  // A cauldron over a pit fire, beside a cluttered table, on its two tiles (#221).
  range: {
    parts: [
      { file: "campfirePit.glb", width: 0.6, at: [-0.5, 0] },
      { file: "cauldron.glb", width: 0.89, at: [-0.5, 0], y: 0.135 },
      { file: "bucketWooden.glb", width: 0.31, at: [0.85, 0.38] },
      { file: "tableMedium.glb", width: 0.9, at: [0.5, 0] },
      {
        file: "cuttingBoard.glb",
        width: 0.33,
        at: [0.37, 0.07],
        yaw: 0.3,
        onTop: true,
      },
      {
        file: "cleaver.glb",
        width: 0.24,
        at: [0.41, 0.09],
        y: 0.03,
        yaw: -0.4,
        onTop: true,
      },
      {
        file: "carrot.glb",
        width: 0.29,
        at: [0.64, -0.23],
        yaw: 0.5,
        lay: true,
        onTop: true,
      },
      {
        file: "leek.glb",
        width: 0.34,
        at: [0.32, -0.25],
        yaw: -0.2,
        lay: true,
        onTop: true,
      },
      { file: "onion.glb", width: 0.1, at: [0.77, -0.02], onTop: true },
      { file: "loafRound.glb", width: 0.31, at: [0.72, 0.2], onTop: true },
      { file: "mug.glb", width: 0.17, at: [0.14, 0.18], yaw: 0.5, onTop: true },
      { file: "mortarPestle.glb", width: 0.06, at: [0.86, 0.23], onTop: true },
    ],
    flame: { at: [-0.5, 0], y: 0.045, size: 0.54 },
  },
  // Kenney's survival workbench and its grindstone, on their two tiles (#225).
  workbench: {
    parts: [
      { file: "workbench.glb", width: 0.9, at: [-0.5, 0] },
      { file: "workbenchGrind.glb", width: 0.91, at: [0.5, 0] },
    ],
  },
  // Kenney's graveyard altar, the rune altar's stone slab (#232), with a ring stone behind it on
  // the north tile and an obelisk on each side tile.
  altar: {
    parts: [
      { file: "altarStone.glb", width: 1, at: [0, 0.5] },
      { file: "statueRing.glb", width: 0.58, at: [0, -0.5] },
      { file: "statueObelisk.glb", width: 0.47, at: [-1, 0.4] },
      { file: "statueObelisk.glb", width: 0.47, at: [1, 0.4] },
    ],
  },
};
