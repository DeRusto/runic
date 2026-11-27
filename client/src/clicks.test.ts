import { CROSS_INTENT, OUT_OF_ARROWS_LINE, TARGET_INTENT } from "@runic/shared";
import { expect, test, vi } from "vitest";
import { walkOnClick } from "./clicks.ts";
import type { WorldConnection } from "./players.ts";
import { renderer } from "./scene.ts";

// The real scene starts a WebGL renderer; the canvas only has to take click listeners.
vi.mock("./scene.ts", async () => {
  const THREE = await import("three");
  return {
    camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200),
    renderer: { domElement: new EventTarget() },
    scene: new THREE.Scene(),
  };
});
vi.mock("./bottomBar.ts", () => ({ printChatLine: vi.fn() }));
vi.mock("./playerMenu.ts", () => ({ playerMenuChoices: () => [] }));

const none = () => undefined;

test("a click on a fire lit on an obstacle's tile cooks there instead of crossing", () => {
  vi.stubGlobal("innerWidth", 800);
  vi.stubGlobal("innerHeight", 600);
  const send = vi.fn();
  const room = {
    send,
    sessionId: "me",
    state: { players: new Map([["me", { action: "" }]]) },
    onLeave: vi.fn(),
  } as unknown as WorldConnection;
  const openSmithingPanel = vi.fn();
  walkOnClick(
    room,
    [],
    none as never,
    none as never,
    none as never,
    (() => ({ x: 38, y: 45 })) as never,
    openSmithingPanel as never,
    none as never,
    none as never,
    none as never,
    none as never,
    (() => ({ obstacle: "balanceBeam", x: 36, y: 45 })) as never,
    none as never,
    vi.fn() as never,
    none as never,
    vi.fn(),
  );
  const click = Object.assign(new Event("click"), {
    clientX: 400,
    clientY: 300,
  });
  renderer.domElement.dispatchEvent(click);
  expect(openSmithingPanel).toHaveBeenCalledWith("fire", { x: 38, y: 45 });
  expect(send).not.toHaveBeenCalledWith(CROSS_INTENT, expect.anything());
});

test("a click on an enemy with a bow and no arrows says why and sends no attack", async () => {
  const { printChatLine } = await import("./bottomBar.ts");
  vi.stubGlobal("innerWidth", 800);
  vi.stubGlobal("innerHeight", 600);
  const send = vi.fn();
  const room = {
    send,
    sessionId: "me",
    state: {
      players: new Map([["me", { action: "", weapon: "birchBow", ammo: "" }]]),
    },
    onLeave: vi.fn(),
  } as unknown as WorldConnection;
  walkOnClick(
    room,
    [],
    (() => ({ id: "0", tile: { x: 5, y: 5 } })) as never,
    none as never,
    none as never,
    none as never,
    none as never,
    none as never,
    none as never,
    none as never,
    none as never,
    none as never,
    none as never,
    none as never,
    none as never,
    vi.fn(),
  );
  renderer.domElement.dispatchEvent(
    Object.assign(new Event("click"), { clientX: 400, clientY: 300 }),
  );
  expect(printChatLine).toHaveBeenCalledWith(OUT_OF_ARROWS_LINE);
  expect(send).not.toHaveBeenCalled();
});

test("the Thornling's right-click menu names it and sends the selected attack", () => {
  vi.stubGlobal("innerWidth", 800);
  vi.stubGlobal("innerHeight", 600);
  const send = vi.fn();
  const openMenu = vi.fn();
  const room = {
    send,
    sessionId: "me",
    state: { players: new Map([["me", { action: "" }]]) },
    onLeave: vi.fn(),
  } as unknown as WorldConnection;
  walkOnClick(
    room,
    [],
    () => ({ id: "0", name: "Thornling", tile: { x: 5, y: 5, state: "idle" } }),
    none,
    none,
    none,
    vi.fn(),
    none,
    none,
    none,
    none,
    none,
    none,
    vi.fn(),
    none,
    openMenu,
  );
  renderer.domElement.dispatchEvent(
    Object.assign(new Event("contextmenu"), { clientX: 400, clientY: 300 }),
  );
  expect(openMenu).toHaveBeenCalledWith(expect.anything(), [
    ["Attack Thornling", expect.any(Function)],
  ]);
  expect(send).not.toHaveBeenCalled();
  openMenu.mock.calls[0]![1][0][1]();
  expect(send).toHaveBeenCalledWith(TARGET_INTENT, "0");
});
