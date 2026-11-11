// PROTOTYPE, throwaway (wayfinder ticket #198): three ways the general store's window could look
// and play, switchable by ?variant=A|B|C and the floating bar. Client-only: the stock, the coins
// and the inventory shown while the store is open are fakes kept here; nothing reaches the server.
import { ITEMS, itemParts, STACK_SIZE } from "@runic/shared";
import { printChatLine } from "./bottomBar.ts";
import type { OpenMenu } from "./characterSheet.ts";
import { iconUrl, itemName } from "./itemIcons.ts";
import { itemTip, itemTipParts } from "./itemTip.ts";
import { addPanel } from "./panels.ts";
import { addTip, hideTip } from "./tooltip.ts";

// ---- The fake store, by the rules in #196 (values are placeholders: copper ore = 2, the rest guessed). ----

const COINS = "coins";
const RAW: Record<string, number> = {
  berry: 1,
  herb: 2,
  copperOre: 2,
  tin: 2,
  coal: 3,
  emberbone: 4,
  ironOre: 5,
  emberiteOre: 12,
  ashstone: 10,
  cinderglass: 20,
  heartflame: 50,
};
const BARS: Record<string, number> = {
  copper: 4,
  bronze: 4,
  iron: 8,
  steel: 14,
  emberite: 30,
};
const BARS_IN = { Sword: 2, Shield: 3, Helmet: 2, Chestplate: 5, Leggings: 3 };
const QUALITY_TIMES = { common: 1, uncommon: 2, rare: 4 };

function valueOf(item: string) {
  const { base, quality } = itemParts(item);
  const bar = base.match(/^(\w+?)Bar$/);
  const gear = base.match(/^(copper|bronze|iron|steel|emberite)(\w+)$/);
  const common = RAW[base]
    ? RAW[base]
    : bar
      ? BARS[bar[1]!]!
      : gear
        ? BARS[gear[1]!]! * BARS_IN[gear[2] as keyof typeof BARS_IN]
        : 1;
  return common * QUALITY_TIMES[quality];
}
/** What the store pays for `n`: 40% of value, rounded down on the total. */
const offerFor = (item: string, n: number) =>
  Math.floor(n * valueOf(item) * 0.4);

type Held = { item: string; count: number } | null;
type ShelfSlot = { item: string; count: number; starting: boolean };
type Store = { inv: Held[]; shelf: ShelfSlot[] };

const fresh = (): Store => ({
  inv: [
    { item: COINS, count: 15 },
    { item: "copperOre", count: 20 },
    { item: "copperOre", count: 7 },
    { item: "coal", count: 6 },
    { item: "copperBar", count: 3 },
    { item: "copperSword", count: 1 },
    { item: "bronzeHelmet:uncommon:might", count: 1 },
    { item: "berry", count: 4 },
    ...Array<Held>(22).fill(null),
  ],
  shelf: [
    { item: "berry", count: 20, starting: true },
    { item: "herb", count: 10, starting: true },
    { item: "copperOre", count: 5, starting: true },
    { item: "coal", count: 5, starting: true },
    { item: "ironOre", count: 3, starting: false },
    { item: "copperShield", count: 1, starting: false },
    { item: "ironSword:rare:fortitude", count: 1, starting: false },
  ],
});
let store = fresh();

const stackOf = (item: string) =>
  item === COINS ? Infinity : ITEMS[itemParts(item).base].stack;
const held = (s: Store, item: string) =>
  s.inv.reduce((n, h) => n + (h?.item === item ? h.count : 0), 0);
/** How many of `item` the inventory has room for. */
const room = (s: Store, item: string) =>
  s.inv.reduce(
    (n, h) =>
      n +
      (!h ? stackOf(item) : h.item === item ? stackOf(item) - h.count : 0),
    0,
  );
function add(s: Store, item: string, n: number) {
  for (const h of s.inv)
    if (h?.item === item) {
      const put = Math.min(n, stackOf(item) - h.count);
      h.count += put;
      n -= put;
    }
  for (let i = 0; n > 0 && i < s.inv.length; i++)
    if (!s.inv[i]) {
      const put = Math.min(n, stackOf(item));
      s.inv[i] = { item, count: put };
      n -= put;
    }
}
function take(s: Store, item: string, n: number) {
  for (let i = s.inv.length - 1; n > 0 && i >= 0; i--) {
    const h = s.inv[i];
    if (h?.item !== item) continue;
    const off = Math.min(n, h.count);
    h.count -= off;
    n -= off;
    if (!h.count) s.inv[i] = null;
  }
}
const SHELF_SLOTS = 40;
function shelve(s: Store, item: string, n: number) {
  const slot = s.shelf.find((x) => x.item === item);
  if (slot) slot.count += n;
  else if (s.shelf.length < SHELF_SLOTS)
    s.shelf.push({ item, count: n, starting: false });
}

type Result = { done: number; line: string; refused: boolean };

/** Buys up to `want` of shelf slot `at`: as many as are in stock, affordable and fit. */
function buy(s: Store, at: number, want: number): Result {
  const slot = s.shelf[at]!;
  const price = valueOf(slot.item);
  const afford = Math.floor(held(s, COINS) / price);
  const fit = room(s, slot.item);
  const done = Math.min(want, slot.count, afford, fit);
  const name = itemName(slot.item);
  if (!done)
    return {
      done,
      refused: true,
      line: !slot.count
        ? `The store has no ${name.toLowerCase()} left.`
        : !afford
          ? `You need ${price} coins for that.`
          : "Your inventory is full.",
    };
  take(s, COINS, done * price);
  add(s, slot.item, done);
  slot.count -= done;
  if (!slot.count && !slot.starting) s.shelf.splice(at, 1);
  const short =
    done < want && want !== Infinity
      ? done === afford
        ? ` That's all you could afford.`
        : done === fit
          ? ` That's all you had room for.`
          : ` That's all the store had.`
      : "";
  return {
    done,
    refused: false,
    line: `You buy ${done} ${name.toLowerCase()} for ${done * price} coins.${short}`,
  };
}

/** Sells up to `want` of `item` from anywhere in the inventory. */
function sell(s: Store, item: string, want: number): Result {
  const name = itemName(item);
  if (item === COINS)
    return { done: 0, refused: true, line: "The store doesn't buy coins." };
  const done = Math.min(want, held(s, item));
  const pay = offerFor(item, done);
  const after = structuredClone(s);
  take(after, item, done);
  if (pay && room(after, COINS) < pay)
    return { done: 0, refused: true, line: "Your inventory is full." };
  take(s, item, done);
  add(s, COINS, pay);
  shelve(s, item, done);
  return {
    done,
    refused: false,
    line: `You sell ${done} ${name.toLowerCase()} for ${pay} coin${pay === 1 ? "" : "s"}.`,
  };
}

// ---- Shared bits every variant draws with. ----

const COIN_ICON = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='13' cy='18' r='9' fill='#b8862c' stroke='#5a3d10' stroke-width='2'/><circle cx='19' cy='13' r='9' fill='#e8c060' stroke='#7a5418' stroke-width='2'/><circle cx='19' cy='13' r='5' fill='none' stroke='#b8862c' stroke-width='1.5'/></svg>`,
)}")`;
const icon = (item: string) =>
  item === COINS ? COIN_ICON : `url("${iconUrl(item)}")`;
const nameOf = (item: string) => (item === COINS ? "Coins" : itemName(item));

function tipFor(item: string, extra: string[]) {
  const lines = extra.map((text) => {
    const div = document.createElement("div");
    div.className = "sp-tip-price";
    div.textContent = text;
    return div;
  });
  if (item === COINS) {
    const div = document.createElement("div");
    div.className = "tip-name";
    div.textContent = "Coins";
    return [div, ...lines];
  }
  return [...itemTipParts(itemTip(item)), ...lines];
}

/** A square slot in the inventory's look, for the shelf. */
function slotButton(item: string | undefined, count: number, size = 36) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sp-slot";
  b.style.width = b.style.height = `${size}px`;
  if (item) {
    b.style.setProperty("--icon", icon(item));
    b.dataset.item = item;
    b.dataset.count = count === 1 && stackOf(item) === 1 ? "" : String(count);
    if (!count) b.dataset.empty = "true";
  }
  return b;
}

const shake = (el: Element | undefined) => {
  el?.classList.remove("sp-shake");
  void (el as HTMLElement | undefined)?.offsetWidth;
  el?.classList.add("sp-shake");
};

/** The "X" amount: a small box at the cursor, Enter to go. */
function askAmount(at: { clientX: number; clientY: number }, go: (n: number) => void) {
  const box = document.createElement("form");
  box.className = "sp-ask";
  box.style.left = `${at.clientX}px`;
  box.style.top = `${at.clientY - 40}px`;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.placeholder = "How many?";
  box.append(input);
  box.onsubmit = (event) => {
    event.preventDefault();
    box.remove();
    const n = Math.floor(Number(input.value));
    if (n > 0) go(n);
  };
  input.onkeydown = (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    box.remove();
  };
  input.onblur = () => box.remove();
  document.body.append(box);
  input.focus();
}

const AMOUNTS = [
  ["1", 1],
  ["5", 5],
  ["10", 10],
  ["X", 0],
  ["All", Infinity],
] as const;

type Ctx = {
  body: HTMLElement;
  setTitle: (text: string) => void;
  redraw: () => void;
  openMenu: OpenMenu;
};
type Variant = {
  name: string;
  draw: (ctx: Ctx) => void;
  /** What a left and right click on the bar's inventory slot `i` does while the store is open. */
  invClick: (i: number, event: MouseEvent, ctx: Ctx) => void;
  invMenu: (i: number, event: MouseEvent, ctx: Ctx) => void;
  /** The extra tooltip lines for inventory slot `i`. */
  invTip: (item: string) => string[];
};

const coinsLine = () => `${held(store, COINS).toLocaleString("en")} coins`;
const offerLine = (item: string) =>
  item === COINS
    ? []
    : [
        `Store pays ${offerFor(item, 1)} for 1` +
          (stackOf(item) > 1 ? `, ${offerFor(item, STACK_SIZE)} for 20` : ""),
      ];

// ---- Variant A: the shelf as a grid of slots, like the inventory. Click for 1, right-click for more. ----
function shelfGrid(): Variant {
  const report = (r: Result, el?: Element) => {
    printChatLine(r.line);
    if (r.refused) shake(el);
  };
  const amountMenu = (
    verb: "Buy" | "Sell",
    item: string,
    each: (n: number) => number,
    act: (n: number) => void,
    ctx: Ctx,
    event: MouseEvent,
  ) =>
    ctx.openMenu(event, [
      ...AMOUNTS.map(
        ([label, n]) =>
          [
            n === 0
              ? `${verb} X`
              : `${verb} ${label}` +
                (n === Infinity ? "" : ` (${each(n)} coins)`),
            () => (n === 0 ? askAmount(event, act) : act(n)),
          ] as const,
      ),
      [
        "Value",
        () =>
          printChatLine(
            `${nameOf(item)} is worth ${valueOf(item)} coins. The store pays ${offerFor(item, 1)}.`,
          ),
      ],
    ]);
  return {
    name: "Shelf grid",
    draw(ctx) {
      ctx.setTitle(`General store · ${coinsLine()}`);
      const grid = document.createElement("div");
      grid.className = "sp-grid";
      for (let i = 0; i < SHELF_SLOTS; i++) {
        const slot = store.shelf[i];
        const b = slotButton(slot?.item, slot?.count ?? 0);
        if (slot) {
          const doBuy = (n: number) => {
            report(buy(store, i, n), b);
            ctx.redraw();
          };
          b.onclick = () => doBuy(1);
          b.oncontextmenu = (event) => {
            event.preventDefault();
            amountMenu("Buy", slot.item, (n) => n * valueOf(slot.item), doBuy, ctx, event);
          };
          addTip(b, () =>
            tipFor(slot.item, [
              `Costs ${valueOf(slot.item)} coins`,
              slot.count ? `${slot.count} in stock` : "Out of stock",
            ]),
          );
        }
        grid.append(b);
      }
      const hint = document.createElement("p");
      hint.className = "sp-hint";
      hint.textContent =
        "Click an item to buy 1, or one of yours below to sell 1. Right-click for more.";
      ctx.body.replaceChildren(grid, hint);
    },
    invClick(i, event, ctx) {
      const h = store.inv[i];
      if (!h) return;
      const r = sell(store, h.item, 1);
      report(r, event.currentTarget as Element);
      ctx.redraw();
    },
    invMenu(i, event, ctx) {
      const h = store.inv[i];
      if (!h) return;
      amountMenu(
        "Sell",
        h.item,
        (n) => offerFor(h.item, Math.min(n, held(store, h.item))),
        (n) => {
          report(sell(store, h.item, n));
          ctx.redraw();
        },
        ctx,
        event,
      );
    },
    invTip: offerLine,
  };
}

// ---- Variant B: a ledger of rows, store on the left, yours on the right; one amount picker for both. ----
function ledger(): Variant {
  let amount: number = 1;
  let status: Result | undefined;
  const act = (r: Result, ctx: Ctx) => {
    status = r;
    ctx.redraw();
  };
  const label = (n: number) => (n === Infinity ? "all" : String(n));
  const row = (
    item: string,
    count: string,
    price: string,
    onclick: () => void,
    tip: string[],
  ) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sp-row";
    const i = document.createElement("span");
    i.className = "sp-icon";
    i.style.setProperty("--icon", icon(item));
    const n = document.createElement("span");
    n.className = `sp-name ${itemParts(item).quality}`;
    n.textContent = nameOf(item);
    const c = document.createElement("span");
    c.className = "sp-count";
    c.textContent = count;
    const p = document.createElement("span");
    p.className = "sp-price";
    p.textContent = price;
    b.append(i, n, c, p);
    b.onclick = onclick;
    b.dataset.item = item;
    addTip(b, () => tipFor(item, tip));
    return b;
  };
  return {
    name: "Ledger",
    draw(ctx) {
      ctx.setTitle(`General store · ${coinsLine()}`);
      const picker = document.createElement("div");
      picker.className = "sp-picker";
      picker.append("Amount");
      for (const [text, n] of AMOUNTS) {
        const b = document.createElement("button");
        b.type = "button";
        const custom = n === 0 && amount !== 1 && ![5, 10, Infinity].includes(amount);
        b.textContent = custom ? `X = ${amount}` : text;
        b.setAttribute("aria-pressed", String(n === amount || custom));
        b.onclick = (event) => {
          if (n === 0)
            return askAmount(event, (x) => {
              amount = x;
              ctx.redraw();
            });
          amount = n;
          ctx.redraw();
        };
        picker.append(b);
      }
      const cols = document.createElement("div");
      cols.className = "sp-cols";
      const left = document.createElement("div");
      const right = document.createElement("div");
      left.className = right.className = "sp-col";
      const h3 = (t: string) => {
        const h = document.createElement("h3");
        h.textContent = t;
        return h;
      };
      left.append(h3("For sale"));
      store.shelf.forEach((slot, i) => {
        const n = Math.min(amount, slot.count);
        left.append(
          row(
            slot.item,
            slot.count ? `×${slot.count}` : "sold out",
            amount === 1
              ? `${valueOf(slot.item)}c`
              : `${label(amount)}: ${n * valueOf(slot.item)}c`,
            () => act(buy(store, i, amount), ctx),
            [`Costs ${valueOf(slot.item)} coins each`],
          ),
        );
      });
      right.append(h3("Yours"));
      const yours = [...new Set(store.inv.flatMap((h) => (h ? [h.item] : [])))];
      for (const item of yours) {
        const count = held(store, item);
        const n = Math.min(amount, count);
        right.append(
          row(
            item,
            `×${count}`,
            item === COINS
              ? ""
              : amount === 1
                ? `${offerFor(item, 1)}c`
                : `${label(amount)}: ${offerFor(item, n)}c`,
            () => act(sell(store, item, amount), ctx),
            offerLine(item),
          ),
        );
      }
      cols.append(left, right);
      const line = document.createElement("p");
      line.className = `sp-status${status?.refused ? " refused" : ""}`;
      line.textContent =
        status?.line ??
        "Pick an amount, then click a row to buy or sell that many.";
      ctx.body.replaceChildren(picker, cols, line);
    },
    invClick(i, _event, ctx) {
      const h = store.inv[i];
      if (h) act(sell(store, h.item, amount), ctx);
    },
    invMenu(i, event, ctx) {
      this.invClick(i, event, ctx);
    },
    invTip: offerLine,
  };
}

// ---- Variant C: a counter. Click puts items on a buy or sell tray; one Deal settles both. ----
function counter(): Variant {
  const buying = new Map<number, number>();
  const selling = new Map<string, number>();
  let status = "";
  /** The deal tried on a copy: what it costs and why it can't go through. */
  const trial = () => {
    const s = structuredClone(store);
    let pay = 0;
    let get = 0;
    for (const [item, n] of selling) {
      get += offerFor(item, n);
      take(s, item, n);
    }
    add(s, COINS, get);
    for (const [at, n] of buying) pay += n * valueOf(store.shelf[at]!.item);
    const coins = held(s, COINS);
    if (pay > coins)
      return { pay, get, why: `You need ${pay - coins} more coins.` };
    take(s, COINS, pay);
    for (const [at, n] of buying) {
      const item = store.shelf[at]!.item;
      if (room(s, item) < n)
        return { pay, get, why: "You don't have room for all that." };
      add(s, item, n);
    }
    return { pay, get, why: "" };
  };
  const addTo = <K>(tray: Map<K, number>, key: K, n: number, max: number) =>
    tray.set(key, Math.min(max, (tray.get(key) ?? 0) + n));
  const amountMenu = (event: MouseEvent, put: (n: number) => void, ctx: Ctx) =>
    ctx.openMenu(
      event,
      AMOUNTS.map(
        ([label, n]) =>
          [
            n === 0 ? "Add X" : `Add ${label}`,
            () =>
              n === 0
                ? askAmount(event, (x) => {
                    put(x);
                    ctx.redraw();
                  })
                : (put(n), ctx.redraw()),
          ] as const,
      ),
    );
  return {
    name: "Counter",
    draw(ctx) {
      ctx.setTitle(`General store · ${coinsLine()}`);
      const grid = document.createElement("div");
      grid.className = "sp-grid sp-grid-small";
      for (let i = 0; i < SHELF_SLOTS; i++) {
        const slot = store.shelf[i];
        const left = slot ? slot.count - (buying.get(i) ?? 0) : 0;
        const b = slotButton(slot?.item, left, 30);
        if (slot) {
          const put = (n: number) => addTo(buying, i, n, slot.count);
          b.onclick = () => {
            put(1);
            ctx.redraw();
          };
          b.oncontextmenu = (event) => {
            event.preventDefault();
            amountMenu(event, put, ctx);
          };
          addTip(b, () =>
            tipFor(slot.item, [`Costs ${valueOf(slot.item)} coins`, `${left} in stock`]),
          );
        }
        grid.append(b);
      }
      const tray = (title: string, lines: [string, number, number, () => void][]) => {
        const box = document.createElement("div");
        box.className = "sp-tray";
        const h = document.createElement("h3");
        h.textContent = title;
        box.append(h);
        if (!lines.length) {
          const p = document.createElement("p");
          p.className = "sp-hint";
          p.textContent = "Nothing yet";
          box.append(p);
        }
        for (const [item, n, coins, remove] of lines) {
          const r = document.createElement("div");
          r.className = "sp-tray-row";
          const name = document.createElement("span");
          name.className = itemParts(item).quality;
          name.textContent = `${n} × ${nameOf(item)}`;
          const c = document.createElement("span");
          c.textContent = `${coins}c`;
          const x = document.createElement("button");
          x.type = "button";
          x.textContent = "✕";
          x.ariaLabel = "Take back";
          x.onclick = () => {
            remove();
            ctx.redraw();
          };
          r.append(name, c, x);
          box.append(r);
        }
        return box;
      };
      const trays = document.createElement("div");
      trays.className = "sp-trays";
      trays.append(
        tray(
          "You buy",
          [...buying].map(([at, n]) => [
            store.shelf[at]!.item,
            n,
            n * valueOf(store.shelf[at]!.item),
            () => buying.delete(at),
          ]),
        ),
        tray(
          "You sell",
          [...selling].map(([item, n]) => [
            item,
            n,
            offerFor(item, n),
            () => selling.delete(item),
          ]),
        ),
      );
      const { pay, get, why } = trial();
      const sum = document.createElement("p");
      sum.className = "sp-sum";
      const net = get - pay;
      sum.textContent = `You pay ${pay} · you get ${get} · ${net >= 0 ? "+" : "−"}${Math.abs(net)} coins`;
      const deal = document.createElement("button");
      deal.type = "button";
      deal.className = "sp-deal";
      deal.textContent = "Deal";
      const empty = !buying.size && !selling.size;
      deal.disabled = empty || !!why;
      deal.onclick = () => {
        // Sells first, so their coins pay for the buys.
        for (const [item, n] of selling) sell(store, item, n);
        // Highest shelf index first, so a sold-out slot leaving doesn't shift the rest.
        for (const [at, n] of [...buying].sort((a, b) => b[0] - a[0]))
          buy(store, at, n);
        status = `Done: you paid ${pay} and got ${get}.`;
        buying.clear();
        selling.clear();
        ctx.redraw();
      };
      const why2 = document.createElement("p");
      why2.className = `sp-status${why ? " refused" : ""}`;
      why2.textContent =
        why ||
        (empty
          ? status || "Click the shelf to buy, your items below to sell."
          : "Press Deal to settle both trays.");
      ctx.body.replaceChildren(grid, trays, sum, deal, why2);
    },
    invClick(i, _event, ctx) {
      const h = store.inv[i];
      if (!h || h.item === COINS) return;
      addTo(selling, h.item, 1, held(store, h.item));
      ctx.redraw();
    },
    invMenu(i, event, ctx) {
      const h = store.inv[i];
      if (!h || h.item === COINS) return;
      amountMenu(event, (n) => addTo(selling, h.item, n, held(store, h.item)), ctx);
    },
    invTip: (item) => [
      ...offerLine(item),
      ...(item === COINS ? [] : ["Click to put on the counter"]),
    ],
  };
}

// ---- The window, the bar's inventory takeover and the floating switcher. ----

const VARIANTS = ["A", "B", "C"] as const;

export function storePrototype(openMenu: OpenMenu) {
  const views: Record<string, Variant> = {
    A: shelfGrid(),
    B: ledger(),
    C: counter(),
  };
  let variant = new URL(location.href).searchParams.get("variant") ?? "A";
  if (!views[variant]) variant = "A";

  const panel = document.createElement("section");
  panel.id = "store-proto";
  panel.setAttribute("role", "dialog");
  panel.hidden = true;
  const title = document.createElement("h2");
  const titleText = document.createElement("span");
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.id = "store-proto-close";
  closeButton.ariaLabel = "Close";
  title.append(titleText, closeButton);
  const body = document.createElement("div");
  body.className = "sp-body";
  panel.append(title, body);
  document.getElementById("panels")!.append(panel);

  const slots = [...document.querySelectorAll<HTMLButtonElement>("#slots > button")];
  const saved = slots.map((s) => ({
    onclick: s.onclick,
    oncontextmenu: s.oncontextmenu,
    onpointermove: s.onpointermove,
  }));

  const ctx: Ctx = {
    body,
    setTitle: (t) => (titleText.textContent = t),
    redraw: () => {
      views[variant]!.draw(ctx);
      drawInventory();
    },
    openMenu,
  };

  const drawInventory = () => {
    slots.forEach((slot, i) => {
      const h = store.inv[i];
      const count =
        h && (h.count > 1 || h.item === COINS) ? String(h.count) : "";
      // Only on a difference, or each write would wake the observer again.
      if (slot.dataset.item === (h?.item ?? "") && slot.dataset.count === count)
        return;
      slot.dataset.item = h?.item ?? "";
      slot.dataset.locked = "false";
      slot.style.setProperty("--icon", h ? icon(h.item) : "");
      slot.disabled = !h;
      slot.dataset.count = count;
    });
  };
  // The real bar redraws on patches; this puts the fake inventory straight back.
  const watcher = new MutationObserver(drawInventory);
  const loop = () => {
    drawInventory();
    watcher.observe(document.getElementById("slots")!, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-item", "data-count"],
    });
  };

  const close = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    placed.closed();
    watcher.disconnect();
    slots.forEach((s, i) => Object.assign(s, saved[i]));
  };
  const placed = addPanel(panel, close);
  closeButton.onclick = close;

  const open = () => {
    if (!panel.hidden) return;
    panel.hidden = false;
    ctx.redraw();
    placed.opened();
    slots.forEach((slot, i) => {
      slot.onclick = (event) => views[variant]!.invClick(i, event, ctx);
      slot.oncontextmenu = (event) => {
        event.preventDefault();
        views[variant]!.invMenu(i, event, ctx);
      };
      addTip(slot, () => {
        const h = store.inv[i];
        return h ? tipFor(h.item, views[variant]!.invTip(h.item)) : "";
      });
    });
    loop();
  };

  const bar = document.createElement("div");
  bar.id = "proto-switcher";
  const label = document.createElement("span");
  const button = (text: string, onclick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.onclick = onclick;
    return b;
  };
  const setVariant = (to: string) => {
    variant = to;
    label.textContent = `PROTOTYPE ${to} (${views[to]!.name})`;
    const url = new URL(location.href);
    url.searchParams.set("variant", to);
    history.replaceState(null, "", url);
    hideTip();
    if (!panel.hidden) ctx.redraw();
  };
  const cycle = (step: number) => () =>
    setVariant(
      VARIANTS[(VARIANTS.indexOf(variant as "A") + step + VARIANTS.length) % VARIANTS.length]!,
    );
  bar.append(
    button("←", cycle(-1)),
    label,
    button("→", cycle(1)),
    button("Open store", open),
    button("Fill my inventory", () => {
      store.inv = store.inv.map((h) => h ?? { item: "tin", count: STACK_SIZE });
      if (!panel.hidden) ctx.redraw();
    }),
    button("Reset", () => {
      store = fresh();
      if (!panel.hidden) ctx.redraw();
    }),
  );
  document.body.append(bar);
  // [ and ] cycle: the arrow keys already turn the camera.
  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "[") cycle(-1)();
    if (event.key === "]") cycle(1)();
  });

  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.append(style);
  setVariant(variant);
  open();
}

const CSS = `
#proto-switcher { position: fixed; left: 50%; top: 8px; transform: translateX(-50%); z-index: 50;
  display: flex; gap: 6px; align-items: center; padding: 6px 10px; border-radius: 999px;
  background: #fff; color: #000; font: 600 12px system-ui; box-shadow: 0 2px 10px #0008; }
#proto-switcher button { font: inherit; padding: 2px 8px; border-radius: 999px; border: 1px solid #999; background: #eee; }
#store-proto { position: fixed; display: flex; flex-direction: column; box-sizing: border-box; padding: 3px;
  border: 1px solid #000; border-radius: 5px; outline: 1px solid #8a6a44; outline-offset: -3px;
  background: linear-gradient(#1d1610, #120d09) padding-box; box-shadow: 0 6px 18px #000a; color: #eee; font: 12px system-ui;
  max-height: calc(100vh - 176px); }
#store-proto[hidden] { display: none; }
#store-proto > h2 { display: flex; align-items: center; gap: 6px; margin: 0; padding: 5px 5px 5px 10px;
  border-bottom: 1px solid #8a6a44; border-radius: 3px 3px 0 0; background: linear-gradient(#3a2a1a, #261b11);
  color: #f0d9b0; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; font-variant: small-caps; cursor: grab; user-select: none; touch-action: none; }
#store-proto > h2::before { content: "⠿" / ""; color: #8a6a44; font-weight: 400; }
#store-proto-close { width: 20px; height: 20px; margin-left: auto; padding: 0; border: 1px solid #8a6a44; border-radius: 3px;
  background: #1d1610; color: #c9a77c; font: 11px/18px system-ui; }
#store-proto-close::before { content: "✕" / ""; }
#store-proto-close:hover { border-color: #e06a50; background: #5a1d12; color: #fff; }
.sp-body { padding: 8px 10px 10px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #8a6a44 transparent; }
.sp-grid { display: grid; grid-template-columns: repeat(8, 36px); gap: 2px; }
.sp-grid-small { grid-template-columns: repeat(10, 30px); }
.sp-slot { position: relative; padding: 0; border: 0; border-radius: 3px; color: inherit; font-size: 10px;
  background: var(--icon, none) center / 85% no-repeat, linear-gradient(#1d1610, #120d09);
  box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #8a6a44; }
.sp-slot:hover { box-shadow: 0 0 0 1px #000, inset 0 0 0 1px #b08a5a; }
.sp-slot::after { content: attr(data-count); position: absolute; right: 2px; bottom: 1px; color: #fff; font-weight: 700;
  text-shadow: -1px 0 #000, 1px 0 #000, 0 -1px #000, 0 1px #000; }
.sp-slot[data-empty="true"] { filter: grayscale(1); opacity: 0.45; }
.sp-hint { margin: 8px 0 0; opacity: 0.7; }
.sp-tip-price { color: #f0c860; }
@keyframes sp-shake { 25% { translate: -3px 0; } 75% { translate: 3px 0; } }
.sp-shake { animation: sp-shake 0.15s 2; box-shadow: 0 0 0 1px #000, inset 0 0 0 2px #e06a50 !important; }
.sp-ask { position: fixed; z-index: 60; }
.sp-ask input { width: 90px; padding: 4px 6px; border: 1px solid #d2a86a; border-radius: 3px; background: #120d09; color: #eee; font: 12px system-ui; }
.sp-picker { display: flex; align-items: center; gap: 4px; margin-bottom: 8px; color: #c9a77c; }
.sp-picker button, .sp-deal { padding: 3px 9px; border: 1px solid #8a6a44; border-radius: 3px; background: #2a1f14; color: inherit; font: inherit; color: #eee; }
.sp-picker button[aria-pressed="true"] { border-color: #d2a86a; background: #5a4020; }
.sp-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 440px; }
.sp-col h3, .sp-tray h3 { margin: 0 0 4px; color: #f0d9b0; font: 700 11px system-ui; letter-spacing: 0.06em; font-variant: small-caps; }
.sp-row { display: grid; grid-template-columns: 22px 1fr auto auto; gap: 6px; align-items: center; width: 100%;
  padding: 3px 4px; border: 0; border-top: 1px solid #8a6a4455; background: none; color: inherit; font: inherit; text-align: left; }
.sp-row:hover { background: #2a1f14; }
.sp-icon { width: 22px; height: 22px; background: var(--icon) center / contain no-repeat; }
.sp-count { opacity: 0.7; }
.sp-price { color: #f0c860; }
.sp-status { margin: 8px 0 0; color: #b9d98a; } .sp-status.refused { color: #ff8a70; }
.sp-trays { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.sp-tray { min-height: 60px; padding: 6px; border: 1px dashed #8a6a44; border-radius: 3px; }
.sp-tray .sp-hint { margin: 0; }
.sp-tray-row { display: grid; grid-template-columns: 1fr auto auto; gap: 6px; align-items: center; padding: 2px 0; }
.sp-tray-row button { padding: 0 4px; border: 0; background: none; color: #c9a77c; }
.sp-sum { margin: 8px 0 6px; color: #f0c860; }
.sp-deal { width: 100%; padding: 5px; font-weight: 700; }
.sp-deal:disabled { opacity: 0.4; }
`;
