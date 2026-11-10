import { expect, test } from "vitest";
import { playerOptionRefusal } from "./playerMenu.ts";

test("Follow, Examine and Message are never refused by the menu itself", () => {
  for (const option of ["Follow", "Examine", "Message", "toString"])
    expect(playerOptionRefusal(option)).toBeUndefined();
});
