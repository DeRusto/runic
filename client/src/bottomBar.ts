import {
  CHAT,
  DROP_INTENT,
  EAT_INTENT,
  EQUIP_INTENT,
  FOOD_HEALS,
  GEAR,
  gearRefusal,
  INVENTORY_SLOTS,
  levelFor,
  levelProgress,
  MAX_CHAT_LENGTH,
  PRIVATE_LINE,
  SKILLS,
  type ChatLine,
} from "@runic/shared";
import { showCharacterSheet, type OpenMenu } from "./characterSheet.ts";
import { iconUrl, itemName } from "./itemIcons.ts";
import type { WorldConnection } from "./players.ts";

const MAX_CHAT_LINES = 200;

const chatLines = document.getElementById("chat-lines")!;

/** Adds a line to the chat box. It's other players' words, so only ever textContent, never HTML. */
export function printChatLine(line: string) {
  const row = document.createElement("div");
  row.textContent = line;
  chatLines.append(row);
  if (chatLines.childElementCount > MAX_CHAT_LINES)
    chatLines.firstElementChild!.remove();
  chatLines.scrollTop = chatLines.scrollHeight;
}

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
  room.onMessage(CHAT, ({ id, username, text }: ChatLine) => {
    printChatLine(`${username}: ${text}`);
    sayOverhead(id, text);
  });
  room.onMessage(PRIVATE_LINE, printChatLine);

  const input = document.getElementById("chat-input") as HTMLInputElement;
  input.maxLength = MAX_CHAT_LENGTH;
  document.getElementById("chat-form")!.onsubmit = (event) => {
    event.preventDefault();
    room.send(CHAT, input.value);
    input.value = "";
  };

  const slots = Array.from({ length: INVENTORY_SLOTS }, (_, i) => {
    const slot = document.createElement("button");
    slot.type = "button";
    const eat = () => room.send(EAT_INTENT, i);
    const equip = () => room.send(EQUIP_INTENT, i);
    // Only food and gear do anything on a left-click, so a material's slot sends nothing.
    slot.onclick = () => {
      const item = slot.dataset.item!;
      if (FOOD_HEALS.has(item)) eat();
      if (GEAR.has(item)) equip();
    };
    slot.oncontextmenu = (event) => {
      event.preventDefault();
      const item = slot.dataset.item;
      if (!item) return;
      openMenu(event, [
        ...(FOOD_HEALS.has(item) ? ([["Eat", eat]] as const) : []),
        ...(GEAR.has(item) ? ([["Equip", equip]] as const) : []),
        ["Drop", () => room.send(DROP_INTENT, i)],
      ]);
    };
    return slot;
  });
  document.getElementById("slots")!.replaceChildren(...slots);

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
    menu.style.bottom = `${innerHeight - event.clientY}px`;
    menu.hidden = false;
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
    const bar = document.createElement("progress");
    row.append(text, bar);
    return { name, field, text, bar, row };
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
      slots.forEach((slot, i) => {
        const item = me.inventory[i] ?? "";
        slot.dataset.item = item;
        const refusal = gearRefusal(item, me);
        slot.dataset.locked = String(!!refusal);
        slot.title = refusal
          ? `${itemName(item)}. ${refusal}`
          : item && itemName(item);
        slot.style.backgroundImage = item && `url("${iconUrl(item)}")`;
        slot.disabled = !item;
        const count = me.inventoryCounts[i] ?? 0;
        slot.dataset.count = count > 1 ? String(count) : "";
      });
      for (const skill of skills) {
        const xp = me[skill.field];
        skill.text.textContent = `${skill.name} ${levelFor(xp)}`;
        skill.bar.value = levelProgress(xp);
        skill.bar.title = `${xp} XP`;
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
