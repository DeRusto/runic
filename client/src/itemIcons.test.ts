import { ITEMS } from "@runic/shared";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { iconUrl, itemName } from "./itemIcons.ts";

const ICONS_DIR = "client/public/icons";
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

describe("an item's name", () => {
  test.each([
    ["berry", "Berry"],
    ["emberbone", "Emberbone"],
    ["copperOre", "Copper ore"],
    ["emberiteShield", "Emberite shield"],
  ])("%s reads as %s", (id, name) => {
    expect(itemName(id)).toBe(name);
  });
});

describe("the committed icons", () => {
  const pngs = readdirSync(ICONS_DIR).filter((file) => file.endsWith(".png"));

  test("cover every item and the two tools, 26 in all (spec §7)", () => {
    expect(pngs.sort()).toEqual(
      [...Object.keys(ITEMS), "pickaxe", "hammer"]
        .map((id) => `${id}.png`)
        .sort(),
    );
    expect(pngs).toHaveLength(26);
  });

  test("each is the file iconUrl names, and a real PNG", () => {
    for (const id of Object.keys(ITEMS)) {
      const [, file] = iconUrl(id).split("/icons/");
      expect([...readFileSync(`${ICONS_DIR}/${file}`).subarray(0, 4)]).toEqual(
        PNG_SIGNATURE,
      );
    }
  });

  test("total about 450 KB", () => {
    const bytes = pngs.reduce(
      (total, file) => total + statSync(`${ICONS_DIR}/${file}`).size,
      0,
    );
    expect(bytes).toBeLessThan(500_000);
  });

  test("the licence copy says which file is Craftpix's", () => {
    const licence = readFileSync(`${ICONS_DIR}/LICENSE.txt`, "utf8");
    expect(licence).toContain("emberiteSword.png");
    expect(licence).toContain("https://craftpix.net/file-licenses/");
  });
});
