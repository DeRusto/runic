import {
  CLOSE_STORE_INTENT,
  DEAL_INTENT,
  dealRefusal,
  dealTotals,
  EVENTS,
  heldCount,
  itemParts,
  SHELF_SLOTS,
  sellRefusal,
  storePaysFor,
  valueOf,
  type Deal,
  type WorldEvent,
} from "@runic/shared";
import { takeOverSlots } from "./bottomBar.ts";
import type { OpenMenu } from "./characterSheet.ts";
import { iconUrl, itemName } from "./itemIcons.ts";
import { itemTip, itemTipParts } from "./itemTip.ts";
import { amountChoices } from "./movingItems.ts";
import { addPanel } from "./panels.ts";
import type { WorldConnection } from "./players.ts";
import { addTip } from "./tooltip.ts";

const coins = (count: number) => `${count} coin${count === 1 ? "" : "s"}`;

/**
 * The store window (village spec §5): the shelf's slots at the top, and below them the counter, with
 * a tray of what the player buys and one of what they sell, which one Deal settles. Nothing
 * changes hands before Deal. The server opens it, and closes it on a walk away or a hit.
 */
export function showStoreWindow(room: WorldConnection, openMenu: OpenMenu) {
  const panel = document.getElementById("store")!;
  const shelfSlots = document.getElementById("store-shelf")!;
  const buyTray = document.getElementById("store-buy")!;
  const sellTray = document.getElementById("store-sell")!;
  const sum = document.getElementById("store-sum")!;
  const dealButton = document.getElementById("store-deal") as HTMLButtonElement;
  const status = document.getElementById("store-status")!;
  const buying = new Map<string, number>();
  /** How many of each item on the buy tray the shelf held when it was first put there, which the server checks is unchanged. */
  const seen = new Map<string, number>();
  const selling = new Map<string, number>();
  /** The last line from outside the trays, such as why coins can't be sold. */
  let note = "";
  /** A deal sent and not yet answered, so a second press can't send it twice. */
  let dealing = false;

  const state = () => room.state;
  const me = () => state().players.get(room.sessionId);
  const stockOf = (item: string) => {
    const at = [...state().shelf].indexOf(item);
    return at < 0 ? 0 : state().shelfCounts[at]!;
  };
  const heldOf = (item: string) => {
    const player = me();
    return player
      ? heldCount([...player.inventory], [...player.inventoryCounts], item)
      : 0;
  };
  const dealOf = (): Deal => ({
    buy: [...buying].map(([item, count]) => ({
      item,
      count,
      stock: seen.get(item)!,
    })),
    sell: [...selling].map(([item, count]) => ({ item, count })),
  });
  /** Adds `amount` to a tray line, up to `max`. */
  const put = (
    tray: Map<string, number>,
    item: string,
    amount: number,
    max: number,
  ) => {
    tray.set(item, Math.min(max, (tray.get(item) ?? 0) + amount));
    if (!tray.get(item)) tray.delete(item);
    note = "";
    drawTrays();
  };

  // Changed only in place, so a patch landing between a press and its release can't lose the click.
  const slots = Array.from({ length: SHELF_SLOTS }, (_, at) => {
    const slot = document.createElement("button");
    slot.type = "button";
    const buy = (amount: number) => {
      const item = slot.dataset.item;
      if (!item) return;
      // Stamped once, so a later click can't hide a change since the line was set out (village spec §5).
      if (!buying.has(item)) seen.set(item, stockOf(item));
      put(buying, item, amount, stockOf(item));
    };
    slot.onclick = () => buy(1);
    slot.oncontextmenu = (event) => {
      event.preventDefault();
      const item = slot.dataset.item;
      if (item) openMenu(event, amountChoices("Buy", stockOf(item), buy));
    };
    addTip(slot, () => {
      const item = state().shelf[at];
      if (!item) return "";
      const tip = itemTip(item);
      tip.stats = [...tip.stats, `Costs ${coins(valueOf(item))}`];
      return itemTipParts(tip);
    });
    return slot;
  });
  shelfSlots.replaceChildren(...slots);

  const drawShelf = () => {
    slots.forEach((slot, at) => {
      const item = state().shelf[at] ?? "";
      const left = item ? stockOf(item) - (buying.get(item) ?? 0) : 0;
      slot.dataset.item = item;
      slot.dataset.count = item ? String(left) : "";
      slot.dataset.empty = String(!left);
      slot.style.setProperty("--icon", item && `url("${iconUrl(item)}")`);
      slot.ariaLabel = item ? `${itemName(item)}, ${left} left` : null;
      slot.ariaDisabled = String(!left);
    });
  };

  const trayLines = (
    tray: Map<string, number>,
    priceOf: (item: string) => number,
  ) => {
    if (!tray.size) {
      const empty = document.createElement("p");
      empty.textContent = "Nothing yet";
      return [empty];
    }
    return [...tray].map(([item, count]) => {
      const row = document.createElement("div");
      const name = document.createElement("span");
      name.className = itemParts(item).quality;
      name.textContent = `${count} × ${itemName(item)}`;
      const price = document.createElement("span");
      price.textContent = coins(priceOf(item) * count);
      const takeBack = document.createElement("button");
      takeBack.type = "button";
      takeBack.ariaLabel = `Take back ${itemName(item)}`;
      takeBack.onclick = () => {
        tray.delete(item);
        drawTrays();
      };
      row.append(name, price, takeBack);
      return row;
    });
  };

  const drawTrays = () => {
    buyTray.replaceChildren(...trayLines(buying, valueOf));
    sellTray.replaceChildren(
      ...trayLines(selling, (item) => storePaysFor(valueOf(item))),
    );
    drawShelf();
    drawDeal();
  };

  const drawDeal = () => {
    const player = me();
    const deal = dealOf();
    const { pay, get } = dealTotals(deal);
    const net = get - pay;
    sum.textContent = `You pay ${pay} · you get ${get} · ${net < 0 ? "−" : "+"}${coins(Math.abs(net))}`;
    const empty = !buying.size && !selling.size;
    const refusal = player && !empty && dealRefusal(deal, player, state());
    dealButton.disabled = empty || !!refusal || !player || dealing;
    status.classList.toggle("refused", !!refusal);
    status.textContent =
      refusal ||
      (empty
        ? note || "Click the shelf to buy, and your items below to sell."
        : "Press Deal to settle both trays.");
  };

  // The trays stay until the server answers, so a refused deal can be fixed and sent again.
  dealButton.onclick = () => {
    room.send(DEAL_INTENT, dealOf());
    dealing = true;
    drawDeal();
  };

  /** Puts `amount` of an inventory item on the sell tray. */
  const sell = (item: string, amount: number) => {
    const refusal = sellRefusal(item);
    if (!refusal) return put(selling, item, amount, heldOf(item));
    note = refusal;
    drawDeal();
  };

  const shut = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    placed.closed();
    takeOverSlots(undefined);
    // Or an amount menu left open could put lines back on the cleared trays.
    document.getElementById("slot-menu")!.hidden = true;
    buying.clear();
    selling.clear();
    dealing = false;
  };
  const close = () => {
    if (panel.hidden) return;
    shut();
    room.send(CLOSE_STORE_INTENT);
  };
  const placed = addPanel(panel, close);
  document.getElementById("store-close")!.onclick = close;

  const open = () => {
    note = "";
    takeOverSlots({
      click: (_, item) => sell(item, 1),
      menu: (_, item) =>
        amountChoices("Sell", heldOf(item), (n) => sell(item, n)),
    });
    drawTrays();
    if (!panel.hidden) return;
    panel.hidden = false;
    placed.opened();
  };

  room.onMessage(EVENTS, (events: WorldEvent[]) => {
    for (const event of events) {
      if (event.type === "storeOpened" && event.player === room.sessionId)
        open();
      else if (event.type === "storeClosed" && event.player === room.sessionId)
        shut();
      else if (
        event.type === "dealAnswered" &&
        event.player === room.sessionId
      ) {
        dealing = false;
        if (event.done) {
          buying.clear();
          selling.clear();
        }
        drawTrays();
      }
    }
  });
  room.onStateChange(() => {
    if (panel.hidden) return;
    drawShelf();
    drawDeal();
  });
  room.onLeave(shut);
}
