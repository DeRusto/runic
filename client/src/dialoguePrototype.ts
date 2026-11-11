// PROTOTYPE, throwaway (wayfinder ticket #195): three ways talking to a villager could look and play,
// switchable by ?variant=A|B|C and the floating bar. Client-only: nothing here reaches the server.
import * as THREE from "three";
import { printChatLine } from "./bottomBar.ts";
import type { WorldConnection } from "./players.ts";
import { camera } from "./scene.ts";

type Line = { who: "odo" | "you"; text: string };
type Node = {
  lines: Line[];
  choices?: { text: string; to: string }[];
  then?: string;
  chat?: string;
};

const odo = (text: string): Line => ({ who: "odo", text });
const you = (text: string): Line => ({ who: "you", text });

/** The Blacksmith's first quest lines (#75), as a small tree. */
const SCRIPT: Record<string, Node> = {
  greet: {
    lines: [odo("Morning. Odo's the name. I keep the forge.")],
    choices: [
      { text: "Got any work for me?", to: "work" },
      { text: "Can I use your furnace?", to: "furnace" },
      { text: "Have you got any tools?", to: "tools" },
      { text: "Bye.", to: "bye" },
    ],
  },
  work: {
    lines: [
      you("Got any work for me?"),
      odo("Could do. I'm out of copper, and my back won't take the walk."),
      odo(
        "There's a vein past the east road. Bring me one copper ore and the forge is yours to use.",
      ),
    ],
    choices: [
      { text: "I'll fetch it.", to: "accept" },
      { text: "Not right now.", to: "later" },
    ],
  },
  accept: {
    lines: [
      you("I'll fetch it."),
      odo("Good. Take a pickaxe if you're short of one. Mind the spiders."),
    ],
    chat: "Quest started: Odo's copper.",
  },
  later: { lines: [you("Not right now."), odo("Forge'll still be here.")] },
  furnace: {
    lines: [
      you("Can I use your furnace?"),
      odo("Not till you've shown me you can find your own ore."),
    ],
    then: "greet",
  },
  tools: {
    lines: [
      you("Have you got any tools?"),
      odo("Everyone who comes through gets a pickaxe and a hammer. Here."),
    ],
    chat: "The Blacksmith gives you a pickaxe and a hammer.",
  },
  bye: { lines: [you("Bye."), odo("Mind how you go.")] },
};

/** One conversation's position: which node, which line of it. */
type Talk = { node: string; line: number };

type View = {
  name: string;
  /** Shows the current line, or the choices once the node's lines are done. */
  show: (talk: Talk, actions: Actions) => void;
  close: () => void;
};
type Actions = { next: () => void; pick: (i: number) => void };

const NAME = "Odo, blacksmith";

// ---- Variant A: the chat log. Lines print into the chat; choices replace the chat input. ----
function chatLog(): View {
  const chat = document.getElementById("chat")!;
  const form = document.getElementById("chat-form")!;
  const box = document.createElement("div");
  box.className = "proto-chatlog";
  let printed = "";
  return {
    name: "Chat log",
    show(talk, { next, pick }) {
      const node = SCRIPT[talk.node]!;
      const line = node.lines[talk.line];
      const key = `${talk.node}:${talk.line}`;
      if (line && printed !== key) {
        printed = key;
        const span = document.createElement("span");
        span.className = line.who === "odo" ? "proto-odo" : "proto-you";
        span.textContent = `${line.who === "odo" ? "Odo" : "You"}: ${line.text}`;
        printChatLine(span);
      }
      box.replaceChildren();
      if (line) {
        const more = document.createElement("button");
        more.textContent = "Click here or press Space to continue";
        more.onclick = next;
        box.append(more);
      } else {
        node.choices!.forEach((choice, i) => {
          const button = document.createElement("button");
          button.textContent = `${i + 1}. ${choice.text}`;
          button.onclick = () => pick(i);
          box.append(button);
        });
      }
      if (!box.isConnected) chat.append(box);
      form.hidden = true;
    },
    close() {
      printed = "";
      box.remove();
      form.hidden = false;
    },
  };
}

// ---- Variant B: speech bubbles. Odo speaks over his head; your answers float over yours. ----
function bubbles(
  odoAt: THREE.Vector3,
  meAt: () => THREE.Vector3 | undefined,
): View {
  const odoBubble = document.createElement("div");
  const meBubble = document.createElement("div");
  odoBubble.className = meBubble.className = "proto-bubble";
  const point = new THREE.Vector3();
  const place = (element: HTMLElement, at: THREE.Vector3 | undefined) => {
    if (!at) return;
    point.set(at.x, 1.6, at.z).project(camera);
    element.style.left = `${((point.x + 1) / 2) * innerWidth}px`;
    element.style.top = `${((1 - point.y) / 2) * innerHeight}px`;
  };
  let frame = 0;
  let timer: ReturnType<typeof setTimeout>;
  const follow = () => {
    place(odoBubble, odoAt);
    place(meBubble, meAt());
    frame = requestAnimationFrame(follow);
  };
  return {
    name: "Speech bubbles",
    show(talk, { next, pick }) {
      if (!frame) {
        document.body.append(odoBubble, meBubble);
        follow();
      }
      clearTimeout(timer);
      const node = SCRIPT[talk.node]!;
      const line = node.lines[talk.line];
      meBubble.replaceChildren();
      meBubble.hidden = true;
      if (line?.who === "odo") {
        odoBubble.textContent = line.text;
        odoBubble.hidden = false;
        odoBubble.onclick = next;
        // Lines advance on their own, at reading pace; a click skips ahead.
        timer = setTimeout(next, 1500 + line.text.length * 45);
      } else if (line) {
        meBubble.textContent = line.text;
        meBubble.hidden = false;
        meBubble.onclick = next;
        timer = setTimeout(next, 1200 + line.text.length * 35);
      } else {
        meBubble.hidden = false;
        meBubble.classList.add("proto-choices");
        node.choices!.forEach((choice, i) => {
          const button = document.createElement("button");
          button.textContent = choice.text;
          button.onclick = () => pick(i);
          meBubble.append(button);
        });
      }
      if (line) meBubble.classList.remove("proto-choices");
    },
    close() {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      frame = 0;
      odoBubble.remove();
      meBubble.remove();
    },
  };
}

// ---- Variant C: a dialogue box above the bar, with the speaker's name and a portrait. ----
function dialogueBox(): View {
  const box = document.createElement("section");
  box.className = "proto-box";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", NAME);
  let typing: ReturnType<typeof setInterval>;
  return {
    name: "Dialogue box",
    show(talk, { next, pick }) {
      clearInterval(typing);
      const node = SCRIPT[talk.node]!;
      const line = node.lines[talk.line];
      const portrait = document.createElement("div");
      portrait.className = "proto-portrait";
      const who = document.createElement("div");
      who.className = "proto-who";
      const text = document.createElement("p");
      const foot = document.createElement("div");
      foot.className = "proto-foot";
      if (line) {
        const odoSpeaks = line.who === "odo";
        portrait.textContent = odoSpeaks ? "O" : "You";
        portrait.classList.toggle("proto-you-portrait", !odoSpeaks);
        who.textContent = odoSpeaks ? NAME : "You";
        // Typed out; a click finishes the line, a second click moves on.
        let shown = 0;
        typing = setInterval(() => {
          text.textContent = line.text.slice(0, ++shown);
          if (shown >= line.text.length) clearInterval(typing);
        }, 22);
        foot.textContent = "Click or press Space to continue";
        box.onclick = () => {
          if (text.textContent !== line.text) {
            clearInterval(typing);
            text.textContent = line.text;
          } else next();
        };
      } else {
        portrait.textContent = "You";
        portrait.classList.add("proto-you-portrait");
        who.textContent = "Choose";
        box.onclick = null;
        node.choices!.forEach((choice, i) => {
          const button = document.createElement("button");
          button.innerHTML = `<kbd>${i + 1}</kbd> `;
          button.append(choice.text);
          button.onclick = () => pick(i);
          foot.append(button);
        });
        foot.classList.add("proto-choice-list");
      }
      const body = document.createElement("div");
      body.append(who, text);
      box.replaceChildren(portrait, body, foot);
      if (!box.isConnected) document.body.append(box);
    },
    close() {
      clearInterval(typing);
      box.remove();
    },
  };
}

const STYLE = `
.proto-odo { color: #ffd27a; } .proto-you { color: #9fd0ff; }
.proto-chatlog { display: flex; flex-wrap: wrap; gap: 4px; }
.proto-chatlog button, .proto-bubble button, .proto-box button, #proto-switcher button {
  border: 1px solid #8a6a44; border-radius: 3px; background: #0b0806; color: #eee; font: 12px system-ui; padding: 3px 8px; cursor: pointer; }
.proto-chatlog button:hover, .proto-bubble button:hover, .proto-box button:hover { border-color: #ffd27a; color: #ffd27a; }
.proto-bubble { position: fixed; z-index: 2; transform: translate(-50%, -100%); max-width: 240px; padding: 6px 10px;
  border-radius: 10px; background: #fffbe8; color: #222; font: 13px system-ui; box-shadow: 0 2px 6px #0008; cursor: pointer; }
.proto-bubble[hidden] { display: none; }
.proto-bubble.proto-choices { display: flex; flex-direction: column; gap: 3px; background: #1d1610ee; padding: 6px; cursor: default; }
.proto-bubble.proto-choices[hidden] { display: none; }
.proto-box { position: fixed; z-index: 2; left: 50%; bottom: 172px; transform: translateX(-50%); width: min(560px, 90vw);
  display: grid; grid-template-columns: 64px 1fr; gap: 6px 12px; padding: 12px; box-sizing: border-box;
  border: 1px solid #8a6a44; border-radius: 4px; background: linear-gradient(#1d1610, #120d09); color: #eee;
  font: 14px system-ui; box-shadow: 0 4px 16px #000c; cursor: pointer; }
.proto-box p { margin: 4px 0 0; min-height: 2.6em; line-height: 1.3; }
.proto-portrait { width: 64px; height: 64px; display: grid; place-items: center; border: 1px solid #8a6a44;
  background: #3a2a1a; color: #ffd27a; font: 700 26px system-ui; border-radius: 3px; }
.proto-portrait.proto-you-portrait { color: #9fd0ff; background: #1a2a3a; font-size: 16px; }
.proto-who { color: #ffd27a; font-weight: 600; }
.proto-foot { grid-column: 1 / -1; color: #999; font-size: 11px; text-align: right; }
.proto-foot.proto-choice-list { display: flex; flex-direction: column; gap: 4px; text-align: left; font-size: 13px; }
.proto-foot.proto-choice-list button { text-align: left; font-size: 13px; padding: 5px 8px; }
.proto-box kbd { color: #ffd27a; }
#proto-switcher { position: fixed; z-index: 3; top: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px;
  align-items: center; padding: 4px 8px; border-radius: 999px; background: #e0245e; color: #fff; font: 600 12px system-ui;
  box-shadow: 0 2px 8px #000a; }
`;

const VARIANTS = ["A", "B", "C"] as const;

/** Mounts the switcher; returns what the Blacksmith click calls. */
export function dialoguePrototype(
  room: WorldConnection,
  odoTile: { x: number; y: number },
) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  const odoAt = new THREE.Vector3(odoTile.x, 0, odoTile.y);
  const me = () =>
    room.state.players.get(room.sessionId) as unknown as
      { x: number; y: number; health: number } | undefined;
  const meAt = () => {
    const player = me();
    return player && new THREE.Vector3(player.x, 0, player.y);
  };

  let variant = new URLSearchParams(location.search).get("variant") ?? "A";
  const views: Record<string, View> = {
    A: chatLog(),
    B: bubbles(odoAt, meAt),
    C: dialogueBox(),
  };
  let talk: Talk | undefined;
  /** Set on a click, until we arrive next to Odo. */
  let walkingOver = false;
  let lastHealth = Infinity;

  const end = (why?: string) => {
    views[variant]!.close();
    talk = undefined;
    walkingOver = false;
    if (why) printChatLine(why);
  };
  const actions: Actions = {
    next: () => {
      if (!talk) return;
      const node = SCRIPT[talk.node]!;
      talk.line++;
      if (talk.line < node.lines.length) return render();
      if (node.choices) return render();
      if (node.chat) printChatLine(node.chat);
      if (node.then) {
        talk = { node: node.then, line: SCRIPT[node.then]!.lines.length };
        return render();
      }
      end();
    },
    pick: (i) => {
      const choice = talk && SCRIPT[talk.node]!.choices?.[i];
      if (!choice) return;
      talk = { node: choice.to, line: 0 };
      render();
    },
  };
  const render = () => talk && views[variant]!.show(talk, actions);

  // The interruptions: walking off, or being hit, ends the conversation.
  const watch = () => {
    const player = me();
    if (player) {
      const near =
        Math.max(
          Math.abs(player.x - odoTile.x),
          Math.abs(player.y - odoTile.y),
        ) <= 1;
      if (walkingOver && near) {
        walkingOver = false;
        talk = { node: "greet", line: 0 };
        render();
      }
      if (talk && !near) end("You walk away from Odo.");
      if (talk && player.health < lastHealth)
        end("You're hit, and Odo stops talking.");
      lastHealth = player.health;
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const i = VARIANTS.indexOf(variant as (typeof VARIANTS)[number]);
      const step = event.key === "ArrowLeft" ? -1 : 1;
      setVariant(VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length]!);
    }
    if (!talk) return;
    if (event.key === " ") {
      event.preventDefault();
      if (SCRIPT[talk.node]!.lines[talk.line]) actions.next();
    }
    if (/^[1-9]$/.test(event.key)) actions.pick(Number(event.key) - 1);
    if (event.key === "Escape") end();
  });

  const bar = document.createElement("div");
  bar.id = "proto-switcher";
  const label = document.createElement("span");
  const button = (text: string, onclick: () => void) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.onclick = onclick;
    return b;
  };
  const setVariant = (to: string) => {
    if (talk) views[variant]!.close();
    variant = to;
    label.textContent = `PROTOTYPE ${to} (${views[to]!.name})`;
    const url = new URL(location.href);
    url.searchParams.set("variant", to);
    history.replaceState(null, "", url);
    render();
  };
  const cycle = (step: number) => () =>
    setVariant(VARIANTS[(VARIANTS.indexOf(variant as "A") + step + 3) % 3]!);
  bar.append(
    button("←", cycle(-1)),
    label,
    button("→", cycle(1)),
    button(
      "Pretend I'm hit",
      () => talk && end("You're hit, and Odo stops talking."),
    ),
  );
  document.body.append(bar);
  setVariant(variant);

  // The Blacksmith click: walk over (the server does that), and talk on arrival.
  return () => {
    if (talk) return;
    walkingOver = true;
  };
}
