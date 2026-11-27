/** The colors a player's Knight comes in, by its cape; KayKit made it Crimson. */
export const KNIGHT_COLORS = {
  crimson: "Crimson",
  azure: "Azure",
  emerald: "Emerald",
  gold: "Gold",
  violet: "Violet",
  onyx: "Onyx",
  ivory: "Ivory",
} as const;
export type KnightColor = keyof typeof KNIGHT_COLORS;

/** The skin tones a player's Knight comes in, lightest first; KayKit made it Fair. */
export const SKIN_TONES = {
  porcelain: "Porcelain",
  fair: "Fair",
  tan: "Tan",
  olive: "Olive",
  brown: "Brown",
  deep: "Deep",
} as const;
export type SkinTone = keyof typeof SKIN_TONES;

/** A new player's look, and the save columns' defaults. */
export const STARTING_KNIGHT_COLOR: KnightColor = "crimson";
export const STARTING_SKIN_TONE: SkinTone = "fair";

/** Whether an untrusted value names a color. */
export const isKnightColor = (value: unknown): value is KnightColor =>
  typeof value === "string" && Object.hasOwn(KNIGHT_COLORS, value);

/** Whether an untrusted value names a skin tone. */
export const isSkinTone = (value: unknown): value is SkinTone =>
  typeof value === "string" && Object.hasOwn(SKIN_TONES, value);
