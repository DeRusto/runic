import type { CombatSpell } from "./magic.ts";

export type SpellElement = "air" | "water" | "earth";

export type SpellEffect = {
  element: SpellElement;
  strength: number;
  durationTicks: number;
};

/** An effect runs up to, but does not include, its end tick. */
export type ActiveSpellEffect = SpellEffect & { endTick: number };

// Magic spec §8. Air strength is Accuracy points, and water and earth strength is ticks.
const EFFECTS: Partial<Record<CombatSpell, SpellEffect>> = {
  airDart: { element: "air", strength: 5, durationTicks: 20 },
  airSurge: { element: "air", strength: 10, durationTicks: 20 },
  waterDart: { element: "water", strength: 4, durationTicks: 4 },
  waterSurge: { element: "water", strength: 8, durationTicks: 8 },
  earthDart: { element: "earth", strength: 6, durationTicks: 6 },
  earthSurge: { element: "earth", strength: 12, durationTicks: 12 },
};

export const effectOf = (spell: CombatSpell) => EFFECTS[spell];

/** Restarts the same element's strongest running effect. Water starts its delay at the undelayed swing. */
export function refreshEffect(
  incoming: SpellEffect,
  current: ActiveSpellEffect | undefined,
  tick: number,
  startTick = tick,
): ActiveSpellEffect {
  const effect =
    current && tick < current.endTick && current.strength > incoming.strength
      ? current
      : incoming;
  return { ...effect, endTick: startTick + effect.durationTicks };
}
