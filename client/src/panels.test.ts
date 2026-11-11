import { beforeEach, expect, test, vi } from "vitest";
import { addPanel, watchPanels } from "./panels.ts";

class FakeInput {}
vi.stubGlobal("HTMLInputElement", FakeInput);
vi.stubGlobal("innerWidth", 1000);
vi.stubGlobal("innerHeight", 700);
let keydown: (event: object) => void;
let resize: () => void;
vi.stubGlobal("document", {
  addEventListener: (_: string, listener: typeof keydown) =>
    (keydown = listener),
});
vi.stubGlobal("addEventListener", (_: string, listener: typeof resize) => {
  resize = listener;
});
watchPanels();

type Handler = null | ((event: object) => void);
const fakePanel = (width = 300, height = 200) => {
  const titleBar = {
    tagName: "H2",
    setPointerCapture() {},
    onpointerdown: null as Handler,
    onpointermove: null as Handler,
    onlostpointercapture: null as Handler,
  };
  const element = {
    titleBar,
    offsetWidth: width,
    offsetHeight: height,
    style: {} as Record<string, string>,
    classes: new Set<string>(),
    classList: {
      toggle(name: string, on: boolean) {
        if (on) element.classes.add(name);
        else element.classes.delete(name);
      },
    },
    querySelector: () => titleBar,
    onpointerdown: null as Handler,
  };
  return element;
};
type FakePanel = ReturnType<typeof fakePanel>;

let shown: { closed: () => void }[] = [];
beforeEach(() => {
  for (const handle of shown) handle.closed();
  shown = [];
});
/** Opens a fake panel the way a panel module does: its close goes through the handle. */
const open = (element = fakePanel(), side?: "left" | "right") => {
  const close = vi.fn(() => handle.closed());
  const handle = addPanel(element as unknown as HTMLElement, close, side);
  handle.opened();
  shown.push(handle);
  return { element, handle, close };
};
const isFront = (element: FakePanel) => element.classes.has("front");
const at = (element: FakePanel) => [element.style.left, element.style.top];
const corner = (element: FakePanel) => at(element).map(parseFloat);
const drag = (element: FakePanel, from: number[], to: number[]) => {
  const [clientX, clientY] = from;
  const target = element.titleBar;
  element.titleBar.onpointerdown!({ target, clientX, clientY, pointerId: 1 });
  element.titleBar.onpointermove!({ clientX: to[0], clientY: to[1] });
  // The browser releases capture on pointerup and on pointercancel alike.
  element.titleBar.onlostpointercapture!({});
};

test("the panel opened last is in front, above the others", () => {
  const a = open();
  const b = open();
  expect(isFront(b.element)).toBe(true);
  expect(isFront(a.element)).toBe(false);
  expect(Number(b.element.style.zIndex)).toBeGreaterThan(
    Number(a.element.style.zIndex),
  );
});

test("a press anywhere on a panel brings it to the front", () => {
  const a = open();
  const b = open();
  a.element.onpointerdown!({});
  expect(isFront(a.element)).toBe(true);
  expect(isFront(b.element)).toBe(false);
});

test("Escape closes the front panel only, then the one behind it", () => {
  const a = open();
  const b = open();
  keydown({ key: "Escape", target: {} });
  expect(b.close).toHaveBeenCalledOnce();
  expect(a.close).not.toHaveBeenCalled();
  expect(isFront(a.element)).toBe(true);
  keydown({ key: "Escape", target: {} });
  expect(a.close).toHaveBeenCalledOnce();
});

test("first openings cascade: the character sheet on the right, the others on the left", () => {
  // 700 px window, 160 px bottom bar, 200 px panels, 8 px from the edges, 24 px apart.
  const sheet = open(fakePanel(), "right");
  const smithing = open();
  const social = open();
  expect(at(sheet.element)).toEqual(["692px", "332px"]);
  expect(at(smithing.element)).toEqual(["32px", "308px"]);
  expect(at(social.element)).toEqual(["56px", "284px"]);
});

test("a dragged panel follows the pointer but stays on screen and above the bottom bar", () => {
  const a = open();
  const [left, top] = at(a.element).map(parseFloat);
  drag(a.element, [left + 10, top + 5], [left + 60, top - 40]);
  expect(at(a.element)).toEqual([`${left + 50}px`, `${top - 45}px`]);
  drag(a.element, [left + 60, top - 40], [-500, 5000]);
  expect(at(a.element)).toEqual(["0px", "340px"]);
  drag(a.element, [10, 345], [5000, -500]);
  expect(at(a.element)).toEqual(["700px", "0px"]);
});

test("a drag ends when the pointer is lost, so later moves leave the panel", () => {
  const a = open();
  drag(a.element, corner(a.element), [100, 100]);
  expect(a.element.titleBar.onpointermove).toBeNull();
});

test("the close button in the title bar never starts a drag", () => {
  const a = open();
  a.element.titleBar.onpointerdown!({ target: { tagName: "BUTTON" } });
  expect(a.element.titleBar.onpointermove).toBeNull();
});

test("a shrinking window pulls open panels back on screen", () => {
  const a = open();
  drag(a.element, corner(a.element), [5000, 0]);
  vi.stubGlobal("innerWidth", 800);
  vi.stubGlobal("innerHeight", 500);
  // Not unstubAllGlobals, which would also drop the stubbed document; a failure here mustn't shrink later tests.
  try {
    resize();
    expect(at(a.element)).toEqual(["500px", "0px"]);
  } finally {
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 700);
  }
});

test("a panel reopens where it was last left", () => {
  const a = open();
  drag(a.element, corner(a.element), [-100, -100]);
  a.close();
  open(fakePanel());
  a.handle.opened();
  expect(at(a.element)).toEqual(["0px", "0px"]);
});

test("Escape in the chat box closes nothing", () => {
  const a = open();
  keydown({ key: "Escape", target: new FakeInput() });
  expect(a.close).not.toHaveBeenCalled();
});
