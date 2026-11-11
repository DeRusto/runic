import type { Client } from "@colyseus/core";
import { commandRefusal, emoteRefusal } from "@runic/shared";
import type { Simulation } from "./simulation.ts";
import { SOCIAL_COMMANDS, tell } from "./social.ts";

/** What the chat commands need from the room. */
export type World = {
  sim: Simulation;
  /** Every player in the world, the one definition of online: a dropped connection still counts, a login still waiting does not. */
  onlinePlayers(): Client[];
  /** Broadcasts a public chat line or an emote, as public chat does. */
  say(client: Client, text: string, emote: boolean): void;
};

export type Command = {
  /** What `/help` shows before the colon, as in "/pm <name> <message>". */
  usage: string;
  description: string;
  /** Gets the trimmed text after the name. */
  run: (world: World, client: Client, args: string) => void;
};

/** Chat commands by lower-cased name. `/help` lists this table, so a command can't run without a help line (Spec §2). */
const COMMANDS: Record<string, Command> = {
  help: {
    usage: "/help",
    description: "List every chat command.",
    run: (_world, client) => {
      for (const name of Object.keys(COMMANDS).sort()) {
        const { usage, description } = COMMANDS[name]!;
        tell(client, `${usage}: ${description}`);
      }
    },
  },
  who: {
    usage: "/who",
    description: "List every online player.",
    // Ignore lists hide no one here (Spec §2).
    run: (world, client) => {
      const names = world
        .onlinePlayers()
        .map((other) => other.auth.username)
        .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
      tell(client, `Online (${names.length}): ${names.join(", ")}`);
    },
  },
  e: {
    usage: "/e <text>",
    description:
      "Act something out, shown in bold to everyone as your name then the text.",
    run: (world, client, text) => {
      const refusal = emoteRefusal(text);
      if (refusal) return tell(client, refusal);
      world.say(client, text, true);
    },
  },
  ...SOCIAL_COMMANDS,
};

/** `line` is the chat line after its leading "/". */
export function runCommand(world: World, client: Client, line: string) {
  const [name = "", args = ""] = line.split(/\s+(.*)/s);
  const known = Object.hasOwn(COMMANDS, name.toLowerCase());
  const refusal = commandRefusal(name, known);
  if (refusal) return tell(client, refusal);
  COMMANDS[name.toLowerCase()]!.run(world, client, args.trim());
}
