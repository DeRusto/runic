import {
  CHOOSE_INTENT,
  END_TALK_INTENT,
  EVENTS,
  VILLAGERS,
  choicesNodeOf,
  type DialogueChoice,
  type DialogueLine,
  nodesOf,
  type VillagerId,
  type WorldEvent,
} from "@runic/shared";
import { panelKey } from "./panels.ts";
import type { WorldConnection } from "./players.ts";

/** How fast a line types itself out. */
const TYPING_MS_PER_CHARACTER = 22;

/** What the box shows at `line` of `node`: that line, the choices once the lines run out, or nothing once the conversation is over. */
export function shownAt(
  villager: VillagerId,
  node: string,
  line: number,
): { line: DialogueLine } | { choices: DialogueChoice[] } | undefined {
  const nodes = nodesOf(villager);
  const said = nodes[node]!.lines[line];
  if (said) return { line: said };
  const choicesAt = choicesNodeOf(villager, node);
  return choicesAt ? { choices: nodes[choicesAt]!.choices! } : undefined;
}

/**
 * The box above the bar where a villager talks (village spec §2). The server opens, moves and ends each
 * conversation; the box types out the node's lines, then sends the picked choice, or endTalk once
 * the last lines are read.
 */
export function showDialogueBox(room: WorldConnection) {
  const box = document.getElementById("dialogue")!;
  const portrait = document.getElementById("dialogue-portrait")!;
  const who = document.getElementById("dialogue-who")!;
  const text = document.getElementById("dialogue-text")!;
  const foot = document.getElementById("dialogue-foot")!;
  let talk: { villager: VillagerId; node: string; line: number } | undefined;
  let typing: ReturnType<typeof setInterval> | undefined;
  /** The line being typed out; "" while choices show. */
  let full = "";

  const close = () => {
    clearInterval(typing);
    talk = undefined;
    box.hidden = true;
  };
  const render = () => {
    clearInterval(typing);
    if (!talk) return close();
    const shown = shownAt(talk.villager, talk.node, talk.line);
    // The last lines are read, so the server can stop watching for a walk away or a hit.
    if (!shown) {
      close();
      return room.send(END_TALK_INTENT);
    }
    const { name, role } = VILLAGERS[talk.villager];
    box.setAttribute("aria-label", `${name}, ${role}`);
    box.hidden = false;
    const villagerSpeaks = "line" in shown && shown.line.speaker === "villager";
    portrait.textContent = villagerSpeaks ? name[0]! : "You";
    portrait.classList.toggle("you", !villagerSpeaks);
    if ("line" in shown) {
      who.textContent = villagerSpeaks ? `${name}, ${role}` : "You";
      full = shown.line.text;
      let typed = 0;
      text.textContent = "";
      typing = setInterval(() => {
        text.textContent = full.slice(0, ++typed);
        if (typed >= full.length) clearInterval(typing);
      }, TYPING_MS_PER_CHARACTER);
      foot.replaceChildren("Click or press Space to continue");
    } else {
      who.textContent = "Choose";
      full = text.textContent = "";
      foot.replaceChildren(
        ...shown.choices.map((choice, i) => {
          const button = document.createElement("button");
          button.type = "button";
          const key = document.createElement("kbd");
          key.textContent = String(i + 1);
          button.append(key, choice.text);
          button.onclick = () => pick(i);
          return button;
        }),
      );
    }
  };
  // A first press finishes a line still typing; a second moves on.
  const advance = () => {
    if (!talk || !full) return;
    if (text.textContent !== full) {
      clearInterval(typing);
      text.textContent = full;
      return;
    }
    talk.line++;
    render();
  };
  const pick = (i: number) => {
    const shown = talk && shownAt(talk.villager, talk.node, talk.line);
    if (!shown || !("choices" in shown) || !shown.choices[i]) return;
    // Cleared until the server answers, so a second press can't pick from the next node's choices.
    foot.replaceChildren();
    talk = undefined;
    room.send(CHOOSE_INTENT, i);
  };
  box.onclick = advance;

  // In the capture phase, so the box takes Escape before any panel's listener sees it.
  const onKey = (event: KeyboardEvent) => {
    const key = panelKey(event);
    if (box.hidden) return;
    if (key === " ") advance();
    else if (/^[1-9]$/.test(key)) pick(Number(key) - 1);
    else if (key === "Escape") {
      close();
      room.send(END_TALK_INTENT);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  };
  document.addEventListener("keydown", onKey, true);

  room.onMessage(EVENTS, (events: WorldEvent[]) => {
    for (const event of events) {
      if (event.type === "talk" && event.player === room.sessionId) {
        talk = { villager: event.villager, node: event.node, line: 0 };
        render();
      } else if (event.type === "talkEnded" && event.player === room.sessionId)
        close();
    }
  });
  room.onLeave(() => {
    close();
    document.removeEventListener("keydown", onKey, true);
  });
}
