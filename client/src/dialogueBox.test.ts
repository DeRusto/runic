import { expect, test } from "vitest";
import { shownAt } from "./dialogueBox.ts";

test("the box shows a node's lines one at a time, by who says them", () => {
  expect(shownAt("odo", "work", 0)).toEqual({
    line: { speaker: "you", text: "Got any work for me?" },
  });
  expect(shownAt("odo", "work", 1)).toEqual({
    line: {
      speaker: "villager",
      text: "Could do. I'm out of copper, and my back won't take the walk.",
    },
  });
});

test("after the lines come the node's choices, or the ones it leads back to", () => {
  const texts = (shown: ReturnType<typeof shownAt>) =>
    shown && "choices" in shown && shown.choices.map(({ text }) => text);
  expect(texts(shownAt("odo", "work", 3))).toEqual([
    "I'll fetch it.",
    "Not right now.",
  ]);
  expect(texts(shownAt("odo", "furnace", 2))).toEqual([
    "Got any work for me?",
    "Can I use your furnace?",
    "Have you got any tools?",
    "Bye.",
  ]);
});

test("a node with no choices to follow ends the conversation after its lines", () => {
  expect(shownAt("odo", "bye", 2)).toBeUndefined();
});
