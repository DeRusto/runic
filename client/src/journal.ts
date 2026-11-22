import {
  QUESTS,
  QUEST_DONE,
  journalLine,
  stageOf,
  type QuestId,
} from "@runic/shared";
import { addButtonPanel, panelKey } from "./panels.ts";
import type { WorldConnection } from "./players.ts";

/** The floating window of a player's quests and their stages, opened from the bar or with J. */
export function showJournal(room: WorldConnection) {
  const panel = document.getElementById("journal")!;
  const button = document.getElementById("journal-button")!;
  const setOpen = addButtonPanel(panel, button);
  const toggle = () => setOpen(!!panel.hidden);
  setOpen(false);
  button.onclick = toggle;
  document.getElementById("journal-close")!.onclick = () => setOpen(false);
  // Beside the sheet's document.onkeydown, never in place of it.
  const onKey = (event: KeyboardEvent) => {
    const key = panelKey(event);
    if (key === "j" || key === "J") toggle();
  };
  document.addEventListener("keydown", onKey);
  room.onLeave(() => {
    setOpen(false);
    document.removeEventListener("keydown", onKey);
  });

  const points = document.getElementById("journal-points")!;
  const list = document.getElementById("journal-quests")!;
  /** Only redraws when the shown text changes, or each patch would lose a showing tooltip. */
  let drawn = "";
  room.onStateChange((state) => {
    const me = state.players.get(room.sessionId);
    if (!me) return;
    const stages = [...me.questStages];
    const quests = [...me.quests].flatMap((id, at) => {
      if (!Object.hasOwn(QUESTS, id)) return [];
      const quest = QUESTS[id as QuestId];
      const done = stages[at] === QUEST_DONE;
      const stage = stageOf(quest, stages[at]);
      const line = done ? "Completed." : stage ? journalLine(stage, me) : "";
      return [{ title: quest.title, done, line }];
    });
    const next = `${me.questPoints}:${JSON.stringify(quests)}`;
    if (next === drawn) return;
    drawn = next;
    points.textContent = `Quest points: ${me.questPoints}`;
    const rows = quests.map(({ title: name, done, line }) => {
      const row = document.createElement("li");
      const title = document.createElement("b");
      title.textContent = name;
      const text = document.createElement("span");
      text.textContent = line;
      row.dataset.done = String(done);
      row.append(title, text);
      return row;
    });
    list.replaceChildren(...(rows.length ? rows : [empty()]));
  });
}

const empty = () => {
  const none = document.createElement("p");
  none.textContent = "You have no quests yet. Talk to the villagers.";
  return none;
};
