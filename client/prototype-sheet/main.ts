// PROTOTYPE, throwaway: three layouts of the character sheet and bottom bar, switchable via ?variant=, on the real scene. Items are stubbed in memory.
import { parseRegion, REGION_GRID, respawnTile } from "@runic/shared";
import { loadCharacters } from "../src/characters.ts";
import { addRegionMeshes } from "../src/regionMeshes.ts";
import { focusOn, scene } from "../src/scene.ts";

const $ = (id: string) => document.getElementById(id) as HTMLElement;

const VARIANTS: Record<string, string> = {
  A: "Floating window above the bar",
  B: "Tabs in the bar, nothing floats",
  C: "Tall sheet that also holds skills",
  D: "A's window with skill tab and pins",
};
const KEYS = Object.keys(VARIANTS);
const variant = VARIANTS[new URLSearchParams(location.search).get("variant") ?? ""]
  ? new URLSearchParams(location.search).get("variant")!
  : "A";
document.body.className = `v-${variant}`;
$("variant-name").textContent = `${variant} (${VARIANTS[variant]})`;

const go = (step: number) => {
  const next = KEYS[(KEYS.indexOf(variant) + step + KEYS.length) % KEYS.length];
  location.search = `?variant=${next}`;
};
$("prev").onclick = () => go(-1);
$("next").onclick = () => go(1);

type Kind = "ore" | "bar" | "bone" | "berry" | "herb" | "sword" | "shield" | "pickaxe" | "hammer" | "tool";
type Item = { name: string; kind: Kind; tint: string; count: number; needs?: number; effect?: string };

const COPPER = "#f0935a";
const IRON = "#d5dde4";
const EMBER = "#c2452e";
const item = (name: string, kind: Kind, tint: string, count = 1, needs?: number, effect?: string): Item => ({
  name,
  kind,
  tint,
  count,
  needs,
  effect,
});

const SKILLS: [string, number, number][] = [
  ["Combat", 12, 0.4],
  ["Defense", 8, 0.7],
  ["Foraging", 15, 0.2],
  ["Hitpoints", 14, 0.5],
  ["Mining", 11, 0.9],
  ["Smithing", 10, 0.1],
];
const EXTRA_SKILLS = ["Fishing", "Cooking", "Woodcutting", "Farming", "Alchemy", "Tailoring", "Hunting", "Runecraft"];
const level = (skill: string) => SKILLS.find(([name]) => name === skill)![1];
// What the bar's skill area fits: two across, three down.
const MAX_PINS = 6;

function freshState() {
  const inv: (Item | null)[] = Array(30).fill(null);
  [
    item("Copper ore", "ore", COPPER, 20),
    item("Copper ore", "ore", COPPER, 7),
    item("Iron ore", "ore", IRON, 13),
    item("Copper bar", "bar", COPPER, 20),
    item("Iron bar", "bar", IRON, 4),
    item("Emberbone", "bone", "#e8dcc0", 2),
    item("Berry", "berry", "#d4387a", 12),
    item("Herb", "herb", "#5fbf5a", 1),
    item("Copper sword", "sword", COPPER, 1, 1, "Hits a little harder"),
    item("Iron sword", "sword", IRON, 1, 10, "Hits harder"),
    item("Emberite sword", "sword", EMBER, 1, 20, "Hits hardest"),
    item("Iron shield", "shield", IRON, 1, 10, "Harder to hit"),
  ].forEach((it, i) => (inv[i] = it));
  return {
    inv,
    weapon: null as Item | null,
    shield: item("Copper shield", "shield", COPPER, 1, 1, "A little harder to hit") as Item | null,
    tools: [item("Pickaxe", "pickaxe", "#b8c0c8"), item("Hammer", "hammer", "#b8c0c8")],
    health: 31,
    open: true,
    tab: "Character",
    sheetTab: "Gear",
    // Today's six start pinned, so nobody's bar changes; a new skill starts unpinned.
    pinned: SKILLS.slice(0, MAX_PINS).map(([name]) => name),
  };
}
let state = freshState();

const EXTRA_TOOLS = ["Tongs", "Chisel", "Sickle", "Shears", "Trowel", "File", "Saw", "Awl", "Spade", "Knife"];

// shortcut: placeholder icons drawn by hand, because no pack has this game's items. Real item art is its own question.
const SHAPES: Record<Kind, string> = {
  ore: `<path d="M5 26 9 12l9-5 10 6 3 13-9 3H10z" fill="#6b7078"/><path d="m12 15 5-3 3 4-5 3zm7 7 4-2 2 3-4 2z" fill="TINT"/>`,
  bar: `<path d="M4 25 10 11h20l-5 14z" fill="TINT"/><path d="M4 25 10 11h4L8 25z" fill="#fff5"/><path d="m25 25 5-14 2 2-5 14z" fill="#0004"/>`,
  bone: `<path d="M9 7a4 4 0 0 0-3 7l15 15a4 4 0 0 0 7-3 4 4 0 0 0 3-7 4 4 0 0 0-6-1L12 5a4 4 0 0 0-3 2z" fill="TINT"/><path d="m13 11 12 12" stroke="#ff4a10" stroke-width="2"/>`,
  berry: `<circle cx="12" cy="21" r="6" fill="TINT"/><circle cx="23" cy="20" r="6" fill="TINT"/><path d="M12 15 18 6l5 8" stroke="#4a7a3a" stroke-width="2" fill="none"/>`,
  herb: `<path d="M17 30V12" stroke="#3f7a3a" stroke-width="2"/><path d="M17 16C8 16 6 10 6 6c7 0 11 3 11 10zm0 6c8 0 11-5 11-10-7 0-11 4-11 10z" fill="TINT"/>`,
  sword: `<path d="m27 4 3 2-14 16-3-3z" fill="TINT"/><path d="m8 18 8 8-2 2-3-3-4 4-2-2 4-4-3-3z" fill="#7a5230"/>`,
  shield: `<path d="M18 4 30 8c0 11-3 18-12 24C9 26 6 19 6 8z" fill="TINT"/><path d="M18 4v28C9 26 6 19 6 8z" fill="#0002"/>`,
  pickaxe: `<path d="M9 30 22 12l3 2L12 32z" fill="#7a5230"/><path d="M12 6c8-2 15 1 20 10-6-5-13-7-20-7z" fill="TINT"/>`,
  hammer: `<path d="M10 31 20 15l3 2-10 16z" fill="#7a5230"/><path d="m16 8 11 7-4 6-11-7z" fill="TINT"/>`,
  tool: `<circle cx="18" cy="18" r="10" fill="none" stroke="TINT" stroke-width="4"/><path d="m18 4v8" stroke="TINT" stroke-width="4"/>`,
};
const icon = (kind: Kind, tint: string, extra = "") =>
  `<svg viewBox="0 0 36 36" ${extra}>${SHAPES[kind].replaceAll("TINT", tint)}</svg>`;

function slotButton(it: Item | null, ghost?: Kind) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "slot";
  if (it) {
    b.innerHTML = icon(it.kind, it.tint);
    if (it.count > 1) {
      const c = document.createElement("span");
      c.className = "count";
      c.textContent = String(it.count);
      b.append(c);
    }
    b.title = it.count > 1 ? `${it.name} (${it.count})` : it.name;
    b.setAttribute("aria-label", b.title);
    if (it.needs && level(it.kind === "sword" ? "Combat" : "Defense") < it.needs) b.classList.add("locked");
  } else if (ghost) {
    b.innerHTML = icon(ghost, "#fff", 'class="ghost"');
  }
  return b;
}

const say = (line: string) => {
  const row = document.createElement("div");
  row.textContent = line;
  $("chat-lines").append(row);
  $("chat-lines").scrollTop = $("chat-lines").scrollHeight;
};

const isGear = (it: Item) => it.kind === "sword" || it.kind === "shield";
const isFood = (it: Item) => it.kind === "berry" || it.kind === "herb";

function leftClick(i: number) {
  const it = state.inv[i];
  if (!it) return;
  if (isFood(it)) {
    state.health = Math.min(40, state.health + (it.kind === "berry" ? 2 : 5));
    state.inv[i] = it.count > 1 ? { ...it, count: it.count - 1 } : null;
  } else if (isGear(it)) {
    const skill = it.kind === "sword" ? "Combat" : "Defense";
    if (level(skill) < it.needs!) {
      say(`You need ${skill} ${it.needs} to use the ${it.name}.`);
      return;
    }
    const field = it.kind === "sword" ? "weapon" : "shield";
    state.inv[i] = state[field]; // a swap trades places, so it always works
    state[field] = it;
  }
  render();
}

function takeOff(field: "weapon" | "shield") {
  const it = state[field];
  if (!it) return;
  const empty = state.inv.indexOf(null);
  if (empty < 0) {
    say(`Your inventory is full, so you can't take off the ${it.name}.`);
    return;
  }
  state.inv[empty] = it;
  state[field] = null;
  render();
}

function discard(i: number) {
  state.inv[i] = null;
  render();
}

const menu = $("menu");
function openMenu(event: MouseEvent, title: string, entries: [string, () => void][]) {
  event.preventDefault();
  menu.replaceChildren();
  const header = document.createElement("header");
  header.textContent = title;
  menu.append(header);
  for (const [label, run] of entries) {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => {
      menu.hidden = true;
      run();
    };
    menu.append(b);
  }
  menu.hidden = false;
  menu.style.left = `${Math.min(event.clientX, innerWidth - 130)}px`;
  menu.style.top = `${Math.min(event.clientY, innerHeight - menu.offsetHeight - 4)}px`;
}
addEventListener("pointerdown", (event) => {
  if (!menu.contains(event.target as Node)) menu.hidden = true;
});
addEventListener("contextmenu", (event) => event.preventDefault());

function renderInventory() {
  $("slots").replaceChildren(
    ...state.inv.map((it, i) => {
      const b = slotButton(it);
      b.disabled = !it;
      b.onclick = () => leftClick(i);
      b.oncontextmenu = (event) => {
        if (!it) return;
        const entries: [string, () => void][] = [["Discard", () => discard(i)]];
        // C and D list the left-click action too; A and B hold to the one-entry menu.
        const full = variant === "C" || variant === "D";
        if (full && isFood(it)) entries.unshift(["Eat", () => leftClick(i)]);
        if (full && isGear(it)) entries.unshift(["Equip", () => leftClick(i)]);
        openMenu(event, it.count > 1 ? `${it.name} (${it.count})` : it.name, entries);
      };
      return b;
    }),
  );
}

function gearSlot(field: "weapon" | "shield") {
  const b = slotButton(state[field], field === "weapon" ? "sword" : "shield");
  b.title ||= field === "weapon" ? "Weapon: empty" : "Shield: empty";
  b.onclick = () => takeOff(field);
  b.oncontextmenu = (event) => {
    const it = state[field];
    if (it) openMenu(event, it.name, [["Take off", () => takeOff(field)]]);
  };
  return b;
}

function toolSlot(tool: Item) {
  const b = slotButton(tool);
  b.style.cursor = "default";
  return b;
}

function el(tag: string, className = "", text = "") {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = text;
  return e;
}

function turnButtons() {
  const t = el("div", "turn");
  t.innerHTML = `<button id="tl">⟲</button><button id="tr">⟳</button><kbd>Q</kbd><kbd>E</kbd>`;
  (t.querySelector("#tl") as HTMLElement).onclick = () => $("turn-left").click();
  (t.querySelector("#tr") as HTMLElement).onclick = () => $("turn-right").click();
  return t;
}

const toggle = () => {
  if (variant === "B") state.tab = state.tab === "Character" ? "Skills" : "Character";
  else state.open = !state.open;
  render();
};

function sheetButton() {
  const b = el("button", "sheet-button") as HTMLButtonElement;
  b.type = "button";
  b.setAttribute("aria-pressed", String(state.open));
  b.setAttribute("aria-keyshortcuts", "C");
  // Equipping with the sheet shut takes the item out of the inventory, so the button shows where it went.
  const worn = [state.weapon, state.shield]
    .map((it) => (it ? icon(it.kind, it.tint) : ""))
    .join("");
  b.innerHTML = `<span class="worn">${worn}</span> Character <kbd>C</kbd>`;
  b.onclick = toggle;
  return b;
}

const logout = () => el("button", "", "Log out");
const closeButton = () => {
  const b = el("button", "close") as HTMLButtonElement;
  b.setAttribute("aria-label", "Close");
  b.onclick = toggle;
  return b;
};
const healthText = () => `Health ${state.health} / 40`;

function skillRow(name: string, lvl: number, progress: number, className = "") {
  const row = el("label", className);
  const bar = document.createElement("progress");
  bar.value = progress;
  row.append(el("span", "", `${name} ${lvl}`), bar);
  return row;
}

function renderA() {
  const right = el("div", "a-right");
  const skills = el("div", "a-skills");
  skills.append(...SKILLS.map(([n, l, p]) => skillRow(n, l, p)));
  right.append(skills, el("div", "", healthText()), turnButtons(), sheetButton(), logout());
  $("right").replaceChildren(right);

  const sheet = $("sheet");
  sheet.hidden = !state.open;
  sheet.className = "a";
  const h = el("h2", "", "Character");
  h.append(closeButton());
  const gear = el("div", "a-gear");
  for (const [field, label] of [
    ["weapon", "Weapon"],
    ["shield", "Shield"],
  ] as const) {
    const col = el("div", "", label);
    col.append(gearSlot(field));
    gear.append(col);
  }
  const tools = el("div", "a-tools");
  tools.append(...state.tools.map(toolSlot));
  sheet.replaceChildren(h, gear, el("div", "", "Toolbelt"), tools);
}

const PIN = `<svg viewBox="0 0 24 24"><path d="M9 2h6l-1 7 4 4v2h-5l-1 7-1-7H6v-2l4-4z"/></svg>`;

function pinButton(name: string) {
  const b = el("button", "d-pin") as HTMLButtonElement;
  const pinned = state.pinned.includes(name);
  b.innerHTML = PIN;
  b.setAttribute("aria-pressed", String(pinned));
  b.setAttribute("aria-label", `Pin ${name} to the bar`);
  b.disabled = !pinned && state.pinned.length >= MAX_PINS;
  b.title = b.disabled
    ? `The bar holds ${MAX_PINS}: unpin one first`
    : pinned
      ? "Unpin from the bar"
      : "Pin to the bar";
  b.onclick = () => {
    state.pinned = pinned ? state.pinned.filter((n) => n !== name) : [...state.pinned, name];
    render();
  };
  return b;
}

const sheetScroll: Record<string, number> = {};
let shownTab = "Gear";

function renderD() {
  const right = el("div", "a-right");
  const pinned = el("div", "a-skills");
  // Sheet order, not pin order, so the bar never shuffles as pins change.
  pinned.append(
    ...SKILLS.filter(([n]) => state.pinned.includes(n)).map(([n, l, p]) => skillRow(n, l, p)),
  );
  if (!state.pinned.length) pinned.append(el("span", "d-empty", "Pin skills from the sheet"));
  right.append(pinned, el("div", "", healthText()), turnButtons(), sheetButton(), logout());
  $("right").replaceChildren(right);

  const sheet = $("sheet");
  sheet.hidden = !state.open;
  sheet.className = "a d";
  const h = el("h2", "", "Character");
  h.append(closeButton());

  const body = el("div", "d-body");
  const tab = state.sheetTab;
  const old = sheet.querySelector(".d-body");
  if (old) sheetScroll[shownTab] = old.scrollTop;
  shownTab = tab;

  const tabs = el("div", "d-tabs");
  for (const tab of ["Gear", "Skills"]) {
    const b = el("button", "", tab);
    b.setAttribute("aria-selected", String(state.sheetTab === tab));
    b.onclick = () => {
      state.sheetTab = tab;
      render();
    };
    tabs.append(b);
  }

  if (state.sheetTab === "Gear") {
    const gear = el("div", "d-gear");
    for (const [field, label] of [
      ["weapon", "Weapon"],
      ["shield", "Shield"],
    ] as const) {
      const col = el("div", "", label);
      col.append(gearSlot(field), el("b", "", state[field]?.name ?? "Empty"));
      col.append(el("small", "", state[field]?.effect ?? "Click gear in your inventory"));
      gear.append(col);
    }
    const tools = el("div", "a-tools");
    tools.append(...state.tools.map(toolSlot));
    body.append(gear, el("div", "", "Toolbelt"), tools);
    sheet.replaceChildren(h, tabs, body);
  } else {
    for (const [n, l, p] of SKILLS) {
      const row = el("div", "d-skill");
      const bar = document.createElement("progress");
      bar.value = p;
      row.append(el("span", "", `${n} ${l}`), pinButton(n), bar);
      body.append(row);
    }
    const note = el("p", "d-note", `Pinned skills show on the bar (${state.pinned.length} of ${MAX_PINS}).`);
    sheet.replaceChildren(h, tabs, note, body);
  }
  body.scrollTop = sheetScroll[tab] ?? 0; // re-rendering on a pin must not jump the list
}

function renderB() {
  $("sheet").hidden = true;
  const tabs = el("div", "b-tabs");
  for (const tab of ["Skills", "Character"]) {
    const b = el("button", "", tab === "Character" ? "Character (C)" : tab);
    b.setAttribute("aria-selected", String(state.tab === tab));
    b.onclick = () => {
      state.tab = tab;
      render();
    };
    tabs.append(b);
  }
  const body = el("div", "b-body");
  if (state.tab === "Skills") {
    const s = el("div", "b-skills");
    s.append(...SKILLS.map(([n, l, p]) => skillRow(n, l, p)));
    body.append(s);
  } else {
    const wrap = el("div", "b-sheet");
    const gear = el("div", "b-gear");
    for (const [field, label] of [
      ["weapon", "Weapon"],
      ["shield", "Shield"],
    ] as const) {
      const col = el("div", "", label);
      col.append(gearSlot(field));
      gear.append(col);
    }
    const belt = el("div", "b-toolbelt", "Toolbelt");
    const tools = el("div", "b-tools");
    tools.append(...state.tools.map(toolSlot));
    belt.append(tools);
    wrap.append(gear, belt);
    body.append(wrap);
  }
  const main = el("div", "b-main");
  main.append(tabs, body);
  const side = el("div", "b-side");
  side.append(el("div", "", healthText()), turnButtons(), logout());
  const right = el("div", "b-right");
  right.append(main, side);
  $("right").replaceChildren(right);
}

function renderC() {
  const right = el("div", "c-right");
  const levels = el("div", "c-levels");
  levels.append(...SKILLS.map(([n, l]) => el("span", "", `${n.slice(0, 3)} ${l}`)));
  right.append(levels, el("div", "", healthText()), turnButtons(), sheetButton(), logout());
  $("right").replaceChildren(right);

  const sheet = $("sheet");
  sheet.hidden = !state.open;
  sheet.className = "c";
  const h = el("h2", "", "Character");
  h.append(closeButton());

  const gear = el("section");
  gear.append(el("h3", "", "Gear"));
  for (const [field, label] of [
    ["weapon", "Weapon"],
    ["shield", "Shield"],
  ] as const) {
    const row = el("div", "c-row");
    const text = el("div", "", state[field]?.name ?? `${label}: empty`);
    text.append(el("small", "", state[field]?.effect ?? "Click gear in your inventory"));
    row.append(gearSlot(field), text);
    gear.append(row);
  }

  const skills = el("section");
  skills.append(el("h3", "", "Skills"));
  skills.append(...SKILLS.map(([n, l, p]) => skillRow(n, l, p, "c-skill")));

  const tools = el("section", "c-tools");
  tools.append(el("h3", "", "Toolbelt"));
  for (const tool of state.tools) {
    const row = el("div", "c-row");
    row.append(toolSlot(tool), el("div", "", tool.name));
    tools.append(row);
  }
  sheet.replaceChildren(h, gear, skills, tools);
}

function render() {
  renderInventory();
  ({ A: renderA, B: renderB, C: renderC, D: renderD })[variant as "A" | "B" | "C" | "D"]();
  $("state").textContent = JSON.stringify(
    {
      variant,
      open: variant === "B" ? state.tab : state.open,
      weapon: state.weapon?.name ?? null,
      shield: state.shield?.name ?? null,
      sheetTab: state.sheetTab,
      pinned: state.pinned,
      tools: state.tools.map((t) => t.name),
      health: state.health,
      inventory: state.inv.flatMap((it, i) => (it ? [`${i}: ${it.name} x${it.count}`] : [])),
    },
    null,
    1,
  );
}

$("add-tool").onclick = () => {
  const name = EXTRA_TOOLS[(state.tools.length - 2) % EXTRA_TOOLS.length];
  state.tools.push(item(name, "tool", "#b8c0c8"));
  render();
};
$("add-skill").onclick = () => {
  const name = EXTRA_SKILLS[SKILLS.length - 6];
  if (!name) return;
  SKILLS.push([name, 1 + (SKILLS.length * 3) % 14, 0.3]);
  render();
};
$("fill").onclick = () => {
  state.inv = state.inv.map((it) => it ?? item("Copper ore", "ore", COPPER, 20));
  render();
};
$("reset").onclick = () => {
  state = freshState();
  render();
};
$("chat-form").onsubmit = (event) => {
  event.preventDefault();
  const input = $("chat-input") as HTMLInputElement;
  if (input.value) say(`you: ${input.value}`);
  input.value = "";
};

addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === "ArrowLeft") go(-1);
  if (event.key === "ArrowRight") go(1);
  if (event.key.toLowerCase() === "c" && !event.repeat && !event.ctrlKey && !event.metaKey) toggle();
  if (event.key === "Escape") {
    if (!menu.hidden) menu.hidden = true;
    else if (state.open && variant !== "B") toggle();
  }
});

say("Left-click eats or equips, right-click discards. C toggles the sheet.");
render();

const tiles = parseRegion(REGION_GRID);
const respawn = respawnTile(tiles);
focusOn(respawn.x, respawn.y);
const [newFigure] = await Promise.all([loadCharacters(), addRegionMeshes(scene, tiles)]);
const me = newFigure(respawn as any, "prototype");
scene.add(me.model);
const tick = () => {
  me.update(performance.now());
  requestAnimationFrame(tick);
};
tick();
