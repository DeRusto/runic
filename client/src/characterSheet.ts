import {
  armourPercentOf,
  avoidanceOf,
  blockOf,
  combatLevel,
  gearOf,
  GEAR_SLOTS,
  gearCountField,
  hitOf,
  ITEMS,
  itemParts,
  STACKING_GEAR_SLOTS,
  wornCountOf,
  type WornGear,
  levelFor,
  maxHealthOf,
  levelProgress,
  MAX_PINNED_SKILLS,
  PIN_INTENT,
  playerCritChance,
  PLAYER_CRIT_MULTIPLIER,
  SKILLS,
  STANCE_INTENT,
  STANCES,
  TAKE_OFF_INTENT,
  type Stance,
  totalLevel,
  type GearSlot,
  virtueDoes,
  itemName,
} from "@runic/shared";
import { iconUrl } from "./itemIcons.ts";
import { addButtonPanel, panelKey } from "./panels.ts";
import type { WorldConnection } from "./players.ts";
import { itemTip, itemTipParts } from "./itemTip.ts";
import { addTip } from "./tooltip.ts";

export type SyncedPlayer = NonNullable<
  ReturnType<WorldConnection["state"]["players"]["get"]>
>;

/** The bar's right-click menu, which opens at the click. */
export type OpenMenu = (
  event: MouseEvent,
  choices: (readonly [label: string, choose: () => void])[],
) => void;

/** A skill bar's tooltip, with thousands separated by commas, as in "12,345 XP" (spec §5). */
export const xpTip = (xp: number) => `${xp.toLocaleString("en")} XP`;

/** A chance (0..1) as a percentage, to one decimal only where it has one: 0.405 is "40.5%". */
const percent = (chance: number) => `${+(chance * 100).toFixed(1)}%`;

/** A stat's value, then its skill and gear parts where both add to it, as in "1040 (+1000/+40)" (issue #216). */
const withSplit = (
  skill: number,
  gear: number,
  shown: (value: number) => string = String,
) =>
  `${shown(skill + gear)}${skill && gear ? ` (+${shown(skill)}/+${shown(gear)})` : ""}`;

const PIN_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 2h6l-1 7 4 4v2h-5l-1 7-1-7H6v-2l4-4z"/></svg>`;

/**
 * The floating window's controls and rows. The page holds it, and `hidden` only takes it
 * out of sight, so the open tab and each tab's scroll position last through closing it.
 */
export function showCharacterSheet(room: WorldConnection, openMenu: OpenMenu) {
  const sheet = document.getElementById("sheet")!;
  const button = document.getElementById("character")!;
  const setOpen = addButtonPanel(sheet, button, "right");
  const toggle = () => setOpen(!!sheet.hidden);
  setOpen(false);
  button.onclick = toggle;
  document.getElementById("sheet-close")!.onclick = () => setOpen(false);
  document.onkeydown = (event) => {
    const key = panelKey(event);
    if (key === "c" || key === "C") toggle();
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

  const toolbelt = document.getElementById("toolbelt")!;
  // Tools have no menu, and the browser's "save image" would read as one.
  toolbelt.oncontextmenu = (event) => event.preventDefault();
  let toolsDrawn = "";

  // Laid out as a body by the grid's areas; each box is only an icon, and its tooltip and name say what it holds.
  let worn: WornGear = {};
  /** What a slot shows over its icon: the count of anything that stacks, even a stack of 1, so a player sees their last arrow, and nothing for gear that never stacks (Ranged spec §2). */
  const countShown = (gearSlot: GearSlot) => {
    const item = worn[gearSlot] ?? "";
    return item && ITEMS[itemParts(item).base].stack > 1
      ? String(wornCountOf(worn, gearSlot))
      : "";
  };
  const describe = (gearSlot: GearSlot) => {
    const item = worn[gearSlot] ?? "";
    const does = gearOf(item)?.does;
    const virtue = virtueDoes(item);
    const count = countShown(gearSlot);
    return `${itemName(gearSlot)}: ${item ? `${count && `${count} `}${itemName(item)}` : "Empty"}${does ? `. ${does}` : ""}${virtue ? `. ${virtue}` : ""}`;
  };
  const gearSlots = GEAR_SLOTS.map((gearSlot) => {
    // Not disabled when empty, or it couldn't be pointed at to read "Empty".
    const box = document.createElement("button");
    box.type = "button";
    box.className = "gear-slot";
    box.style.gridArea = gearSlot;
    const takeOff = () => room.send(TAKE_OFF_INTENT, gearSlot);
    box.onclick = () => {
      if (worn[gearSlot]) takeOff();
    };
    box.oncontextmenu = (event) => {
      event.preventDefault();
      if (worn[gearSlot]) openMenu(event, [["Take off", takeOff]]);
    };
    addTip(box, () => {
      const item = worn[gearSlot];
      return item ? itemTipParts(itemTip(item)) : itemName(gearSlot);
    });
    return { gearSlot, box };
  });
  document
    .getElementById("gear-slots")!
    .replaceChildren(...gearSlots.map(({ box }) => box));
  let gearDrawn: string | undefined;
  const stats = document.getElementById("gear-stats")!;

  // Toggle buttons, one pressed, so each is a plain button a keyboard reaches.
  const stanceGroup = document.getElementById("stance")!;
  stanceGroup.setAttribute("aria-label", "Stance");
  // Said in words too, not only in the tooltip, so a keyboard or screen reader learns it.
  const stanceTrains = document.getElementById("stance-trains")!;
  stanceGroup.setAttribute("aria-describedby", "stance-trains");
  const stances = (Object.keys(STANCES) as Stance[]).map((stance) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = STANCES[stance].name;
    // Each says what it trains in its name too, since the tooltip is pointer-only.
    button.setAttribute(
      "aria-label",
      `${STANCES[stance].name}: ${STANCES[stance].trains}`,
    );
    button.onclick = () => room.send(STANCE_INTENT, stance);
    addTip(button, () => STANCES[stance].trains);
    return { stance, button };
  });
  stanceGroup.replaceChildren(...stances.map(({ button }) => button));

  const combat = document.createElement("p");
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
    const entry = { skill, field, row, name, bar, pin, xp: 0, pinTip: "" };
    addTip(bar, () => xpTip(entry.xp));
    addTip(pin, () => entry.pinTip);
    return entry;
  });
  document
    .getElementById("sheet-skills")!
    .replaceChildren(combat, note, ...rows.map(({ row }) => row));

  return {
    /** Only redraws when the tools change, or each patch would lose a showing tooltip. */
    drawTools(me: SyncedPlayer) {
      const tools = [...me.tools];
      if (tools.join() === toolsDrawn) return;
      toolsDrawn = tools.join();
      toolbelt.replaceChildren(
        ...tools.map((tool) => {
          const icon = document.createElement("img");
          icon.src = iconUrl(tool);
          icon.alt = itemName(tool);
          addTip(icon, () => itemTipParts(itemTip(tool)));
          return icon;
        }),
      );
    },
    /** Only redraws when the gear changes, as with the tools. */
    drawGear(me: SyncedPlayer) {
      const items = GEAR_SLOTS.map((gearSlot) => me[gearSlot]);
      const counts = STACKING_GEAR_SLOTS.map(
        (slot) => me[gearCountField(slot)],
      );
      const drawn = [...items, ...counts].join();
      if (drawn === gearDrawn) return;
      gearDrawn = drawn;
      worn = Object.fromEntries([
        ...GEAR_SLOTS.map((slot, i) => [slot, items[i]]),
        ...STACKING_GEAR_SLOTS.map((slot, i) => [
          gearCountField(slot),
          counts[i],
        ]),
      ]);
      for (const { gearSlot, box } of gearSlots) {
        const item = me[gearSlot];
        box.dataset.item = item;
        box.setAttribute("aria-disabled", String(!item));
        box.setAttribute("aria-label", describe(gearSlot));
        box.style.backgroundImage = item && `url("${iconUrl(item)}")`;
        box.textContent = item ? "" : itemName(gearSlot);
        box.dataset.count = countShown(gearSlot);
      }
    },
    /** In raw numbers, as the bottom bar's health is (issue #216). */
    drawStats(me: SyncedPlayer) {
      const hit = hitOf(me);
      const avoidance = avoidanceOf(me);
      const block = blockOf(me);
      const health = maxHealthOf(me);
      const lines = [
        `Health ${me.health} / ${withSplit(health.skill, health.gear)}`,
        `Hit chance ${percent(hit.chance)}`,
        `Min hit ${withSplit(hit.min, hit.gear)}`,
        `Max hit ${withSplit(hit.max, hit.gear)}`,
        `Critical ${percent(playerCritChance(me.agilityXp))} ×${PLAYER_CRIT_MULTIPLIER}`,
        `Avoidance ${withSplit(avoidance.skill, avoidance.gear, (points) => points.toFixed(1))}`,
        `Block ${block ? withSplit(block.skill, block.shield, percent) : percent(0)}`,
        `Armour ${armourPercentOf(me)}%`,
      ];
      // Rows are kept and only their text changes, so a screen reader isn't handed a new list each patch.
      if (stats.children.length !== lines.length)
        stats.replaceChildren(...lines.map(() => document.createElement("li")));
      lines.forEach((line, i) => (stats.children[i]!.textContent = line));
    },
    drawStance(me: SyncedPlayer) {
      for (const { stance, button } of stances)
        button.setAttribute("aria-pressed", String(me.stance === stance));
      stanceTrains.textContent = STANCES[me.stance]?.trains ?? "";
    },
    /** Only ever changes the rows in place, so pinning doesn't move the list. */
    drawPins(me: SyncedPlayer) {
      const count = me.pinnedSkills.length;
      note.textContent = `Pinned skills show on the bar (${count} of ${MAX_PINNED_SKILLS}).`;
      for (const entry of rows) {
        const { skill, pin } = entry;
        const pinned = me.pinnedSkills.includes(skill);
        pin.setAttribute("aria-pressed", String(pinned));
        // Off by aria-disabled, not disabled, so the pointer over it still shows why.
        const full = !pinned && count >= MAX_PINNED_SKILLS;
        pin.setAttribute("aria-disabled", String(full));
        entry.pinTip = full
          ? `The bar holds ${MAX_PINNED_SKILLS}: unpin one first`
          : pinned
            ? "Unpin from the bar"
            : "Pin to the bar";
        pin.onclick = () => {
          if (!full) room.send(PIN_INTENT, { skill, pinned: !pinned });
        };
      }
    },
    drawSkills(me: SyncedPlayer) {
      combat.textContent = `Combat level ${combatLevel(me)} · Total level ${totalLevel(me)}`;
      for (const entry of rows) {
        const { skill, field, name, bar } = entry;
        const xp = me[field];
        name.textContent = `${skill} ${levelFor(xp)}`;
        bar.value = levelProgress(xp);
        entry.xp = xp;
      }
    },
  };
}
