import { MAX_PINNED_SKILLS, SKILLS } from "@runic/shared";
import type { World } from "./worldContext.ts";

/** Pins a skill to the bar or unpins it. Comes straight off the network, so anything invalid is ignored. A tick reads no pins, so like chat this skips the queue. */
export function pinSkill(
  world: World,
  id: string,
  intent: { skill: string; pinned: boolean },
) {
  if (world.isCrossing(id)) return;
  const pins = world.state.players.get(id)?.pinnedSkills;
  const { skill, pinned } = intent ?? {};
  if (!pins || !SKILLS.some(([name]) => name === skill)) return;
  const at = pins.indexOf(skill);
  if (pinned === false && at >= 0) pins.splice(at, 1);
  if (pinned === true && at < 0 && pins.length < MAX_PINNED_SKILLS)
    pins.push(skill);
}
