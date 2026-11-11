import { beforeEach, describe, expect, test, vi } from "vitest";
import { addBarButtons, barButtonTip } from "./barButtons.ts";

/** A bar button as the page holds it: its name and, for all but Log out, its hotkey. */
const button = (ariaLabel: string, key?: string) => ({
  ariaLabel,
  getAttribute: (name: string) =>
    name === "aria-keyshortcuts" ? (key ?? null) : null,
  classList: new Set<string>(),
  onpointermove: null,
  onpointerleave: null,
  onpointerdown: null,
});
const buttons: Record<string, ReturnType<typeof button>> = {
  "turn-left": button("Turn view left", "Q"),
  "turn-right": button("Turn view right", "E"),
  character: button("Character sheet", "C"),
  "social-button": button("Social", "O"),
  logout: button("Log out"),
};
for (const b of Object.values(buttons)) {
  Object.assign(b.classList, {
    toggle(this: Set<string>, name: string, on: boolean) {
      if (on) this.add(name);
      else this.delete(name);
    },
  });
}
vi.stubGlobal("document", {
  getElementById: (id: string) => buttons[id],
  createElement: (tagName: string) => ({ tagName, textContent: "" }),
});
const listeners = new Map<string, (event: unknown) => void>();
vi.stubGlobal("addEventListener", (type: string, listener: () => void) =>
  listeners.set(type, listener),
);
vi.stubGlobal("HTMLInputElement", class {});

const key = (type: "keydown" | "keyup", key: string, more = {}) =>
  listeners.get(type)!({ key, target: {}, ...more });

describe("the square bar buttons (spec §7)", () => {
  test("a button's tip gives its name, then its hotkey in a key box", () => {
    const [name, box] = barButtonTip(buttons.character as never) as [
      string,
      { tagName: string; textContent: string },
    ];
    expect(name).toBe("Character sheet");
    expect(box).toEqual({ tagName: "kbd", textContent: "C" });
  });

  test("Log out's tip shows only its name", () => {
    expect(barButtonTip(buttons.logout as never)).toBe("Log out");
  });

  describe("pressing a hotkey", () => {
    beforeEach(() => {
      listeners.clear();
      for (const b of Object.values(buttons)) b.classList.clear();
      addBarButtons();
    });

    test("shows its button pressed until the key comes up", () => {
      key("keydown", "c");
      expect(buttons.character.classList.has("pressed")).toBe(true);
      expect(buttons["social-button"].classList.has("pressed")).toBe(false);
      key("keyup", "c");
      expect(buttons.character.classList.has("pressed")).toBe(false);
    });

    test("presses the turn buttons with Q and E", () => {
      key("keydown", "Q");
      key("keydown", "e");
      expect(buttons["turn-left"].classList.has("pressed")).toBe(true);
      expect(buttons["turn-right"].classList.has("pressed")).toBe(true);
    });

    test("typing in chat presses nothing", () => {
      key("keydown", "o", { target: new HTMLInputElement() });
      key("keydown", "o", { ctrlKey: true });
      expect(buttons["social-button"].classList.has("pressed")).toBe(false);
    });
  });
});
