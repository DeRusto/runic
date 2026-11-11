import {
  CHAT,
  COINS,
  DROP_INTENT,
  EAT_INTENT,
  EQUIP_INTENT,
  FOOD_HEALS,
  gearOf,
  gearRefusal,
  INVENTORY_SLOTS,
  levelFor,
  levelProgress,
  MAX_CHAT_LENGTH,
  MAX_CHAT_LINE_LENGTH,
  MAX_LEVEL,
  MOVE_INTENT,
  PRIVATE_LINE,
  SKILLS,
  xpForLevel,
  type ChatLine,
} from "@runic/shared";
import {
  showCharacterSheet,
  type OpenMenu,
  type SyncedPlayer,
  xpTip,
} from "./characterSheet.ts";
import { iconUrl, itemName } from "./itemIcons.ts";
import { itemTip, itemTipParts } from "./itemTip.ts";
import { amountChoices, dragToReorder } from "./movingItems.ts";
import type { WorldConnection } from "./players.ts";
import { addTip } from "./tooltip.ts";

const MAX_CHAT_LINES = 200;

/** A slot's count of coins in short form: `999`, `12K`, `3.4M` (village spec §3). */
export const shortCount = (count: number) =>
  count < 1e3
    ? String(count)
    : count < 1e6
      ? `${Math.floor(count / 1e3)}K`
      : `${Math.floor(count / 1e5) / 10}M`;

const chatLines = document.getElementById("chat-lines")!;

/** Adds a line to the chat box from its text and coloured names. It's other players' words, so only ever text nodes, never HTML. */
export function printChatLine(...parts: (string | Node)[]) {
  const row = document.createElement("div");
  row.append(...parts);
  chatLines.append(row);
  if (chatLines.childElementCount > MAX_CHAT_LINES)
    chatLines.firstElementChild!.remove();
  chatLines.scrollTop = chatLines.scrollHeight;
}

/** What an inventory slot's clicks do while a window takes them over: the store window sells (village spec §5), and the bank deposits (village spec §6). */
type SlotTakeover = {
  click: (slot: number, item: string) => void;
  menu: (slot: number, item: string) => ReturnType<typeof amountChoices>;
};
let takeover: SlotTakeover | undefined;

/** Hands the inventory slots' clicks to an open store window or bank, and back with undefined. */
export const takeOverSlots = (to: SlotTakeover | undefined) => (takeover = to);

let holdingResult = false;
let showHeld = () => {};

/** A pick's or mine's item and XP arrive on the tick, but stay hidden until the clip shows the result (spec §7). */
export function holdResult() {
  holdingResult = true;
}

export function revealResult() {
  holdingResult = false;
  showHeld();
}

/** Chat, inventory, skills and health, all read from our own player on each patch. Returns how to open its right-click menu. */
export function showBottomBar(
  room: WorldConnection,
  sayOverhead: (id: string, text: string) => void,
) {
  room.onMessage(CHAT, ({ id, username, text, emote }: ChatLine) => {
    if (emote) {
      const bold = document.createElement("b");
      bold.textContent = `${username} ${text}`;
      printChatLine(bold);
    } else printChatLine(`${username}: ${text}`);
    sayOverhead(id, text);
  });
  room.onMessage(PRIVATE_LINE, printChatLine);

  const input = document.getElementById("chat-input") as HTMLInputElement;
  input.maxLength = MAX_CHAT_LENGTH;
  // A chat command's limit counts its message, so the line can run past public chat's.
  input.oninput = () => {
    input.maxLength = input.value.startsWith("/")
      ? MAX_CHAT_LINE_LENGTH
      : MAX_CHAT_LENGTH;
  };
  document.getElementById("chat-form")!.onsubmit = (event) => {
    event.preventDefault();
    room.send(CHAT, input.value);
    input.value = "";
  };

  /** The player the slots last showed, whose levels decide what they refuse. */
  let shown: SyncedPlayer | undefined;
  const slots = Array.from({ length: INVENTORY_SLOTS }, (_, i) => {
    const slot = document.createElement("button");
    slot.type = "button";
    const eat = () => room.send(EAT_INTENT, i);
    const equip = () => room.send(EQUIP_INTENT, i);
    // Only food and gear do anything on a left-click, so a material's slot sends nothing.
    // Not the slot's text, which shows coins in short form.
    const count = () => shown?.inventoryCounts[i] ?? 1;
    slot.onclick = () => {
      const item = slot.dataset.item!;
      if (takeover) return item && takeover.click(i, item);
      if (FOOD_HEALS.has(item)) eat();
      if (gearOf(item)) equip();
    };
    slot.oncontextmenu = (event) => {
      event.preventDefault();
      const item = slot.dataset.item;
      if (!item) return;
      if (takeover) return openMenu(event, takeover.menu(i, item));
      openMenu(event, [
        ...(FOOD_HEALS.has(item) ? ([["Eat", eat]] as const) : []),
        ...(gearOf(item) ? ([["Equip", equip]] as const) : []),
        ...amountChoices("Drop", count(), (amount) =>
          room.send(DROP_INTENT, { slot: i, amount }),
        ),
      ]);
    };
    addTip(slot, () => {
      const item = slot.dataset.item;
      if (!item || !shown) return "";
      const tip = itemTip(item, shown);
      // The slot shows a short form, so the tip gives the exact count.
      const count = shown.inventoryCounts[i] ?? 0;
      if (item === COINS) tip.kind = `${count.toLocaleString("en")} coins`;
      return itemTipParts(tip);
    });
    return slot;
  });
  document.getElementById("slots")!.replaceChildren(...slots);
  dragToReorder(slots, (from, to) => room.send(MOVE_INTENT, { from, to }));

  const menu = document.getElementById("slot-menu")!;
  const openMenu: OpenMenu = (event, choices) => {
    menu.replaceChildren(
      ...choices.map(([label, choose]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "menuitem");
        button.textContent = label;
        button.onclick = () => {
          menu.hidden = true;
          choose();
        };
        return button;
      }),
    );
    menu.style.left = `${event.clientX}px`;
    // The bar is at the bottom of the window, so the menu opens upwards.
    menu.style.top = "";
    menu.style.bottom = `${innerHeight - event.clientY}px`;
    menu.hidden = false;
    // A click near the top of the world has no room above, so that menu opens downwards.
    if (menu.offsetHeight > event.clientY) {
      menu.style.top = `${event.clientY}px`;
      menu.style.bottom = "";
    }
    (menu.firstElementChild as HTMLElement).focus();
  };
  menu.hidden = true;
  menu.oncontextmenu = (event) => event.preventDefault();
  menu.onkeydown = (event) => {
    if (event.key !== "Escape") return;
    menu.hidden = true;
    // Or the same Esc would shut the character sheet too.
    event.stopPropagation();
  };
  document.onpointerdown = (event) => {
    if (!menu.contains(event.target as Node)) menu.hidden = true;
  };

  const skills = SKILLS.map(([name, field]) => {
    const row = document.createElement("label");
    const text = document.createElement("span");
    const next = document.createElement("span");
    const bar = document.createElement("progress");
    row.append(text, next, bar);
    const skill = { name, field, text, next, bar, row, xp: 0 };
    addTip(bar, () => xpTip(skill.xp));
    return skill;
  });
  const noPins = document.createElement("p");
  noPins.textContent = "Pin skills from the sheet";
  // One row per skill in the sheet's order, so the column follows it whatever order they were pinned in.
  document
    .getElementById("skills")!
    .replaceChildren(...skills.map((skill) => skill.row), noPins);
  const sheet = showCharacterSheet(room, openMenu);

  const health = document.getElementById("health")!;
  const bar = document.getElementById("bar")!;
  bar.hidden = false;

  // A room left mid-hold never reveals, and a rejoin comes back through here.
  holdingResult = false;
  // The pick events a drop lost never come, so what a reconnect's state brings shows at once.
  room.onReconnect(() => room.onStateChange.once(revealResult));
  let frame = 0;
  room.onStateChange((state) => {
    const me = state.players.get(room.sessionId);
    if (!me) return;
    health.textContent = `Health ${me.health} / ${me.maxHealth}`;
    // Pins aren't a pick's result, so they never wait for its clip.
    for (const { name, row } of skills)
      row.hidden = !me.pinnedSkills.includes(name);
    noPins.hidden = me.pinnedSkills.length > 0;
    sheet.drawPins(me);
    sheet.drawTools(me);
    sheet.drawGear(me);
    showHeld = () => {
      shown = me;
      slots.forEach((slot, i) => {
        const item = me.inventory[i] ?? "";
        slot.dataset.item = item;
        const refusal = gearRefusal(item, me);
        slot.dataset.locked = String(!!refusal);
        slot.ariaLabel = refusal
          ? `${itemName(item)}. ${refusal}`
          : item
            ? itemName(item)
            : null;
        // A custom property, so the CSS can lay the icon over the slot's face.
        slot.style.setProperty("--icon", item && `url("${iconUrl(item)}")`);
        // Not disabled: a disabled slot can't catch a drag, and an empty one must.
        slot.ariaDisabled = String(!item);
        slot.draggable = !!item;
        const count = me.inventoryCounts[i] ?? 0;
        slot.dataset.count =
          item === COINS ? shortCount(count) : count > 1 ? String(count) : "";
      });
      for (const skill of skills) {
        const xp = me[skill.field];
        const level = levelFor(xp);
        skill.text.textContent = `${skill.name} ${level}`;
        // Spec §8.
        skill.next.textContent =
          level === MAX_LEVEL
            ? "Max level"
            : `${(xpForLevel(level + 1) - xp).toLocaleString("en")} XP to level ${level + 1}`;
        skill.bar.value = levelProgress(xp);
        skill.xp = xp;
      }
      sheet.drawSkills(me);
    };
    // A tick's pick event comes right after its patch, so draw on the next frame, when it has had the chance to hold.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!holdingResult) showHeld();
    });
  });
  return openMenu;
}
