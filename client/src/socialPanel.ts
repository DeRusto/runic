import { FRIENDS, type Friend } from "@runic/shared";
import { sheetKey } from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";

/** The floating window of friends (and, later, ignored players), opened from the bar or with O. */
export function showSocialPanel(room: WorldConnection) {
  const panel = document.getElementById("social")!;
  const button = document.getElementById("social-button")!;
  const list = document.getElementById("friends")!;
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    button.setAttribute("aria-pressed", String(open));
  };
  const toggle = () => setOpen(!!panel.hidden);
  setOpen(false);
  button.onclick = toggle;
  document.getElementById("social-close")!.onclick = () => setOpen(false);
  // Beside the sheet's document.onkeydown, never in place of it.
  const onKey = (event: KeyboardEvent) => {
    const key = sheetKey(event);
    if (key === "o" || key === "O") toggle();
    if (key === "Escape") setOpen(false);
  };
  document.addEventListener("keydown", onKey);
  room.onLeave(() => {
    setOpen(false);
    document.removeEventListener("keydown", onKey);
  });

  room.onMessage(FRIENDS, (friends: Friend[]) => {
    list.replaceChildren(
      ...friends.map(({ username, online }) => {
        const row = document.createElement("li");
        const name = document.createElement("span");
        const status = document.createElement("span");
        name.textContent = username;
        status.textContent = online ? "Online" : "Offline";
        row.dataset.online = String(online);
        row.append(name, status);
        return row;
      }),
    );
  });
  // Statuses change while the connection is down, and nothing resends them.
  room.onReconnect(() => room.send(FRIENDS));
  room.send(FRIENDS);
}
