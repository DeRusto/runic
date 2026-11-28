import {
  CAST_INTENT,
  COIN_TURN_CHOOSE_LINE,
  COMBAT_SPELLS,
  coinTurnRefusal,
  combatSpellsInGateOrder,
  levelFor,
  runesLine,
  SPELL_INTENT,
  spellPickRefusal,
  UTILITY_SPELLS,
  utilityRunesLine,
  utilitySpellRefusal,
  utilitySpellsInGateOrder,
  type UtilitySpell,
} from "@runic/shared";
import type { SyncedPlayer } from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";
import {
  slotTakeover,
  takeOverSlots,
  type SlotTakeover,
} from "./slotTakeover.ts";

/** A spell's button: its name, then its costs, then what it does, each a line; the label reads them all. */
function spellButton(name: string, costs: string[], does: string) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "spell";
  const parts = [name, costs.join(" · "), does].map((text) => {
    const part = document.createElement("span");
    part.textContent = text;
    return part;
  });
  button.append(...parts);
  button.setAttribute("aria-label", `${name}: ${[...costs, does].join(", ")}`);
  return button;
}

/**
 * The Spellbook tab: the combat spells in gate order, each a toggle button with its gate, runes,
 * hit bonus and effect, then the utility spells with their gate, runes and what they do. Those
 * above the player's Magic level show greyed, and the picked combat spell pressed (Magic spec §5,
 * §9). A click picks a combat spell or casts a utility spell, or says in the chat why it can't;
 * Coin-turn first asks for an item. Returns what draws the player's own level and pick.
 */
export function showSpellbook(
  room: WorldConnection,
  say: (line: string) => void,
) {
  let me: SyncedPlayer | undefined;
  const spells = combatSpellsInGateOrder().map((spell) => {
    const { name, gate, hitBonus, effect } = COMBAT_SPELLS[spell];
    const button = spellButton(
      name,
      [`Magic ${gate}`, runesLine(spell), `+${hitBonus} hit`],
      effect,
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

  const coinTurn = pickForCoinTurn(room, say, () => me);
  const utilities = utilitySpellsInGateOrder().map((spell) => {
    const { name, gate, does } = UTILITY_SPELLS[spell];
    const button = spellButton(
      name,
      [`Magic ${gate}`, utilityRunesLine(spell)],
      does,
    );
    button.onclick = () => {
      if (!me) return;
      if (spell === "coinTurn") return coinTurn.toggle(button);
      const refusal = utilitySpellRefusal(me, spell);
      if (refusal) say(refusal);
      else room.send(CAST_INTENT, { spell });
    };
    return { spell, gate, button };
  });
  document
    .getElementById("utility-spells")!
    .replaceChildren(...utilities.map(({ button }) => button));

  return (player: SyncedPlayer) => {
    me = player;
    const level = levelFor(player.magicXp);
    for (const { spell, gate, button } of spells) {
      button.setAttribute("aria-disabled", String(level < gate));
      button.setAttribute("aria-pressed", String(player.combatSpell === spell));
    }
    for (const { gate, button } of utilities)
      button.setAttribute("aria-disabled", String(level < gate));
  };
}

/**
 * Coin-turn's two clicks: the spell, then an inventory slot, which casts on that slot. While it
 * waits, the spell shows pressed and it holds the slots' clicks; a second click on the spell, or
 * Cancel on a slot's menu, gives them back to whoever had them (Magic spec §9).
 */
function pickForCoinTurn(
  room: WorldConnection,
  say: (line: string) => void,
  player: () => SyncedPlayer | undefined,
) {
  const spell: UtilitySpell = "coinTurn";
  let waiting: { button: HTMLElement; before?: SlotTakeover } | undefined;
  const stop = () => {
    if (!waiting) return;
    waiting.button.setAttribute("aria-pressed", "false");
    // A window that shut meanwhile has let go of the slots already, and gets nothing back.
    if (slotTakeover() === pick) takeOverSlots(waiting.before);
    waiting = undefined;
  };
  const turn = (slot: number) => {
    stop();
    const me = player();
    if (!me) return;
    const refusal = coinTurnRefusal(me, slot);
    if (refusal) say(refusal);
    else room.send(CAST_INTENT, { spell, slot });
  };
  const pick: SlotTakeover = {
    click: turn,
    menu: (slot) => [
      ["Coin-turn", () => turn(slot)],
      ["Cancel", stop],
    ],
  };
  return {
    toggle(button: HTMLElement) {
      if (waiting) return stop();
      const refusal = utilitySpellRefusal(player()!, spell);
      if (refusal) return say(refusal);
      waiting = { button, before: takeOverSlots(pick) };
      button.setAttribute("aria-pressed", "true");
      say(COIN_TURN_CHOOSE_LINE);
    },
  };
}
