import { expect, test, vi } from "vitest";
import { leftPanel } from "./leftPanels.ts";

test("opening a left panel closes the others, and a forgotten one is left alone", () => {
  const [a, b, c] = [vi.fn(), vi.fn(), vi.fn()];
  const panels = [a, b, c].map(leftPanel);
  panels[2].forget();
  panels[0].opening();
  expect(a).not.toHaveBeenCalled();
  expect(b).toHaveBeenCalledOnce();
  expect(c).not.toHaveBeenCalled();
});
