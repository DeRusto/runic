import type { Tool } from "./items.ts";

/** A conversation's line, said by the villager or by the player, whose words the chosen choice puts in their mouth. */
export type DialogueLine = { speaker: "villager" | "you"; text: string };

/** What the server does when a choice is picked, once it has checked the player is still beside the villager. */
export type DialogueAction = "giveTools" | "openStore" | "openBank";

/** `to` is the node the conversation moves to. */
export type DialogueChoice = {
  text: string;
  to: string;
  action?: DialogueAction;
};

/**
 * Its lines, then its choices. With no choices, `then` names the node whose choices come next,
 * and with neither the conversation ends after the lines.
 */
export type DialogueNode = {
  lines: DialogueLine[];
  choices?: DialogueChoice[];
  then?: string;
};

/** A villager's name and job, as the dialogue box titles them ("Odo, blacksmith"), their conversation from `start`, and the tools their `giveTools` choice gives. */
export type Villager = {
  name: string;
  role: string;
  start: string;
  nodes: Record<string, DialogueNode>;
  tools?: readonly Tool[];
};

const villager = (text: string): DialogueLine => ({
  speaker: "villager",
  text,
});
const you = (text: string): DialogueLine => ({ speaker: "you", text });

/** Every villager, by id. Add one by adding a row (village spec §2). */
export const VILLAGERS = {
  // The prototype's lines, kept by the owner (#195). The repeat turn-in offer is Phase 11's.
  odo: {
    name: "Odo",
    role: "blacksmith",
    start: "greet",
    tools: ["pickaxe", "hammer"],
    nodes: {
      greet: {
        lines: [villager("Morning. Odo's the name. I keep the forge.")],
        choices: [
          { text: "Got any work for me?", to: "work" },
          { text: "Can I use your furnace?", to: "furnace" },
          { text: "Have you got any tools?", to: "tools", action: "giveTools" },
          { text: "Bye.", to: "bye" },
        ],
      },
      work: {
        lines: [
          you("Got any work for me?"),
          villager(
            "Could do. I'm out of copper, and my back won't take the walk.",
          ),
          villager(
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
          villager(
            "Good. Take a pickaxe if you're short of one. Mind the spiders.",
          ),
        ],
      },
      later: {
        lines: [you("Not right now."), villager("Forge'll still be here.")],
      },
      furnace: {
        lines: [
          you("Can I use your furnace?"),
          villager("Not till you've shown me you can find your own ore."),
        ],
        then: "greet",
      },
      tools: {
        lines: [
          you("Have you got any tools?"),
          villager(
            "Everyone who comes through gets a pickaxe and a hammer. Here.",
          ),
        ],
      },
      bye: { lines: [you("Bye."), villager("Mind how you go.")] },
    },
  },
  marta: {
    name: "Marta",
    role: "storekeeper",
    start: "greet",
    nodes: {
      greet: {
        lines: [
          villager("Marta. I keep the store, for my sins."),
          villager("If it's not nailed down, I'll buy it off you."),
        ],
        choices: [
          { text: "What have you got?", to: "store", action: "openStore" },
          { text: "Bye.", to: "bye" },
        ],
      },
      // No lines, so the box closes as the store window opens.
      store: { lines: [] },
      bye: { lines: [you("Bye."), villager("Don't track mud in next time.")] },
    },
  },
  aldous: {
    name: "Aldous",
    role: "banker",
    start: "greet",
    nodes: {
      greet: {
        lines: [
          villager("Aldous, banker. Whatever you leave with me stays put."),
          villager("Spiders don't rob banks. Not yet, anyway."),
        ],
        choices: [
          { text: "I'd like to see my bank.", to: "bank", action: "openBank" },
          { text: "Bye.", to: "bye" },
        ],
      },
      // No lines, so the box closes as the bank window opens.
      bank: { lines: [] },
      bye: { lines: [you("Bye."), villager("Safe roads.")] },
    },
  },
  // The Forester (#206). Bram is the build ticket's flavour name.
  bram: {
    name: "Bram",
    role: "forester",
    start: "greet",
    tools: ["axe"],
    nodes: {
      greet: {
        lines: [
          villager("Bram. I look after the trees hereabouts."),
          villager(
            "Birch along the thicket, oak out east, and worse in the Boneyard.",
          ),
        ],
        choices: [
          { text: "Can I have an axe?", to: "axe", action: "giveTools" },
          { text: "Bye.", to: "bye" },
        ],
      },
      axe: {
        lines: [
          you("Can I have an axe?"),
          villager("Here. Start on the birch, and let the stumps grow back."),
        ],
      },
      bye: { lines: [you("Bye."), villager("Mind the roots.")] },
    },
  },
} satisfies Record<string, Villager>;

/** "a pickaxe", "an axe". */
export const aTool = (tool: Tool) =>
  `${/^[aeiou]/.test(tool) ? "an" : "a"} ${tool}`;

/** Why a player without `tool` can't do what needs it, naming the villager who gives it, or undefined if they have it. */
export function toolRefusal(tool: Tool, player: { tools: Iterable<string> }) {
  if ([...player.tools].includes(tool)) return undefined;
  const giver = Object.values(VILLAGERS as Record<string, Villager>).find(
    (villager) => villager.tools?.includes(tool),
  )!;
  const role = giver.role[0]!.toUpperCase() + giver.role.slice(1);
  return `You need ${aTool(tool)}. The ${role} will give you one.`;
}

export type VillagerId = keyof typeof VILLAGERS;

/** A villager's conversation nodes, looked up by any node name. */
export const nodesOf = (villager: VillagerId): Villager["nodes"] =>
  VILLAGERS[villager].nodes;

/** The node whose choices a conversation offers once `node`'s lines are said, or undefined when it ends there. */
export function choicesNodeOf(villager: VillagerId, node: string) {
  const nodes = nodesOf(villager);
  if (nodes[node]?.choices) return node;
  return nodes[node]?.then;
}

/** The actions a right-click shortcut may run without the talk: Trade and Bank. Tools are given only when asked (village spec §2). */
const SHORTCUT_ACTIONS: readonly unknown[] = ["openStore", "openBank"];

/** Whether `action` is a shortcut and some choice in `villager`'s conversation runs it, so the shortcut may skip the talk. */
export function offers(villager: VillagerId, action: unknown) {
  if (!SHORTCUT_ACTIONS.includes(action)) return false;
  const nodes = nodesOf(villager);
  return Object.values(nodes).some(({ choices }) =>
    choices?.some((choice) => choice.action === action),
  );
}
