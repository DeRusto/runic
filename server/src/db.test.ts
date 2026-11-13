import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { GEAR_SLOTS, parseRegion } from "@runic/shared";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { db, openDatabase } from "./db.ts";
import { NO_EXPERIENCE } from "./playerSave.ts";
import { readSave, writeSave } from "./saves.ts";
import { accounts } from "./schema.ts";
import { Simulation } from "./simulation.ts";

let folder: string;
let path: string;
const copies = () => {
  const dir = join(folder, "pre-migration");
  return existsSync(dir) ? readdirSync(dir).map((name) => join(dir, name)) : [];
};

/** Opens and closes the game database, which migrates it. */
async function boot() {
  await (await openDatabase()).shutdown();
}

// The newest migrations: Mastery's columns, the health rescale, which adds none, the eight new gear slots, the friends table, the ignores table, the bank, Herblaw, which renames Foraging's column, Woodcutting, Fishing, Cooking, Firemaking and Crafting.
const LATEST_COLUMNS = [
  "mastery_xp",
  "mastery_hundredths",
  ...GEAR_SLOTS.slice(2),
  "bank",
  "bank_counts",
  "woodcutting_xp",
  "fishing_xp",
  "cooking_xp",
  "firemaking_xp",
  "crafting_xp",
];
const LATEST_MIGRATIONS = 12;

/** Makes the newest migrations pending again, as if this build had just added them. */
function unapplyLatest() {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("DROP TABLE IF EXISTS friends");
  sqlite.exec("DROP TABLE IF EXISTS ignores");
  sqlite.exec("ALTER TABLE players RENAME COLUMN herblaw_xp TO foraging_xp");
  for (const column of LATEST_COLUMNS) {
    sqlite.exec(`ALTER TABLE players DROP COLUMN ${column}`);
  }
  sqlite.exec(
    `DELETE FROM __drizzle_migrations WHERE id IN (SELECT id FROM __drizzle_migrations ORDER BY id DESC LIMIT ${LATEST_MIGRATIONS})`,
  );
  sqlite.close();
}

function hasLatestMigration(file: string) {
  const sqlite = new DatabaseSync(file);
  const row = sqlite
    .prepare(
      "SELECT 1 FROM pragma_table_info('players') WHERE name = 'mastery_xp'",
    )
    .get();
  sqlite.close();
  return row !== undefined;
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "runic-db-"));
  path = join(folder, "game.db");
  process.env.DATABASE_PATH = path;
});
afterEach(() => rmSync(folder, { recursive: true, force: true }));

test("a new database and an up-to-date one make no copy", async () => {
  await boot();
  await boot();
  expect(copies()).toEqual([]);
});

test("pending migrations copy the database first, with its data, before migrating", async () => {
  const database = await openDatabase();
  db.insert(accounts)
    .values({ username: "Kept", usernameLower: "kept", passwordHash: "x" })
    .run();
  await database.shutdown();
  unapplyLatest();

  await boot();

  const [copy] = copies();
  expect(copies()).toHaveLength(1);
  expect(hasLatestMigration(copy!)).toBe(false);
  expect(hasLatestMigration(path)).toBe(true);
  const sqlite = new DatabaseSync(copy!);
  expect(sqlite.prepare("SELECT username FROM accounts").all()).toEqual([
    { username: "Kept" },
  ]);
  sqlite.close();
});

describe("a save from the first slice, written before the stacks migration", () => {
  const INVENTORY = Array<string>(30).fill("");
  INVENTORY[0] = "berry";
  INVENTORY[4] = "herb";
  INVENTORY[9] = "berry";
  const FILLED_SLOTS = [0, 4, 9];
  // The pins column's default before Herblaw, written out, since unapplying the migrations keeps the newer default.
  const FORAGING_PINS = [
    "Combat",
    "Defense",
    "Foraging",
    "Hitpoints",
    "Mining",
    "Smithing",
  ];
  // The saved tile, (4,1), is next to the berry bush.
  const TILES = parseRegion(["TTTTTTT", "TR...bT", "TTTTTTT"].join("\n"));

  async function migratedFromOldRow() {
    await boot();
    unapplyLatest();
    const sqlite = new DatabaseSync(path);
    sqlite.exec(`INSERT INTO accounts (id, username, username_lower, password_hash, created_at)
      VALUES (7, 'Old', 'old', 'x', 0)`);
    sqlite
      .prepare(
        `INSERT INTO players (account_id, combat_xp, defense_xp, foraging_xp, hitpoints_xp, x, y, health, inventory, pinned_skills)
         VALUES (7, 1234, 567, 890, 4500, 4, 1, 6, ?, ?)`,
      )
      .run(JSON.stringify(INVENTORY), JSON.stringify(FORAGING_PINS));
    sqlite.close();
    return openDatabase();
  }

  test("the migrations backfill Mastery with 7% of the experience held, scale health by 100, add empty gear slots, turn Foraging into Herblaw, start Woodcutting and Fishing at 0 and change nothing else", async () => {
    const database = await migratedFromOldRow();
    expect(readSave(7)).toEqual({
      accountId: 7,
      // Every skill the old row had no column for starts at 0.
      ...NO_EXPERIENCE,
      combatXp: 1234,
      defenseXp: 567,
      herblawXp: 890,
      hitpointsXp: 4500,
      x: 4,
      y: 1,
      health: 600, // 6 before the rescale.
      inventory: INVENTORY,
      // 7% of 7,191.
      masteryXp: 503,
      masteryHundredths: 37,
      inventoryCounts: [],
      weapon: "",
      shield: "",
      head: "",
      body: "",
      legs: "",
      hands: "",
      feet: "",
      cape: "",
      neck: "",
      ring: "",
      tools: [],
      pinnedSkills: [
        "Combat",
        "Defense",
        "Herblaw",
        "Hitpoints",
        "Mining",
        "Smithing",
      ],
      bank: [],
      bankCounts: [],
    });
    await database.shutdown();
  });

  test("the backfill and the rescale don't apply again on the next boot", async () => {
    await (await migratedFromOldRow()).shutdown();
    const database = await openDatabase();
    expect(readSave(7)).toMatchObject({
      masteryXp: 503,
      masteryHundredths: 37,
      health: 600,
    });
    await database.shutdown();
  });

  test("it loads with its experience, inventory and tile intact, and its food as stacks of 1 in the same slots", async () => {
    const database = await migratedFromOldRow();
    const sim = new Simulation(TILES, () => 0);
    sim.addPlayer("a", readSave(7), "Old");

    const player = sim.state.players.get("a")!;
    expect(player).toMatchObject({
      combatXp: 1234,
      defenseXp: 567,
      herblawXp: 890,
      hitpointsXp: 4500,
      x: 4,
      y: 1,
      health: 600, // 6 before the rescale.
    });
    expect([...player.inventory]).toEqual(INVENTORY);
    expect([...player.inventoryCounts]).toEqual(
      INVENTORY.map((_, slot) => (FILLED_SLOTS.includes(slot) ? 1 : 0)),
    );
    await database.shutdown();
  });

  test("saving it and loading it again keeps everything, and new food tops up its first stack", async () => {
    const database = await migratedFromOldRow();
    const sim = new Simulation(TILES, () => 0);
    sim.addPlayer("a", readSave(7), "Old");
    sim.queueGather("a", "herblaw", "5,1");
    sim.tick();
    writeSave(7, sim.saveOf("a")!);
    sim.removePlayer("a");

    sim.addPlayer("b", readSave(7), "Old");
    const player = sim.state.players.get("b")!;
    expect([...player.inventory]).toEqual(INVENTORY);
    expect(player.inventoryCounts[0]).toBe(2);
    expect(player.inventoryCounts[4]).toBe(1);
    expect(player.inventoryCounts[9]).toBe(1);
    expect(player.combatXp).toBe(1234);
    expect(player.bank.every((item) => item === "")).toBe(true);
    await database.shutdown();
  });
});

test("only the last five copies are kept", async () => {
  await boot();
  const names: string[] = [];
  for (let i = 0; i < 7; i++) {
    unapplyLatest();
    await boot();
    const added = copies().find((copy) => !names.includes(copy))!;
    names.push(added);
  }
  expect(copies().sort()).toEqual(names.slice(-5).sort());
});
