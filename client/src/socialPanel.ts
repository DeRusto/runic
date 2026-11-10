import {
  CHAT,
  FRIENDS_LIST,
  IGNORE_LIST,
  LIST_FRIENDS_INTENT,
  LIST_IGNORES_INTENT,
  type Friend,
} from "@runic/shared";
import { panelKey } from "./characterSheet.ts";
import { leftPanel } from "./leftPanels.ts";
import type { WorldConnection } from "./players.ts";

/** The floating window of friends and ignored players, opened from the bar or with O. */
export function showSocialPanel(room: WorldConnection) {
  const panel = document.getElementById("social")!;
  const button = document.getElementById("social-button")!;
  const list = document.getElementById("friends")!;
  const setOpen = (open: boolean) => {
    if (open) left.opening();
    panel.hidden = !open;
    button.setAttribute("aria-pressed", String(open));
  };
  const left = leftPanel(() => setOpen(false));
  const toggle = () => setOpen(!!panel.hidden);
  setOpen(false);
  button.onclick = toggle;
  document.getElementById("social-close")!.onclick = () => setOpen(false);
  // Beside the sheet's document.onkeydown, never in place of it.
  const onKey = (event: KeyboardEvent) => {
    const key = panelKey(event);
    if (key === "o" || key === "O") toggle();
    if (key === "Escape") setOpen(false);
  };
  document.addEventListener("keydown", onKey);
  room.onLeave(() => {
    setOpen(false);
    left.forget();
    document.removeEventListener("keydown", onKey);
  });

  const tabs = ["friends", "ignores"].map((name) => ({
    tab: document.getElementById(`social-tab-${name}`)!,
    pane: document.getElementById(`social-${name}`)!,
  }));
  for (const chosen of tabs) {
    chosen.tab.onclick = () => {
      for (const { tab, pane } of tabs) {
        tab.setAttribute("aria-selected", String(tab === chosen.tab));
        pane.hidden = tab !== chosen.tab;
      }
    };
  }

  room.onMessage(FRIENDS_LIST, (friends: Friend[]) => {
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
  // Names only, no status (Phase 4 map). The server decides what is ignored; this only lists it.
  room.onMessage(IGNORE_LIST, (names: string[]) => {
    document.getElementById("ignores")!.replaceChildren(
      ...names.map((username) => {
        const row = document.createElement("li");
        const name = document.createElement("span");
        const unignore = document.createElement("button");
        name.textContent = username;
        unignore.textContent = "Unignore";
        unignore.onclick = () => room.send(CHAT, `/unignore ${username}`);
        row.append(name, unignore);
        return row;
      }),
    );
  });
  room.send(LIST_IGNORES_INTENT);
  // Statuses change while the connection is down, and nothing resends them.
  room.onReconnect(() => {
    room.send(LIST_FRIENDS_INTENT);
    room.send(LIST_IGNORES_INTENT);
  });
  room.send(LIST_FRIENDS_INTENT);
}
