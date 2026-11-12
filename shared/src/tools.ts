import { VILLAGERS, type Villager } from "./dialogue.ts";

/** Every tool. Tools aren't items: they live in the Toolbelt, not a slot (spec §4). Each villager's `tools` says who gives which. */
export const TOOLS = ["pickaxe", "hammer", "axe", "rod"] as const;
export type Tool = (typeof TOOLS)[number];

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
