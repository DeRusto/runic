import {
  refreshEffect,
  type ActiveSpellEffect,
  type SpellEffect,
  type SpellElement,
} from "@runic/shared";
import type { SyncedEnemy } from "./enemyState.ts";

const ELEMENTS = [
  "air",
  "water",
  "earth",
] as const satisfies readonly SpellElement[];

/** One running effect per element. Synced flags tell the client what to show. */
export class EnemyEffects {
  private active: Partial<Record<SpellElement, ActiveSpellEffect>> = {};

  get accuracyPenalty() {
    return this.active.air?.strength ?? 0;
  }

  apply(
    enemy: SyncedEnemy,
    effect: SpellEffect,
    tick: number,
    nextSwingTick: number,
  ) {
    const { element } = effect;
    const startTick =
      element === "water" ? Math.max(tick, nextSwingTick) : tick;
    this.active[element] = refreshEffect(
      effect,
      this.active[element],
      tick,
      startTick,
    );
    enemy[element] = true;
  }

  advance(enemy: SyncedEnemy, tick: number) {
    for (const element of ELEMENTS) {
      const effect = this.active[element];
      if (effect && tick >= effect.endTick) {
        delete this.active[element];
        enemy[element] = false;
      }
    }
  }

  clear(enemy: SyncedEnemy) {
    this.active = {};
    for (const element of ELEMENTS) enemy[element] = false;
  }
}
