import { ITEMS } from "@runic/shared";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { colouredNames, iconUrl, itemName } from "./itemIcons.ts";

const ICONS_DIR = "client/public/icons";
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

describe("an item's name", () => {
  test.each([
    ["berry", "Berry"],
    ["emberbone", "Emberbone"],
    ["copperOre", "Copper ore"],
    ["emberiteShield", "Emberite shield"],
    ["copperChestplate:uncommon:fortitude", "Copper chestplate of Fortitude"],
    ["ironSword:rare:might", "Iron sword of Might"],
  ])("%s reads as %s", (id, name) => {
    expect(itemName(id)).toBe(name);
  });
});

test("an improved item shows its common form's icon", () => {
  expect(iconUrl("copperChestplate:rare:avoidance")).toBe(
    iconUrl("copperChestplate"),
  );
});

describe("coloured names", () => {
  vi.stubGlobal("document", {
    createElement: () => ({ className: "", textContent: "" }),
  });
  /** A part as `[class]text`, or the plain text. */
  const shown = (parts: ReturnType<typeof colouredNames>) =>
    parts.map((part) =>
      typeof part === "string"
        ? part
        : `[${part.className}]${part.textContent}`,
    );

  test("an improved item's name takes its Quality's colour, and a common one stays plain (spec §5)", () => {
    expect(
      shown(
        colouredNames("You make a Copper sword of Might!", [
          "copperSword:uncommon:might",
        ]),
      ),
    ).toEqual(["You make a ", "[uncommon]Copper sword of Might", "!"]);
    expect(shown(colouredNames("Copper sword (1)", ["copperSword"]))).toEqual([
      "Copper sword (1)",
    ]);
  });

  test("each name in a pile takes its own item's colour, in order", () => {
    expect(
      shown(
        colouredNames(
          "Copper sword (1)\nCopper sword of Might (1)\nCopper sword of Might (1)",
          [
            "copperSword",
            "copperSword:rare:might",
            "copperSword:uncommon:might",
          ],
        ),
      ),
    ).toEqual([
      "Copper sword (1)\n",
      "[rare]Copper sword of Might",
      " (1)\n",
      "[uncommon]Copper sword of Might",
      " (1)",
    ]);
  });
});

describe("the committed icons", () => {
  const pngs = readdirSync(ICONS_DIR).filter((file) => file.endsWith(".png"));

  test("cover every item and the three tools, 48 in all (spec §7)", () => {
    expect(pngs.sort()).toEqual(
      [...Object.keys(ITEMS), "pickaxe", "hammer", "axe"]
        .map((id) => `${id}.png`)
        .sort(),
    );
    expect(pngs).toHaveLength(48);
  });

  test("each is the file iconUrl names, and a real PNG", () => {
    for (const id of Object.keys(ITEMS)) {
      const [, file] = iconUrl(id).split("/icons/");
      expect([...readFileSync(`${ICONS_DIR}/${file}`).subarray(0, 4)]).toEqual(
        PNG_SIGNATURE,
      );
    }
  });

  test("average under 17 KB an icon, so the set grows only with its count", () => {
    const bytes = pngs.reduce(
      (total, file) => total + statSync(`${ICONS_DIR}/${file}`).size,
      0,
    );
    expect(bytes / pngs.length).toBeLessThan(17_000);
  });

  test("the licence copy says which file is Craftpix's", () => {
    const licence = readFileSync(`${ICONS_DIR}/LICENSE.txt`, "utf8");
    expect(licence).toContain("emberiteSword.png");
    expect(licence).toContain("https://craftpix.net/file-licenses/");
  });
});
