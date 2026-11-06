import {
  levelFor,
  levelProgress,
  MAX_PINNED_SKILLS,
  PIN_INTENT,
  SKILLS,
} from "@runic/shared";
import type { WorldConnection } from "./players.ts";

export type SyncedPlayer = NonNullable<
  ReturnType<WorldConnection["state"]["players"]["get"]>
>;

const PIN_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6l-1 7 4 4v2h-5l-1 7-1-7H6v-2l4-4z"/></svg>`;

/** Typing in chat never reaches the sheet. */
function sheetKey(event: KeyboardEvent) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return "";
  if (event.target instanceof HTMLInputElement) return "";
  return event.key;
}

/**
 * The floating window's controls and rows. The page holds it, and `hidden` only takes it
 * out of sight, so the open tab and each tab's scroll position last through closing it.
 */
export function showCharacterSheet(room: WorldConnection) {
  const sheet = document.getElementById("sheet")!;
  const button = document.getElementById("character")!;
  const setOpen = (open: boolean) => {
    sheet.hidden = !open;
    button.setAttribute("aria-pressed", String(open));
  };
  const toggle = () => setOpen(!!sheet.hidden);
  setOpen(false);
  button.onclick = toggle;
  document.getElementById("sheet-close")!.onclick = () => setOpen(false);
  document.onkeydown = (event) => {
    const key = sheetKey(event);
    if (key === "c" || key === "C") toggle();
    if (key === "Escape") setOpen(false);
  };

  const tabs = ["gear", "skills"].map((name) => ({
    tab: document.getElementById(`sheet-tab-${name}`)!,
    pane: document.getElementById(`sheet-${name}`)!,
  }));
  for (const chosen of tabs) {
    chosen.tab.onclick = () => {
      for (const { tab, pane } of tabs) {
        tab.setAttribute("aria-selected", String(tab === chosen.tab));
        pane.hidden = tab !== chosen.tab;
      }
    };
  }

  const note = document.createElement("p");
  const rows = SKILLS.map(([skill, field]) => {
    const row = document.createElement("div");
    const name = document.createElement("span");
    const bar = document.createElement("progress");
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "pin";
    pin.innerHTML = PIN_ICON;
    pin.setAttribute("aria-label", `Pin ${skill} to the bar`);
    row.append(name, pin, bar);
    return { skill, field, row, name, bar, pin };
  });
  document
    .getElementById("sheet-skills")!
    .replaceChildren(note, ...rows.map(({ row }) => row));

  return {
    /** Only ever changes the rows in place, so pinning doesn't move the list. */
    drawPins(me: SyncedPlayer) {
      const count = me.pinnedSkills.length;
      note.textContent = `Pinned skills show on the bar (${count} of ${MAX_PINNED_SKILLS}).`;
      for (const { skill, pin } of rows) {
        const pinned = me.pinnedSkills.includes(skill);
        pin.setAttribute("aria-pressed", String(pinned));
        pin.disabled = !pinned && count >= MAX_PINNED_SKILLS;
        pin.title = pin.disabled
          ? `The bar holds ${MAX_PINNED_SKILLS}: unpin one first`
          : pinned
            ? "Unpin from the bar"
            : "Pin to the bar";
        pin.onclick = () => room.send(PIN_INTENT, { skill, pinned: !pinned });
      }
    },
    drawSkills(me: SyncedPlayer) {
      for (const { skill, field, name, bar } of rows) {
        const xp = me[field];
        name.textContent = `${skill} ${levelFor(xp)}`;
        bar.value = levelProgress(xp);
        bar.title = `${xp} XP`;
      }
    },
  };
}
