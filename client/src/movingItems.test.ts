import { beforeEach, expect, test, vi } from "vitest";
import { dragToReorder } from "./movingItems.ts";

type FakeSlot = {
  dataset: DOMStringMap;
  draggable: boolean;
  onkeydown: (event: object) => void;
};

let slots: FakeSlot[];
let move: ReturnType<typeof vi.fn>;
/** Presses `key` on slot `at`, and returns whether the press was kept from going further. */
const press = (at: number, key: string) => {
  const stopPropagation = vi.fn();
  slots[at]!.onkeydown({ key, preventDefault: () => {}, stopPropagation });
  return stopPropagation.mock.calls.length > 0;
};

beforeEach(() => {
  slots = Array.from({ length: 3 }, (_, at) => ({
    dataset: {},
    draggable: at !== 2,
    onkeydown: () => {},
  }));
  move = vi.fn();
  dragToReorder(slots as unknown as HTMLElement[], move);
});

test("M on a slot picks it up, and M on another moves it there", () => {
  press(0, "m");
  expect(slots[0]!.dataset.moving).toBe("true");
  press(2, "M");
  expect(move).toHaveBeenCalledWith(0, 2);
  expect(slots[0]!.dataset.moving).toBeUndefined();
});

test("M on the slot picked up puts it back, and an empty slot can't be picked up", () => {
  press(0, "m");
  press(0, "m");
  press(2, "m");
  press(1, "m");
  expect(move).not.toHaveBeenCalled();
});

test("Escape lets go of a picked-up slot without closing the window", () => {
  press(1, "m");
  expect(press(1, "Escape")).toBe(true);
  press(0, "m");
  expect(move).not.toHaveBeenCalled();
  expect(press(0, "Escape")).toBe(true);
  expect(press(0, "Escape")).toBe(false);
});
