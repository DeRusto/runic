import { expect, test } from "vitest";
import { playerOptionRefusal } from "./playerMenu.ts";

test("Follow, Examine and Message are never refused by the menu itself", () => {
  for (const option of ["Follow", "Examine", "Message"] as const)
    expect(playerOptionRefusal(option)).toBeUndefined();
});

test("Trade, Attack and Duel are refused until Phase 12", () => {
  for (const option of ["Trade", "Attack", "Duel"] as const)
    expect(playerOptionRefusal(option)).toMatch(/\.$/);
});
