/** A conversation's line, said by the villager or by the player, whose words the chosen choice puts in their mouth. */
export type DialogueLine = { speaker: "villager" | "you"; text: string };

/** What the server does when a choice is picked, once it has checked the player is still beside the villager. */
export type DialogueAction = "giveTools" | "openBank";

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

/** A villager's name and job, as the dialogue box titles them ("Odo, blacksmith"), and their conversation from `start`. */
export type Villager = {
  name: string;
  role: string;
  start: string;
  nodes: Record<string, DialogueNode>;
};

const villager = (text: string): DialogueLine => ({
  speaker: "villager",
  text,
});
const you = (text: string): DialogueLine => ({ speaker: "you", text });

/** Every villager, by id. Add one by adding a row (#90). */
export const VILLAGERS = {
  // The prototype's lines, kept by the owner (#195). The repeat turn-in offer is Phase 11's.
  odo: {
    name: "Odo",
    role: "blacksmith",
    start: "greet",
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
  // Her job arrives as a choice with the store (#202).
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
        choices: [{ text: "Bye.", to: "bye" }],
      },
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
} satisfies Record<string, Villager>;

export type VillagerId = keyof typeof VILLAGERS;

/** The node whose choices a conversation offers once `node`'s lines are said, or undefined when it ends there. */
export function choicesNodeOf(villager: VillagerId, node: string) {
  const { nodes } = VILLAGERS[villager] as Villager;
  if (nodes[node]?.choices) return node;
  return nodes[node]?.then;
}

/** Whether some choice in `villager`'s conversation runs `action`, so a shortcut to it may skip the talk. */
export function offers(villager: VillagerId, action: unknown) {
  const { nodes } = VILLAGERS[villager] as Villager;
  return Object.values(nodes).some(({ choices }) =>
    choices?.some((choice) => choice.action === action),
  );
}
