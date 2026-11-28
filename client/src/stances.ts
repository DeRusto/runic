import {
  RANGED_STANCES,
  rangedWeaponOf,
  STANCE_INTENT,
  STANCES,
  wieldsStaff,
} from "@runic/shared";
import type { SyncedPlayer } from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";
import { addTip } from "./tooltip.ts";

/**
 * The Gear tab's stance buttons, which show only the stances of the weapon in hand: Balanced,
 * Precise and Forceful with a sword or bare hands, and Steady, Rapid and Longrange with a bow or
 * knives (Ranged spec §6), and none with a staff (Magic spec §5). Returns what draws the player's own as pressed.
 */
export function showStances(room: WorldConnection) {
  // Toggle buttons, one pressed, so each is a plain button a keyboard reaches.
  const stanceGroup = document.getElementById("stance")!;
  stanceGroup.setAttribute("aria-label", "Stance");
  // Said in words too, not only in the tooltip, so a keyboard or screen reader learns it.
  const stanceTrains = document.getElementById("stance-trains")!;
  stanceGroup.setAttribute("aria-describedby", "stance-trains");
  /** One toggle button per stance in `table`, each sending its own id. */
  const stanceButtons = <Id extends string>(
    table: Record<Id, { name: string; trains: string }>,
  ) =>
    (Object.keys(table) as Id[]).map((stance) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = table[stance].name;
      // Each says what it trains in its name too, since the tooltip is pointer-only.
      button.setAttribute(
        "aria-label",
        `${table[stance].name}: ${table[stance].trains}`,
      );
      button.onclick = () => room.send(STANCE_INTENT, stance);
      addTip(button, () => table[stance].trains);
      return { stance, button };
    });
  const meleeStances = stanceButtons(STANCES);
  const rangedStances = stanceButtons(RANGED_STANCES);
  let stancesShown: "melee" | "ranged" | "magic" | undefined;

  /** Swaps the buttons only when the style in hand changes, so a screen reader isn't handed new ones each patch. */
  return (me: SyncedPlayer) => {
    // Magic has no stances (Magic spec §5).
    if (wieldsStaff(me)) {
      if (stancesShown !== "magic") stanceGroup.replaceChildren();
      stancesShown = "magic";
      stanceTrains.textContent = "A staff has no stances.";
      return;
    }
    const style = rangedWeaponOf(me) ? "ranged" : "melee";
    const { buttons, chosen, trains } =
      style === "ranged"
        ? {
            buttons: rangedStances,
            chosen: me.rangedStance,
            trains: RANGED_STANCES[me.rangedStance]?.trains,
          }
        : {
            buttons: meleeStances,
            chosen: me.stance,
            trains: STANCES[me.stance]?.trains,
          };
    if (stancesShown !== style)
      stanceGroup.replaceChildren(...buttons.map(({ button }) => button));
    stancesShown = style;
    for (const { stance, button } of buttons)
      button.setAttribute("aria-pressed", String(chosen === stance));
    stanceTrains.textContent = trains ?? "";
  };
}
