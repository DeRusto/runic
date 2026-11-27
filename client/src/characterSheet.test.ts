import {
  GEAR_SLOTS,
  PIN_INTENT,
  STANCE_INTENT,
  TAKE_OFF_INTENT,
  xpForLevel,
} from "@runic/shared";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import {
  showCharacterSheet,
  type OpenMenu,
  type SyncedPlayer,
} from "./characterSheet.ts";
import type { WorldConnection } from "./players.ts";

class FakeInput {}
vi.stubGlobal("HTMLInputElement", FakeInput);
vi.stubGlobal("innerHeight", 700);
vi.stubGlobal("innerWidth", 1000);

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
  classList: { toggle() {} },
  querySelector: () => ({ setPointerCapture() {} }),
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
    attackXp: 0,
    strengthXp: 0,
    defenseXp: 0,
    rangedXp: 0,
    herblawXp: 0,
    hitpointsXp: 4050,
    miningXp: 0,
    smithingXp: 0,
    woodcuttingXp: 0,
    fishingXp: 0,
    cookingXp: 0,
    firemakingXp: 0,
    craftingXp: 0,
    fletchingXp: 0,
    runecraftingXp: 0,
    leatherworkingXp: 0,
    jewelsmithingXp: 0,
    thievingXp: 0,
    agilityXp: 0,
    blockingXp: 0,
    masteryXp: 0,
    pinnedSkills,
    ...xp,
  }) as unknown as SyncedPlayer;

const TODAY = [
  "Attack",
  "Strength",
  "Defense",
  "Herblaw",
  "Hitpoints",
  "Mining",
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
/** Points at an element, and reads its tooltip line by line. */
const tipOf = (target: any) => {
  target.onpointermove({ clientX: 0, clientY: 0 });
  return el("tooltip")
    .children.map((part: any) =>
      typeof part === "string" ? part : part.textContent,
    )
    .filter(Boolean)
    .join("\n");
};

beforeEach(() => {
  byId = new Map();
  el("sheet").hidden = true;
  el("sheet-skills").hidden = true;
  room = { send: vi.fn() };
  openMenu = vi.fn<OpenMenu>();
  sheet = showCharacterSheet(room as unknown as WorldConnection, openMenu);
});

describe("the Gear tab", () => {
  const wearing = (weapon: string, shield = "", more = {}) =>
    sheet.drawGear({ weapon, shield, ...more } as unknown as SyncedPlayer);
  const box = (gearSlot = "weapon") =>
    el("gear-slots").children.find(
      (child: any) => child.style.gridArea === gearSlot,
    );
  /** A coloured name reads as `[quality]name`. */
  const shown = (parts: any[]) =>
    parts
      .map((part) =>
        typeof part === "string"
          ? part
          : `[${part.className}]${part.textContent}`,
      )
      .join("");
  /** Points at a slot, and reads the tooltip it shows, or undefined when hidden. */
  const pointAt = (gearSlot = "weapon") => {
    box(gearSlot).onpointermove({ clientX: 0, clientY: 0 });
    return el("tooltip").hidden ? undefined : shown(el("tooltip").children);
  };

  test("lays out all eleven slots as a body, the ammo slot among them", () => {
    expect(el("gear-slots").children.map((b: any) => b.style.gridArea)).toEqual(
      GEAR_SLOTS,
    );
  });

  test("an empty gear slot shows its name, says Empty when pointed at, and can't be clicked", () => {
    wearing("");
    expect(box().textContent).toBe("Weapon");
    expect(box().attributes["aria-disabled"]).toBe("true");
    expect(box().attributes["aria-label"]).toBe("Weapon: Empty");
    expect(box().dataset.item).toBe("");
    expect(box().style.backgroundImage).toBe("");
    box().onclick();
    box().oncontextmenu({ preventDefault: vi.fn() });
    expect(room.send).not.toHaveBeenCalled();
    expect(openMenu).not.toHaveBeenCalled();
    expect(pointAt("ring")).toBe("Ring");
  });

  test("a worn sword shows its icon, and pointing at it gives its name and what it does", () => {
    wearing("ironSword");
    expect(box().textContent).toBe("");
    expect(box().attributes["aria-disabled"]).toBe("false");
    expect(box().dataset.item).toBe("ironSword");
    expect(box().style.backgroundImage).toBe('url("/icons/ironSword.png")');
    expect(box().attributes["aria-label"]).toBe(
      "Weapon: Iron sword. Adds 200 to your minimum and maximum hit",
    );
  });

  test("worn improved gear names itself in its Quality's colour in the tooltip (spec §5)", () => {
    wearing("ironSword:rare:might", "", {
      body: "copperChestplate:uncommon:fortitude",
    });
    expect(box("body").attributes["aria-label"]).toMatch(
      /^Body: Copper chestplate of Fortitude\. /,
    );
    // The "Take off" goes, since a click still takes it off (spec §5).
    expect(pointAt("body")).toMatch(
      /^\[tip-name uncommon\]Copper chestplate of Fortitude\[tip-kind\]Body armour/,
    );
    expect(pointAt()).toMatch(/^\[tip-name rare\]Iron sword of Might\[/);
  });

  test("worn armour says what it takes off", () => {
    wearing("", "", { body: "emberiteChestplate" });
    expect(box("body").attributes["aria-label"]).toBe(
      "Body: Emberite chestplate. Takes 12% off each hit you take",
    );
  });

  test("an improved piece says its Virtue after its base stat", () => {
    wearing("", "", { body: "copperChestplate:uncommon:fortitude" });
    expect(box("body").attributes["aria-label"]).toBe(
      "Body: Copper chestplate of Fortitude. Takes 4% off each hit you take. Adds 20 to your max health.",
    );
  });

  test("taking it off empties the slot again", () => {
    wearing("ironSword");
    wearing("");
    expect(box().textContent).toBe("Weapon");
  });

  test("a left-click takes it off", () => {
    wearing("ironSword");
    box().onclick();
    expect(room.send).toHaveBeenCalledWith(TAKE_OFF_INTENT, "weapon");
  });

  test("a right-click offers Take off", () => {
    wearing("", "", { legs: "copperLeggings" });
    const event = { preventDefault: vi.fn() };
    box("legs").oncontextmenu(event);
    expect(event.preventDefault).toHaveBeenCalled();
    const [[shown, choices]] = openMenu.mock.calls as any;
    expect(shown).toBe(event);
    expect(choices.map(([label]: [string]) => label)).toEqual(["Take off"]);
    choices[0][1]();
    expect(room.send).toHaveBeenCalledWith(TAKE_OFF_INTENT, "legs");
  });

  test("the ammo slot shows its arrows and how many, and says the count too (Ranged spec §2)", () => {
    wearing("", "", { ammo: "copperArrow", ammoCount: 17 });
    expect(box("ammo").dataset.item).toBe("copperArrow");
    expect(box("ammo").dataset.count).toBe("17");
    expect(box("ammo").style.backgroundImage).toBe(
      'url("/icons/copperArrow.png")',
    );
    expect(box("ammo").attributes["aria-label"]).toBe(
      "Ammo: 17 Copper arrow. Adds 100 to a bow shot's minimum and maximum hit",
    );
    expect(pointAt("ammo")).toMatch(
      /^\[tip-name common\]Copper arrow\[tip-kind\]Ammo, needs Ranged 1/,
    );
  });

  test("an empty ammo slot says Empty and shows no count", () => {
    wearing("");
    expect(box("ammo").textContent).toBe("Ammo");
    expect(box("ammo").dataset.count).toBe("");
    expect(box("ammo").attributes["aria-label"]).toBe("Ammo: Empty");
  });

  test("a sword shows no count, as one item never does", () => {
    wearing("ironSword", "", { weaponCount: 1 });
    expect(box().dataset.count).toBe("");
  });

  test("a stack of throwing knives in the weapon slot shows how many, and says the count too (#279)", () => {
    wearing("ironThrowingKnife", "", { weaponCount: 12 });
    expect(box().dataset.count).toBe("12");
    expect(box().attributes["aria-label"]).toBe(
      "Weapon: 12 Iron throwing knife. Adds 200 to a throw's minimum and maximum hit",
    );
    wearing("ironThrowingKnife", "", { weaponCount: 11 });
    expect(box().dataset.count).toBe("11");
    wearing("ironThrowingKnife", "", { weaponCount: 1 });
    expect(box().dataset.count).toBe("1");
    expect(box().attributes["aria-label"]).toMatch(
      /^Weapon: 1 Iron throwing knife\./,
    );
  });

  test("a change in the ammo count alone redraws it", () => {
    wearing("", "", { ammo: "copperArrow", ammoCount: 17 });
    wearing("", "", { ammo: "copperArrow", ammoCount: 16 });
    expect(box("ammo").dataset.count).toBe("16");
  });

  test("a left-click on the ammo slot takes the stack off", () => {
    wearing("", "", { ammo: "copperArrow", ammoCount: 3 });
    box("ammo").onclick();
    expect(room.send).toHaveBeenCalledWith(TAKE_OFF_INTENT, "ammo");
  });

  test("patches with no change to the gear don't redraw", () => {
    wearing("ironSword");
    box().style.backgroundImage = "untouched";
    wearing("ironSword");
    expect(box().style.backgroundImage).toBe("untouched");
  });
});

describe("the Gear tab's stats", () => {
  const stats = (fields: object) => {
    sheet.drawStats({
      ...me([]),
      health: 1000,
      maxHealth: 1000,
      ...fields,
    } as unknown as SyncedPlayer);
    return el("gear-stats").children.map((row: any) => row.textContent);
  };

  test("a fresh player's stats come from skill alone, with no splits", () => {
    expect(stats({})).toEqual([
      "Health 1000 / 1000",
      "Hit chance 40%",
      "Min hit 100",
      "Max hit 200",
      "Critical 10% ×1.5",
      "Avoidance 0.0",
      "Block 0%",
      "Armour 0%",
    ]);
  });

  test("with a bow, the hit rows are a shot's: Ranged and the bow's Accuracy, and the arrow's hit bonus", () => {
    expect(
      stats({
        attackXp: xpForLevel(20),
        rangedXp: xpForLevel(3),
        weapon: "birchBow",
        ammo: "copperArrow",
        ammoCount: 10,
      }).slice(1, 4),
    ).toEqual([
      "Hit chance 46%",
      "Min hit 200 (+100/+100)",
      "Max hit 300 (+200/+100)",
    ]);
  });

  test("with throwing knives, the hit rows are a throw's: Ranged with no Accuracy, and the knife's hit bonus, not the arrow's", () => {
    expect(
      stats({
        rangedXp: xpForLevel(3),
        weapon: "steelThrowingKnife",
        weaponCount: 10,
        ammo: "copperArrow",
        ammoCount: 10,
      }).slice(1, 4),
    ).toEqual([
      "Hit chance 41%",
      "Min hit 350 (+100/+250)",
      "Max hit 450 (+200/+250)",
    ]);
  });

  test("the critical chance rises on the sheet as Agility levels up", () => {
    expect(stats({ agilityXp: xpForLevel(30) })).toContain(
      "Critical 12.9% ×1.5",
    );
  });

  test("each row splits into skill and gear where both add to it, as in issue #216's examples", () => {
    expect(
      stats({
        health: 850,
        maxHealth: 1040,
        attackXp: xpForLevel(11),
        defenseXp: xpForLevel(12),
        blockingXp: xpForLevel(11),
        weapon: "emberiteSword",
        shield: "copperShield",
        head: "copperHelmet:uncommon:avoidance",
        body: "copperChestplate:rare:fortitude",
        legs: "emberiteLeggings",
      }),
    ).toEqual([
      "Health 850 / 1040 (+1000/+40)",
      "Hit chance 45%",
      "Min hit 400 (+100/+300)",
      "Max hit 500 (+200/+300)",
      "Critical 10% ×1.5",
      "Avoidance 2.9 (+2.8/+0.1)",
      "Block 12% (+2%/+10%)",
      "Armour 12%",
    ]);
  });

  test("the rows follow health and experience on each draw", () => {
    stats({});
    expect(stats({ health: 600, attackXp: xpForLevel(2) }).slice(0, 2)).toEqual(
      ["Health 600 / 1000", "Hit chance 40.5%"],
    );
  });

  test("Strength raises the max hit and Attack the hit chance", () => {
    expect(stats({ strengthXp: xpForLevel(20) }).slice(1, 4)).toEqual([
      "Hit chance 40%",
      "Min hit 100",
      "Max hit 300",
    ]);
  });
});

describe("the stance", () => {
  const buttons = () => el("stance").children;
  const drawn = (stance: string) =>
    sheet.drawStance({ stance } as unknown as SyncedPlayer);

  test("offers Balanced, Precise and Forceful, each saying what it trains", () => {
    drawn("balanced");
    expect(buttons().map((button: any) => button.textContent)).toEqual([
      "Balanced",
      "Precise",
      "Forceful",
    ]);
    expect(el("stance").attributes["aria-label"]).toBe("Stance");
    expect(
      buttons().map((button: any) => button.attributes["aria-label"]),
    ).toEqual([
      "Balanced: Trains Attack and Strength evenly",
      "Precise: Trains Attack",
      "Forceful: Trains Strength",
    ]);
    expect(buttons().map(tipOf)).toEqual([
      "Trains Attack and Strength evenly",
      "Trains Attack",
      "Trains Strength",
    ]);
  });

  test("shows the player's stance as pressed, and what it trains under the buttons", () => {
    drawn("precise");
    expect(
      buttons().map((button: any) => button.attributes["aria-pressed"]),
    ).toEqual(["false", "true", "false"]);
    expect(el("stance-trains").textContent).toBe("Trains Attack");
    expect(el("stance").attributes["aria-describedby"]).toBe("stance-trains");
  });

  test("a click sends the stance chosen", () => {
    drawn("balanced");
    buttons()[2].onclick();
    expect(room.send).toHaveBeenLastCalledWith(STANCE_INTENT, "forceful");
  });

  /** Draws the stances for a player holding `weapon`, with these saved stances. */
  const holding = (
    weapon: string,
    stance = "balanced",
    rangedStance = "steady",
  ) =>
    sheet.drawStance({
      weapon,
      stance,
      rangedStance,
    } as unknown as SyncedPlayer);
  const names = () => buttons().map((button: any) => button.textContent);
  const pressed = () =>
    buttons().map((button: any) => button.attributes["aria-pressed"]);

  test("a sword or bare hands show Balanced, Precise and Forceful", () => {
    holding("copperSword");
    expect(names()).toEqual(["Balanced", "Precise", "Forceful"]);
    holding("");
    expect(names()).toEqual(["Balanced", "Precise", "Forceful"]);
  });

  test("a bow or knives show Steady, Rapid and Longrange, each saying what it does", () => {
    for (const weapon of ["birchBow", "ironThrowingKnife"]) {
      holding(weapon);
      expect(names()).toEqual(["Steady", "Rapid", "Longrange"]);
    }
    expect(buttons().map(tipOf)).toEqual([
      "Trains Ranged",
      "Trains Ranged, and attacks 2 ticks sooner",
      "Trains Ranged and Defense evenly, and reaches 2 tiles further",
    ]);
    expect(buttons()[2].attributes["aria-label"]).toBe(
      "Longrange: Trains Ranged and Defense evenly, and reaches 2 tiles further",
    );
  });

  test("each style shows its own saved stance as pressed, across a swap", () => {
    holding("birchBow", "forceful", "rapid");
    expect(pressed()).toEqual(["false", "true", "false"]);
    expect(el("stance-trains").textContent).toBe(
      "Trains Ranged, and attacks 2 ticks sooner",
    );
    holding("copperSword", "forceful", "rapid");
    expect(pressed()).toEqual(["false", "false", "true"]);
    expect(el("stance-trains").textContent).toBe("Trains Strength");
    holding("birchBow", "forceful", "rapid");
    expect(pressed()).toEqual(["false", "true", "false"]);
  });

  test("a click on a Ranged stance sends it", () => {
    holding("birchBow");
    buttons()[2].onclick();
    expect(room.send).toHaveBeenLastCalledWith(STANCE_INTENT, "longrange");
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

  test("the close button shuts it", () => {
    press("c");
    el("sheet-close").onclick!();
    expect(isOpen()).toBe(false);
  });

  test("typing C in chat never toggles it", () => {
    const target = new FakeInput();
    press("c", { target });
    expect(isOpen()).toBe(false);
    press("c");
    press("c", { target });
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

  test("is an icon per tool, each with its name as its tooltip and alt text", () => {
    drawn(["pickaxe", "hammer"]);
    expect(
      el("toolbelt").children.map((icon) => ({
        src: icon.src,
        tip: tipOf(icon),
        alt: icon.alt,
      })),
    ).toEqual([
      { src: "/icons/pickaxe.png", tip: "Pickaxe\nTool", alt: "Pickaxe" },
      { src: "/icons/hammer.png", tip: "Hammer\nTool", alt: "Hammer" },
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
      "Attack 1",
      "Strength 1",
      "Defense 1",
      "Ranged 1",
      "Herblaw 1",
      "Hitpoints 10",
      "Mining 2",
      "Smithing 1",
      "Woodcutting 1",
      "Fishing 1",
      "Cooking 1",
      "Firemaking 1",
      "Crafting 1",
      "Fletching 1",
      "Runecrafting 1",
      "Leatherworking 1",
      "Jewelsmithing 1",
      "Thieving 1",
      "Agility 1",
      "Blocking 1",
      "Mastery 1",
    ]);
    // Level 2 runs from 50 to 200 experience.
    expect(row("Mining").bar.value).toBeCloseTo(25 / 150);
    expect(tipOf(row("Mining").bar)).toBe("75 XP");
    sheet.drawSkills(me(TODAY, { miningXp: 12345 }));
    expect(tipOf(row("Mining").bar)).toBe("12,345 XP");
  });

  test("shows the combat and total levels, and updates them as experience lands", () => {
    const [combat] = el("sheet-skills").children;
    sheet.drawSkills(me(TODAY));
    expect(combat.textContent).toBe("Combat level 3 · Total level 32");
    sheet.drawSkills(me(TODAY, { attackXp: 50, strengthXp: 50, miningXp: 50 }));
    expect(combat.textContent).toBe("Combat level 4 · Total level 35");
  });

  test("at six pins the other pins are disabled, and pinned ones still work", () => {
    sheet.drawPins(me(TODAY));
    expect(row("Blocking").pin.attributes["aria-disabled"]).toBe("true");
    expect(row("Attack").pin.attributes["aria-disabled"]).toBe("false");
    expect(row("Attack").pin.attributes["aria-pressed"]).toBe("true");
    expect(row("Blocking").pin.attributes["aria-pressed"]).toBe("false");
    expect(tipOf(row("Blocking").pin)).toBe("The bar holds 6: unpin one first");
    expect(tipOf(row("Attack").pin)).toBe("Unpin from the bar");
  });

  test("under six pins every pin works", () => {
    sheet.drawPins(me(TODAY.slice(1)));
    expect(
      rows().every(({ pin }) => pin.attributes["aria-disabled"] === "false"),
    ).toBe(true);
    expect(tipOf(row("Attack").pin)).toBe("Pin to the bar");
  });

  test("a pin sends what it would become", () => {
    sheet.drawPins(me(TODAY.slice(1)));
    row("Attack").pin.onclick!();
    expect(room.send).toHaveBeenLastCalledWith(PIN_INTENT, {
      skill: "Attack",
      pinned: true,
    });
    row("Defense").pin.onclick!();
    expect(room.send).toHaveBeenLastCalledWith(PIN_INTENT, {
      skill: "Defense",
      pinned: false,
    });
  });

  test("at six pins an off pin sends nothing when clicked", () => {
    sheet.drawPins(me(TODAY));
    room.send.mockClear();
    row("Blocking").pin.onclick!();
    expect(room.send).not.toHaveBeenCalled();
  });

  test("drawing keeps the same rows, so pinning doesn't move the list", () => {
    const before = el("sheet-skills").children;
    sheet.drawPins(me(TODAY.slice(1)));
    sheet.drawSkills(me(TODAY.slice(1)));
    expect(el("sheet-skills").children).toBe(before);
  });
});
