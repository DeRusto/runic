import {
  COMBAT_SPELLS,
  combatSpellsInGateOrder,
  levelFor,
  runesLine,
  SPELL_INTENT,
  spellPickRefusal,
} from "@runic/shared";
import type { SyncedPlayer } from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";

/**
 * The Spellbook tab: the combat spells in gate order, each a toggle button with its gate, runes,
 * hit bonus and effect. Those above the player's Magic level show greyed, and the picked one
 * pressed (Magic spec §5). A click picks it, or says in the chat why it can't be picked. Returns
 * what draws the player's own level and pick.
 */
export function showSpellbook(
  room: WorldConnection,
  say: (line: string) => void,
) {
  let me: SyncedPlayer | undefined;
  const spells = combatSpellsInGateOrder().map((spell) => {
    const { name, gate, hitBonus, effect } = COMBAT_SPELLS[spell];
    const costs = `Magic ${gate} · ${runesLine(spell)} · +${hitBonus} hit`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "spell";
    const parts = [name, costs, effect].map((text) => {
      const part = document.createElement("span");
      part.textContent = text;
      return part;
    });
    button.append(...parts);
    button.setAttribute(
      "aria-label",
      `${name}: Magic ${gate}, ${runesLine(spell)}, +${hitBonus} hit, ${effect}`,
    );
    // Off by aria-disabled, not disabled, so a click still says why.
    button.onclick = () => {
      if (!me) return;
      const refusal = spellPickRefusal(me, spell);
      if (refusal) say(refusal);
      else room.send(SPELL_INTENT, spell);
    };
    return { spell, gate, button };
  });
  document
    .getElementById("spellbook")!
    .replaceChildren(...spells.map(({ button }) => button));

  return (player: SyncedPlayer) => {
    me = player;
    const level = levelFor(player.magicXp);
    for (const { spell, gate, button } of spells) {
      button.setAttribute("aria-disabled", String(level < gate));
      button.setAttribute("aria-pressed", String(player.combatSpell === spell));
    }
  };
}
