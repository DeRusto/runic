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
  const logout = document.getElementById("logout")!;
  // Back to the button that opened it, so a keyboard player keeps their place.
  const close = () => {
    setOpen(false);
    logout.focus();
  };
  setOpen(false);
  logout.onclick = () => (box.hidden ? setOpen(true) : close());
  document.getElementById("logout-confirm-no")!.onclick = close;
  // The server decides: a log out refused during a combat lock is silent, and the player stays in.
  document.getElementById("logout-confirm-yes")!.onclick = () => {
    close();
    room.send(LOGOUT_INTENT);
  };
  // In the capture phase, so the box takes Escape before any panel's listener sees it.
  const onKey = (event: KeyboardEvent) => {
    if (panelKey(event) !== "Escape" || box.hidden) return;
    close();
    event.stopPropagation();
  };
  document.addEventListener("keydown", onKey, true);
  room.onLeave(() => {
    setOpen(false);
    document.removeEventListener("keydown", onKey, true);
  });
}
