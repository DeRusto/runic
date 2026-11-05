import {
  CHAT,
  INVENTORY_SLOTS,
  levelFor,
  levelProgress,
  MAX_CHAT_LENGTH,
  type ChatLine,
} from "@runic/shared";
import type { WorldConnection } from "./players.ts";

const MAX_CHAT_LINES = 200;
const SKILLS = [
  ["Combat", "combatXp"],
  ["Defense", "defenseXp"],
  ["Foraging", "foragingXp"],
  ["Hitpoints", "hitpointsXp"],
] as const;

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

  const slots = Array.from({ length: INVENTORY_SLOTS }, () => {
    return document.createElement("div");
  });
  document.getElementById("slots")!.replaceChildren(...slots);

  const skills = SKILLS.map(([name, field]) => {
    const row = document.createElement("label");
    const text = document.createElement("span");
    const bar = document.createElement("progress");
    row.append(text, bar);
    return { name, field, text, bar, row };
  });
  document
    .getElementById("skills")!
    .replaceChildren(...skills.map((skill) => skill.row));

  const health = document.getElementById("health")!;
  const bar = document.getElementById("bar")!;
  bar.hidden = false;

  room.onStateChange((state) => {
    const me = state.players.get(room.sessionId);
    if (!me) return;
    health.textContent = `Health ${me.health} / ${me.maxHealth}`;
    slots.forEach((slot, i) => (slot.textContent = me.inventory[i] ?? ""));
    for (const skill of skills) {
      const xp = me[skill.field];
      skill.text.textContent = `${skill.name} ${levelFor(xp)}`;
      skill.bar.value = levelProgress(xp);
      skill.bar.title = `${xp} XP`;
    }
  });
}
