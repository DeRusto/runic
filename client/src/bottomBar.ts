import {
  CHAT,
  DISCARD_INTENT,
  EAT_INTENT,
  FOOD_HEALS,
  INVENTORY_SLOTS,
  levelFor,
  levelProgress,
  MAX_CHAT_LENGTH,
  SKILLS,
  type ChatLine,
} from "@runic/shared";
import { showCharacterSheet } from "./characterSheet.ts";
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

let holdingPick = false;
let showHeld = () => {};

/** A pick's food and XP arrive on the tick, but stay hidden until the clip shows the result (spec §7). */
export function holdPick() {
  holdingPick = true;
}

export function revealPick() {
  holdingPick = false;
  showHeld();
}

/** Chat, inventory, skills and health, all read from our own player on each patch. */
export function showBottomBar(
  room: WorldConnection,
  sayOverhead: (id: string, text: string) => void,
) {
  room.onMessage(CHAT, ({ id, username, text }: ChatLine) => {
    printChatLine(`${username}: ${text}`);
    sayOverhead(id, text);
  });

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
    slot.onclick = () => room.send(EAT_INTENT, i);
    slot.oncontextmenu = (event) => {
      event.preventDefault();
      const item = slot.textContent;
      if (!item) return;
      menu.replaceChildren(
        ...(FOOD_HEALS.has(item)
          ? [choice("Eat", () => room.send(EAT_INTENT, i))]
          : []),
        choice("Discard", () => room.send(DISCARD_INTENT, i)),
      );
      menu.style.left = `${event.clientX}px`;
      // The bar is at the bottom of the window, so the menu opens upwards.
      menu.style.bottom = `${innerHeight - event.clientY}px`;
      menu.hidden = false;
      (menu.firstElementChild as HTMLElement).focus();
    };
    return slot;
  });
  document.getElementById("slots")!.replaceChildren(...slots);

  const menu = document.getElementById("slot-menu")!;
  const choice = (label: string, choose: () => void) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.textContent = label;
    button.onclick = () => {
      menu.hidden = true;
      choose();
    };
    return button;
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
  const sheet = showCharacterSheet(room);

  const health = document.getElementById("health")!;
  const bar = document.getElementById("bar")!;
  bar.hidden = false;

  // A room left mid-hold never reveals, and a rejoin comes back through here.
  holdingPick = false;
  // The pick events a drop lost never come, so what a reconnect's state brings shows at once.
  room.onReconnect(() => room.onStateChange.once(revealPick));
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
    showHeld = () => {
      slots.forEach((slot, i) => {
        slot.textContent = me.inventory[i] ?? "";
        slot.disabled = !slot.textContent;
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
      if (!holdingPick) showHeld();
    });
  });
}
