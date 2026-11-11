import { panelKey } from "./characterSheet.ts";
import { addTip, type TipContent } from "./tooltip.ts";

/** The square buttons at the bar's right end, in bar order (spec §7). */
const BAR_BUTTON_IDS = [
  "turn-left",
  "turn-right",
  "character",
  "social-button",
  "logout",
];

/** A bar button's tip: its name, then its hotkey in a key box. Log out has no hotkey, so shows only its name (spec §7). */
export function barButtonTip(button: HTMLElement): TipContent {
  const name = button.ariaLabel ?? "";
  const key = button.getAttribute("aria-keyshortcuts");
  if (!key) return name;
  const box = document.createElement("kbd");
  box.textContent = key;
  return [name, box];
}

/** Gives each bar button its tip, and shows a button pressed while its hotkey is held (spec §7). */
export function addBarButtons() {
  const buttons = BAR_BUTTON_IDS.map((id) => document.getElementById(id)!);
  for (const button of buttons) addTip(button, () => barButtonTip(button));
  const press = (key: string, down: boolean) => {
    for (const button of buttons) {
      if (button.getAttribute("aria-keyshortcuts") === key.toUpperCase()) {
        button.classList.toggle("pressed", down);
      }
    }
  };
  addEventListener("keydown", (event) => press(panelKey(event), true));
  // Any release lets go, even one in chat, so a button never sticks pressed.
  addEventListener("keyup", (event) => press(event.key, false));
}
