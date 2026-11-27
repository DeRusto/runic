import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { combatLevel, GEAR_SLOTS, parseRegion } from "@runic/shared";
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

// The newest migrations: Mastery's columns, the health rescale, which adds none, the eight new gear slots, the friends table, the ignores table, the bank, Herblaw, which renames Foraging's column, Woodcutting, Fishing, Cooking, Firemaking, Crafting, Fletching, the quests, Runecrafting, #238's two skills' columns, Thieving's (#250), the melee split, which turns Combat's column into Attack's and Strength's, Agility's (#234), its rigged shortcuts, Ranged's experience with the ammo slot and gear counts (#276), the Ranged stance (#280), the Knight's color and skin tone, and Magic's experience (#327).
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
  "fletching_xp",
  "quests",
  "quest_points",
  "identifies_essence",
  "runecrafting_xp",
  "leatherworking_xp",
  "jewelsmithing_xp",
  "thieving_xp",
  "agility_xp",
  "rigged_shortcuts",
  "ranged_xp",
  "weapon_count",
  "ammo_count",
  "ranged_stance",
  "knight_color",
  "skin_tone",
  "magic_xp",
];
const LATEST_MIGRATIONS = 24;

/** Makes the Magic migration pending again: its column gone, and its row in the journal. */
function unapplyMagic(sqlite: DatabaseSync) {
  sqlite.exec("ALTER TABLE players DROP COLUMN magic_xp");
  sqlite.exec(
    "DELETE FROM __drizzle_migrations WHERE id = (SELECT MAX(id) FROM __drizzle_migrations)",
  );
}

/** Makes the appearance migration pending again, and the Magic one after it: their columns gone, and their rows in the journal. */
function unapplyAppearance(sqlite: DatabaseSync) {
  unapplyMagic(sqlite);
  sqlite.exec("ALTER TABLE players DROP COLUMN knight_color");
  sqlite.exec("ALTER TABLE players DROP COLUMN skin_tone");
  sqlite.exec(
    "DELETE FROM __drizzle_migrations WHERE id = (SELECT MAX(id) FROM __drizzle_migrations)",
  );
}

/** Makes the Ranged stance's migration pending again, and the appearance one after it: their columns gone, and their rows in the journal. */
function unapplyRangedStance(sqlite: DatabaseSync) {
  unapplyAppearance(sqlite);
  sqlite.exec("ALTER TABLE players DROP COLUMN ranged_stance");
  sqlite.exec(
    "DELETE FROM __drizzle_migrations WHERE id = (SELECT MAX(id) FROM __drizzle_migrations)",
  );
}

/** Makes the Ranged migration pending again, and the Ranged stance's after it: their columns gone, and their rows in the journal. */
function unapplyRanged(sqlite: DatabaseSync) {
  unapplyRangedStance(sqlite);
  for (const column of ["ranged_xp", "ammo", "weapon_count", "ammo_count"])
    sqlite.exec(`ALTER TABLE players DROP COLUMN ${column}`);
  sqlite.exec(
    "DELETE FROM __drizzle_migrations WHERE id = (SELECT MAX(id) FROM __drizzle_migrations)",
  );
}

/** Makes the melee split pending again: Combat's column back, and Attack's, Strength's and the stance gone. */
function unapplySplit(sqlite: DatabaseSync) {
  sqlite.exec("ALTER TABLE players DROP COLUMN strength_xp");
  sqlite.exec("ALTER TABLE players DROP COLUMN stance");
  sqlite.exec("ALTER TABLE players RENAME COLUMN attack_xp TO combat_xp");
}

/** Makes the newest migrations pending again, as if this build had just added them. */
function unapplyLatest() {
  const sqlite = new DatabaseSync(path);
  unapplySplit(sqlite);
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

  test("the migrations backfill Mastery with 7% of the experience held, scale health by 100, add empty gear slots, turn Foraging into Herblaw, start Woodcutting and Fishing at 0, copy Combat to Attack and Strength and change nothing else", async () => {
    const database = await migratedFromOldRow();
    expect(readSave(7)).toEqual({
      accountId: 7,
      // Every skill the old row had no column for starts at 0.
      ...NO_EXPERIENCE,
      attackXp: 1234,
      strengthXp: 1234,
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
      ammo: "",
      weaponCount: 0,
      ammoCount: 0,
      tools: [],
      // A full bar has no room for Strength, so Attack alone takes Combat's place.
      pinnedSkills: [
        "Attack",
        "Defense",
        "Herblaw",
        "Hitpoints",
        "Mining",
        "Smithing",
      ],
      bank: [],
      bankCounts: [],
      quests: {},
      questPoints: 0,
      identifiesEssence: false,
      stance: "balanced",
      rangedStance: "steady",
      knightColor: "crimson",
      skinTone: "fair",
      riggedShortcuts: [],
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
      attackXp: 1234,
      strengthXp: 1234,
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
    expect(player).toMatchObject({ attackXp: 1234, strengthXp: 1234 });
    expect(player.bank.every((item) => item === "")).toBe(true);
    await database.shutdown();
  });
});

describe("a save from just before the melee split", () => {
  /** A row as the last build wrote it, with Combat's experience and these pins. */
  async function splitFrom(pinnedSkills: string[]) {
    await boot();
    const sqlite = new DatabaseSync(path);
    // Ranged's and Agility's columns came after the split, so they go first.
    unapplyRanged(sqlite);
    sqlite.exec("ALTER TABLE players DROP COLUMN rigged_shortcuts");
    sqlite.exec("ALTER TABLE players DROP COLUMN agility_xp");
    unapplySplit(sqlite);
    sqlite.exec(
      "DELETE FROM __drizzle_migrations WHERE id IN (SELECT id FROM __drizzle_migrations ORDER BY id DESC LIMIT 3)",
    );
    sqlite.exec(`INSERT INTO accounts (id, username, username_lower, password_hash, created_at)
      VALUES (8, 'Fighter', 'fighter', 'x', 0)`);
    sqlite
      .prepare(
        `INSERT INTO players (account_id, combat_xp, defense_xp, herblaw_xp, hitpoints_xp, x, y, health, inventory, mastery_xp, mastery_hundredths, pinned_skills)
         VALUES (8, 18050, 900, 0, 20000, 4, 1, 1000, '[]', 2500, 12, ?)`,
      )
      .run(JSON.stringify(pinnedSkills));
    sqlite.close();
    return openDatabase();
  }

  test("each of Attack and Strength gets all of Combat's experience, and Mastery gets nothing for it", async () => {
    const database = await splitFrom(["Combat", "Mining"]);
    expect(readSave(8)).toMatchObject({
      attackXp: 18050,
      strengthXp: 18050,
      defenseXp: 900,
      hitpointsXp: 20000,
      masteryXp: 2500,
      masteryHundredths: 12,
      stance: "balanced",
    });
    await database.shutdown();
    // Read from the table itself: a save only reads the columns the schema still names.
    const sqlite = new DatabaseSync(path);
    const columns = sqlite
      .prepare("SELECT name FROM pragma_table_info('players')")
      .all()
      .map(({ name }) => name);
    sqlite.close();
    expect(columns).toEqual(
      expect.arrayContaining(["attack_xp", "strength_xp", "stance"]),
    );
    expect(columns).not.toContain("combat_xp");
  });

  test("a pinned Combat becomes Attack and Strength in its place when the bar has room", async () => {
    const database = await splitFrom(["Mining", "Combat", "Herblaw"]);
    expect(readSave(8)!.pinnedSkills).toEqual([
      "Mining",
      "Attack",
      "Strength",
      "Herblaw",
    ]);
    await database.shutdown();
  });

  test("pins without Combat are left as they were", async () => {
    const database = await splitFrom(["Mining", "Herblaw"]);
    expect(readSave(8)!.pinnedSkills).toEqual(["Mining", "Herblaw"]);
    await database.shutdown();
  });

  test("the copy doesn't apply again on the next boot", async () => {
    await (await splitFrom(["Combat"])).shutdown();
    const database = await openDatabase();
    expect(readSave(8)).toMatchObject({ attackXp: 18050, strengthXp: 18050 });
    await database.shutdown();
  });

  test("Agility's column arrives after the split, at 0, and the rest is kept", async () => {
    const database = await splitFrom(["Combat"]);
    expect(readSave(8)).toMatchObject({
      agilityXp: 0,
      attackXp: 18050,
      hitpointsXp: 20000,
    });
    await database.shutdown();
  });

  test("the player loads at the combat level Combat gave them", async () => {
    const database = await splitFrom(["Combat"]);
    const sim = new Simulation(
      parseRegion(["TTTTTTT", "TR....T", "TTTTTTT"].join("\n")),
      () => 0,
    );
    sim.addPlayer("a", readSave(8)!, "Fighter");
    // 0.25 × (5 + 1 + 21) + 0.325 × (20 + 20) = 19.75
    expect(combatLevel(sim.state.players.get("a")!)).toBe(19);
    await database.shutdown();
  });
});

describe("a save from just before rigged shortcuts", () => {
  test("it keeps its Agility and everything else, and starts with no shortcut rigged", async () => {
    await boot();
    const sqlite = new DatabaseSync(path);
    unapplyRanged(sqlite);
    sqlite.exec("ALTER TABLE players DROP COLUMN rigged_shortcuts");
    sqlite.exec(
      "DELETE FROM __drizzle_migrations WHERE id = (SELECT MAX(id) FROM __drizzle_migrations)",
    );
    sqlite.exec(`INSERT INTO accounts (id, username, username_lower, password_hash, created_at)
      VALUES (9, 'Climber', 'climber', 'x', 0)`);
    sqlite.exec(`INSERT INTO players (account_id, attack_xp, defense_xp, herblaw_xp, hitpoints_xp, agility_xp, x, y, health, inventory)
      VALUES (9, 100, 200, 0, 20000, 18050, 36, 46, 900, '["rope"]')`);
    sqlite.close();
    const database = await openDatabase();
    expect(readSave(9)).toMatchObject({
      agilityXp: 18050,
      attackXp: 100,
      x: 36,
      y: 46,
      health: 900,
      inventory: ["rope"],
      riggedShortcuts: [],
    });
    await database.shutdown();
  });
});

describe("a save from just before Ranged (#276)", () => {
  /** A row as the last build wrote it: a bow worn on its old Attack gate, Ranged never trained, and arrows carried. */
  async function rangedFrom() {
    await boot();
    const sqlite = new DatabaseSync(path);
    unapplyRanged(sqlite);
    sqlite.exec(`INSERT INTO accounts (id, username, username_lower, password_hash, created_at)
      VALUES (10, 'Archer', 'archer', 'x', 0)`);
    sqlite.exec(`INSERT INTO players (account_id, attack_xp, strength_xp, defense_xp, herblaw_xp, hitpoints_xp, fletching_xp, mastery_xp, mastery_hundredths, x, y, health, inventory, inventory_counts, weapon, shield, stance)
      VALUES (10, 18050, 900, 200, 0, 20000, 4050, 700, 30, 4, 1, 900, '["copperArrow",""]', '[20,0]', 'charwoodBow', 'copperShield', 'forceful')`);
    sqlite.close();
    return openDatabase();
  }

  test("it loads with 0 Ranged experience, an empty ammo slot, and nothing else lost", async () => {
    const database = await rangedFrom();
    expect(readSave(10)).toMatchObject({
      rangedXp: 0,
      ammo: "",
      ammoCount: 0,
      attackXp: 18050,
      strengthXp: 900,
      defenseXp: 200,
      hitpointsXp: 20000,
      fletchingXp: 4050,
      masteryXp: 700,
      masteryHundredths: 30,
      health: 900,
      inventory: ["copperArrow", ""],
      inventoryCounts: [20, 0],
      weapon: "charwoodBow",
      shield: "copperShield",
      stance: "forceful",
    });
    await database.shutdown();
  });

  test("the bow it wore stays worn as one, and saving keeps the counts", async () => {
    const database = await rangedFrom();
    const sim = new Simulation(
      parseRegion(["TTTTTTT", "TR....T", "TTTTTTT"].join("\n")),
      () => 0,
    );
    sim.addPlayer("a", readSave(10)!, "Archer");
    expect(sim.state.players.get("a")).toMatchObject({
      weapon: "charwoodBow",
      weaponCount: 1,
      ammo: "",
      ammoCount: 0,
      rangedXp: 0,
    });
    writeSave(10, sim.saveOf("a")!);
    expect(readSave(10)).toMatchObject({ weaponCount: 1, ammoCount: 0 });
    await database.shutdown();
  });
});

describe("a save from just before Ranged's stances (#280)", () => {
  test("it starts Steady, keeps its melee stance and loses nothing", async () => {
    await boot();
    const sqlite = new DatabaseSync(path);
    unapplyRangedStance(sqlite);
    sqlite.exec(`INSERT INTO accounts (id, username, username_lower, password_hash, created_at)
      VALUES (11, 'Bowyer', 'bowyer', 'x', 0)`);
    sqlite.exec(`INSERT INTO players (account_id, attack_xp, strength_xp, defense_xp, herblaw_xp, hitpoints_xp, ranged_xp, x, y, health, inventory, inventory_counts, weapon, weapon_count, ammo, ammo_count, stance)
      VALUES (11, 900, 400, 300, 0, 20000, 5000, 4, 1, 900, '[""]', '[0]', 'oakBow', 1, 'ironArrow', 17, 'precise')`);
    sqlite.close();
    const database = await openDatabase();
    expect(readSave(11)).toMatchObject({
      rangedStance: "steady",
      stance: "precise",
      rangedXp: 5000,
      defenseXp: 300,
      weapon: "oakBow",
      ammo: "ironArrow",
      ammoCount: 17,
    });
    await database.shutdown();
  });
});

describe("a save from before the Knight's colors and skin tones", () => {
  test("it keeps the model's own Crimson and Fair, and loses nothing", async () => {
    await boot();
    const sqlite = new DatabaseSync(path);
    unapplyAppearance(sqlite);
    sqlite.exec(`INSERT INTO accounts (id, username, username_lower, password_hash, created_at)
      VALUES (12, 'Squire', 'squire', 'x', 0)`);
    sqlite.exec(`INSERT INTO players (account_id, attack_xp, strength_xp, defense_xp, herblaw_xp, hitpoints_xp, x, y, health, inventory, inventory_counts, ranged_stance)
      VALUES (12, 900, 400, 300, 0, 20000, 4, 1, 900, '[""]', '[0]', 'rapid')`);
    sqlite.close();
    const database = await openDatabase();
    expect(readSave(12)).toMatchObject({
      knightColor: "crimson",
      skinTone: "fair",
      rangedStance: "rapid",
      attackXp: 900,
    });
    await database.shutdown();
  });
});

describe("a save from just before Magic (#327)", () => {
  test("it loads with 0 Magic experience and nothing else lost", async () => {
    await boot();
    const sqlite = new DatabaseSync(path);
    unapplyMagic(sqlite);
    sqlite.exec(`INSERT INTO accounts (id, username, username_lower, password_hash, created_at)
      VALUES (13, 'Apprentice', 'apprentice', 'x', 0)`);
    sqlite.exec(`INSERT INTO players (account_id, attack_xp, strength_xp, defense_xp, ranged_xp, herblaw_xp, hitpoints_xp, crafting_xp, runecrafting_xp, mastery_xp, x, y, health, inventory, inventory_counts, weapon, shield, knight_color)
      VALUES (13, 900, 400, 300, 1250, 0, 20000, 4050, 200, 500, 4, 1, 900, '["airRune",""]', '[12,0]', 'birchBow', 'copperShield', 'violet')`);
    sqlite.close();
    const database = await openDatabase();
    expect(readSave(13)).toMatchObject({
      magicXp: 0,
      attackXp: 900,
      strengthXp: 400,
      defenseXp: 300,
      rangedXp: 1250,
      hitpointsXp: 20000,
      craftingXp: 4050,
      runecraftingXp: 200,
      masteryXp: 500,
      inventory: ["airRune", ""],
      inventoryCounts: [12, 0],
      weapon: "birchBow",
      shield: "copperShield",
      knightColor: "violet",
    });
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
