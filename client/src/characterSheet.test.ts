import { PIN_INTENT, TAKE_OFF_INTENT } from "@runic/shared";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  showCharacterSheet,
  type OpenMenu,
  type SyncedPlayer,
} from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";

class FakeInput {}
vi.stubGlobal("HTMLInputElement", FakeInput);

const element = () => ({
  append(...children: any[]) {
    this.children.push(...children);
  },
  replaceChildren(...children: any[]) {
    this.children = children;
  },
  attributes: {} as Record<string, string>,
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  },
  children: [] as any[],
  dataset: {} as Record<string, string>,
  style: {} as Record<string, string>,
  hidden: false,
  disabled: false,
  textContent: "",
  title: "",
  value: 0,
  onclick: undefined as undefined | (() => void),
  oncontextmenu: undefined as undefined | ((event: unknown) => void),
});

let byId: Map<string, ReturnType<typeof element>>;
const el = (id: string) => {
  if (!byId.has(id)) byId.set(id, element());
  return byId.get(id)!;
};
const fakeDocument = {
  getElementById: el,
  createElement: element,
  onkeydown: undefined as undefined | ((event: unknown) => void),
};
vi.stubGlobal("document", fakeDocument);

const press = (key: string, more: object = {}) =>
  fakeDocument.onkeydown!({ key, target: {}, ...more });

const me = (pinnedSkills: string[], xp: Partial<SyncedPlayer> = {}) =>
  ({
    combatXp: 0,
    defenseXp: 0,
    foragingXp: 0,
    hitpointsXp: 4050,
    miningXp: 0,
    smithingXp: 0,
    blockingXp: 0,
    masteryXp: 0,
    pinnedSkills,
    ...xp,
  }) as unknown as SyncedPlayer;

const TODAY = [
  "Combat",
  "Defense",
  "Foraging",
  "Hitpoints",
  "Mining",
  "Smithing",
];

let room: { send: ReturnType<typeof vi.fn> };
let openMenu: Mock<OpenMenu>;
let sheet: ReturnType<typeof showCharacterSheet>;
const isOpen = () => !el("sheet").hidden;
/** A row's children are its text, pin and progress bar. */
const rows = () =>
  el("sheet-skills")
    .children.filter((child) => child.children.length)
    .map(({ children: [name, pin, bar] }) => ({ name, pin, bar }));
const row = (skill: string) =>
  rows().find(({ pin }) => pin.attributes["aria-label"].includes(skill))!;

beforeEach(() => {
  byId = new Map();
  el("sheet").hidden = true;
  el("sheet-skills").hidden = true;
  room = { send: vi.fn() };
  openMenu = vi.fn<OpenMenu>();
  sheet = showCharacterSheet(room as unknown as WorldConnection, openMenu);
});

describe("the Gear tab", () => {
  const wearing = (weapon: string, shield = "") =>
    sheet.drawGear({ weapon, shield } as unknown as SyncedPlayer);
  const box = () => el("gear-weapon") as any;

  test("an empty gear slot says so, and can't be clicked", () => {
    wearing("");
    expect(el("gear-weapon-name").textContent).toBe("Empty");
    expect(el("gear-weapon-does").textContent).toBe("");
    expect(box().disabled).toBe(true);
    expect(box().dataset.item).toBe("");
    expect(box().style.backgroundImage).toBe("");
  });

  test("a worn sword shows its icon, name and what it does", () => {
    wearing("ironSword");
    expect(el("gear-weapon-name").textContent).toBe("Iron sword");
    expect(el("gear-weapon-does").textContent).toBe(
      "Adds 2 to your minimum and maximum hit",
    );
    expect(box().disabled).toBe(false);
    expect(box().dataset.item).toBe("ironSword");
    expect(box().style.backgroundImage).toBe('url("/icons/ironSword.png")');
    expect(el("gear-shield-name").textContent).toBe("Empty");
  });

  test("a worn shield shows its name and what it does", () => {
    wearing("", "emberiteShield");
    expect(el("gear-shield-name").textContent).toBe("Emberite shield");
    expect(el("gear-shield-does").textContent).toBe(
      "Starts at a 30% chance to block a hit",
    );
  });

  test("taking it off empties the slot again", () => {
    wearing("ironSword");
    wearing("");
    expect(el("gear-weapon-name").textContent).toBe("Empty");
    expect(el("worn-gear").children).toEqual([]);
  });

  test("a left-click takes it off", () => {
    wearing("ironSword");
    box().onclick();
    expect(room.send).toHaveBeenCalledWith(TAKE_OFF_INTENT, "weapon");
  });

  test("a right-click offers Take off", () => {
    wearing("ironSword");
    const event = { preventDefault: vi.fn() };
    box().oncontextmenu(event);
    expect(event.preventDefault).toHaveBeenCalled();
    const [[shown, choices]] = openMenu.mock.calls as any;
    expect(shown).toBe(event);
    expect(choices.map(([label]: [string]) => label)).toEqual(["Take off"]);
    choices[0][1]();
    expect(room.send).toHaveBeenCalledWith(TAKE_OFF_INTENT, "weapon");
  });

  test("the Character button shows small icons of the worn gear", () => {
    wearing("ironSword", "copperShield");
    const icons = el("worn-gear").children;
    expect(icons.map(({ src }) => src)).toEqual([
      "/icons/ironSword.png",
      "/icons/copperShield.png",
    ]);
    expect(icons[0].alt).toBe("Iron sword");
  });

  test("patches with no change to the gear don't redraw", () => {
    wearing("ironSword");
    const icon = el("worn-gear").children[0];
    wearing("ironSword");
    expect(el("worn-gear").children[0]).toBe(icon);
  });
});

describe("opening and closing", () => {
  test("C toggles it, whatever the case", () => {
    press("c");
    expect(isOpen()).toBe(true);
    press("C");
    expect(isOpen()).toBe(false);
  });

  test("the Character button toggles it", () => {
    el("character").onclick!();
    expect(isOpen()).toBe(true);
    expect(el("character").attributes["aria-pressed"]).toBe("true");
    el("character").onclick!();
    expect(isOpen()).toBe(false);
    expect(el("character").attributes["aria-pressed"]).toBe("false");
  });

  test("Esc and the close button shut it, and never open it", () => {
    press("Escape");
    expect(isOpen()).toBe(false);
    press("c");
    press("Escape");
    expect(isOpen()).toBe(false);
    press("c");
    el("sheet-close").onclick!();
    expect(isOpen()).toBe(false);
  });

  test("typing in chat never does either", () => {
    const target = new FakeInput();
    press("c", { target });
    expect(isOpen()).toBe(false);
    press("c");
    press("c", { target });
    press("Escape", { target });
    expect(isOpen()).toBe(true);
  });

  test("a held key or a browser shortcut doesn't toggle it", () => {
    press("c", { repeat: true });
    press("c", { ctrlKey: true });
    press("c", { metaKey: true });
    press("c", { altKey: true });
    expect(isOpen()).toBe(false);
  });

  test("it reopens on the tab last used", () => {
    press("c");
    el("sheet-tab-skills").onclick!();
    press("c");
    press("c");
    expect(el("sheet-skills").hidden).toBe(false);
    expect(el("sheet-gear").hidden).toBe(true);
    expect(el("sheet-tab-skills").attributes["aria-selected"]).toBe("true");
    expect(el("sheet-tab-gear").attributes["aria-selected"]).toBe("false");
    el("sheet-tab-gear").onclick!();
    expect(el("sheet-gear").hidden).toBe(false);
    expect(el("sheet-skills").hidden).toBe(true);
  });
});

describe("the Toolbelt", () => {
  const drawn = (tools: string[]) =>
    sheet.drawTools(me([], { tools } as unknown as Partial<SyncedPlayer>));

  test("is an icon per tool, each with its name as a tooltip", () => {
    drawn(["pickaxe", "hammer"]);
    expect(
      el("toolbelt").children.map(({ src, title, alt }) => ({
        src,
        title,
        alt,
      })),
    ).toEqual([
      { src: "/icons/pickaxe.png", title: "Pickaxe", alt: "Pickaxe" },
      { src: "/icons/hammer.png", title: "Hammer", alt: "Hammer" },
    ]);
  });

  test("is empty with no tools", () => {
    drawn([]);
    expect(el("toolbelt").children).toEqual([]);
  });

  test("a patch that changes no tools keeps the icons, so a tooltip isn't lost", () => {
    drawn(["pickaxe"]);
    const [icon] = el("toolbelt").children;
    drawn(["pickaxe"]);
    expect(el("toolbelt").children[0]).toBe(icon);
    drawn(["pickaxe", "hammer"]);
    expect(el("toolbelt").children).toHaveLength(2);
  });

  test("has no right-click menu", () => {
    const preventDefault = vi.fn();
    (el("toolbelt") as any).oncontextmenu({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
  });
});

describe("the Skills tab", () => {
  test("shows every skill, with its level and progress, in the sheet's order", () => {
    sheet.drawPins(me(TODAY));
    sheet.drawSkills(me(TODAY, { miningXp: 75 }));
    expect(rows().map(({ name }) => name.textContent)).toEqual([
      "Combat 1",
      "Defense 1",
      "Foraging 1",
      "Hitpoints 10",
      "Mining 2",
      "Smithing 1",
      "Blocking 1",
      "Mastery 1",
    ]);
    // Level 2 runs from 50 to 200 experience.
    expect(row("Mining").bar.value).toBeCloseTo(25 / 150);
    expect(row("Mining").bar.title).toBe("75 XP");
  });

  test("shows the combat level, and updates it as experience lands", () => {
    const [combat] = el("sheet-skills").children;
    sheet.drawSkills(me(TODAY));
    expect(combat.textContent).toBe("Combat level 3");
    sheet.drawSkills(me(TODAY, { combatXp: 50 }));
    expect(combat.textContent).toBe("Combat level 4");
  });

  test("at six pins the other pins are disabled, and pinned ones still work", () => {
    sheet.drawPins(me(TODAY));
    expect(row("Blocking").pin.disabled).toBe(true);
    expect(row("Combat").pin.disabled).toBe(false);
    expect(row("Combat").pin.attributes["aria-pressed"]).toBe("true");
    expect(row("Blocking").pin.attributes["aria-pressed"]).toBe("false");
  });

  test("under six pins every pin works", () => {
    sheet.drawPins(me(TODAY.slice(1)));
    expect(rows().every(({ pin }) => !pin.disabled)).toBe(true);
  });

  test("a pin sends what it would become", () => {
    sheet.drawPins(me(TODAY.slice(1)));
    row("Combat").pin.onclick!();
    expect(room.send).toHaveBeenLastCalledWith(PIN_INTENT, {
      skill: "Combat",
      pinned: true,
    });
    row("Defense").pin.onclick!();
    expect(room.send).toHaveBeenLastCalledWith(PIN_INTENT, {
      skill: "Defense",
      pinned: false,
    });
  });

  test("drawing keeps the same rows, so pinning doesn't move the list", () => {
    const before = el("sheet-skills").children;
    sheet.drawPins(me(TODAY.slice(1)));
    sheet.drawSkills(me(TODAY.slice(1)));
    expect(el("sheet-skills").children).toBe(before);
  });
});
