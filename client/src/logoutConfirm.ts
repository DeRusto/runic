import { LOGOUT_INTENT } from "@runic/shared";
import { panelKey } from "./panels.ts";
import type { WorldConnection } from "./players.ts";

/** The bar's Log out button opens a "Log out?" box, and only its Log out sends the intent (spec §7). */
export function showLogoutConfirm(room: WorldConnection) {
  const box = document.getElementById("logout-confirm")!;
  const setOpen = (open: boolean) => {
    box.hidden = !open;
    if (open) document.getElementById("logout-confirm-no")!.focus();
  };
  setOpen(false);
  document.getElementById("logout")!.onclick = () => setOpen(!!box.hidden);
  document.getElementById("logout-confirm-no")!.onclick = () => setOpen(false);
  // The server decides, so a refusal shows its usual line and the player stays in.
  document.getElementById("logout-confirm-yes")!.onclick = () => {
    setOpen(false);
    room.send(LOGOUT_INTENT);
  };
  // In the capture phase, so the box takes Escape before any panel's listener sees it.
  const onKey = (event: KeyboardEvent) => {
    if (panelKey(event) !== "Escape" || box.hidden) return;
    setOpen(false);
    event.stopPropagation();
  };
  document.addEventListener("keydown", onKey, true);
  room.onLeave(() => {
    setOpen(false);
    document.removeEventListener("keydown", onKey, true);
  });
}
