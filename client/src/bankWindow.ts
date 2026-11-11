import {
  BANK_MOVE_INTENT,
  BANK_SLOTS,
  CLOSE_BANK_INTENT,
  DEPOSIT_INTENT,
  DEPOSIT_INVENTORY_INTENT,
  EMPTY_SLOT,
  EVENTS,
  WITHDRAW_INTENT,
  type WorldEvent,
} from "@runic/shared";
import { depositOnClick } from "./bottomBar.ts";
import type { OpenMenu, SyncedPlayer } from "./characterSheet.ts";
import { iconUrl, itemName } from "./itemIcons.ts";
import { itemTip, itemTipParts } from "./itemTip.ts";
import { amountChoices, dragToReorder } from "./movingItems.ts";
import { addPanel } from "./panels.ts";
import type { WorldConnection } from "./players.ts";
import { addTip } from "./tooltip.ts";

/**
 * The bank window (#197): a 12×8 grid the server opens beside Aldous. A click withdraws a whole
 * slot and the inventory's slots deposit while it is open; right-click asks how many.
 */
export function showBankWindow(room: WorldConnection, openMenu: OpenMenu) {
  const panel = document.getElementById("bank")!;
  const used = document.getElementById("bank-used")!;
  let me: SyncedPlayer | undefined;

  const hide = () => {
    panel.hidden = true;
    placed.closed();
    depositOnClick(undefined);
  };
  /** The player shut it, so the server stops expecting them beside Aldous. */
  const close = () => {
    hide();
    room.send(CLOSE_BANK_INTENT);
  };
  const placed = addPanel(panel, close, "right");
  document.getElementById("bank-close")!.onclick = close;
  document.getElementById("bank-deposit-all")!.onclick = () =>
    room.send(DEPOSIT_INVENTORY_INTENT);

  const slots = Array.from({ length: BANK_SLOTS }, (_, i) => {
    const slot = document.createElement("button");
    slot.type = "button";
    const count = () => me?.bankCounts[i] ?? 0;
    const withdraw = (amount: number) =>
      room.send(WITHDRAW_INTENT, { slot: i, amount });
    // The server takes as many as fit.
    slot.onclick = () => count() && withdraw(count());
    slot.oncontextmenu = (event) => {
      event.preventDefault();
      if (count())
        openMenu(event, amountChoices("Withdraw", count(), withdraw));
    };
    addTip(slot, () => {
      const item = me?.bank[i];
      return item && me ? itemTipParts(itemTip(item, me)) : "";
    });
    return slot;
  });
  document.getElementById("bank-slots")!.replaceChildren(...slots);
  dragToReorder(slots, (from, to) => room.send(BANK_MOVE_INTENT, { from, to }));

  const draw = () => {
    if (!me) return;
    let filled = 0;
    slots.forEach((slot, i) => {
      const item = me!.bank[i] ?? EMPTY_SLOT;
      const count = me!.bankCounts[i] ?? 0;
      if (item) filled++;
      slot.ariaLabel = item ? itemName(item) : null;
      slot.style.setProperty("--icon", item && `url("${iconUrl(item)}")`);
      slot.ariaDisabled = String(!item);
      slot.draggable = !!item;
      slot.dataset.count = count > 1 ? count.toLocaleString("en") : "";
    });
    used.textContent = `${filled} / ${BANK_SLOTS}`;
  };

  room.onStateChange((state) => {
    me = state.players.get(room.sessionId);
    if (!panel.hidden) draw();
  });
  room.onMessage(EVENTS, (events: WorldEvent[]) => {
    for (const event of events) {
      if (!("player" in event) || event.player !== room.sessionId) continue;
      if (event.type === "bankOpened") {
        panel.hidden = false;
        draw();
        placed.opened();
        depositOnClick((slot, amount) =>
          room.send(DEPOSIT_INTENT, { slot, amount }),
        );
      } else if (event.type === "bankClosed") hide();
    }
  });
  hide();
  room.onLeave(hide);
}
