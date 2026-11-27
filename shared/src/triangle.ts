import { gearOf, type GearSlot } from "./gear.ts";

/** How a fighter fights: a player's comes from the weapon in hand, an enemy's from its stats (#271). Magic has no fighters until Phase 9. */
export type Style = "melee" | "ranged" | "magic";

/** The style each style beats: melee beats ranged, ranged beats magic, magic beats melee (#72, #271). */
const BEATS: Record<Style, Style> = {
  melee: "ranged",
  ranged: "magic",
  magic: "melee",
};

/** Points on the Accuracy and Avoidance scale a winning style gains, and a losing one loses, to land a hit (#271, Ranged spec §8). */
export const TRIANGLE_POINTS = 10;

/** What the triangle does to the chance of a `style` fighter to land on an `against` fighter, in points: +10, −10 or 0. */
export const trianglePointsOf = (style: Style, against: Style) =>
  BEATS[style] === against
    ? TRIANGLE_POINTS
    : BEATS[against] === style
      ? -TRIANGLE_POINTS
      : 0;

/** A player's style, from the weapon in hand now: a bow or throwing knives are ranged, and a sword or bare hands melee (#271). */
export const playerStyleOf = (
  player: Partial<Record<GearSlot, string>>,
): Style =>
  gearOf(player.weapon ?? "")?.reachTiles === undefined ? "melee" : "ranged";
