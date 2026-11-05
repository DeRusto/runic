import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, test } from "vitest";
import { db, openDatabase } from "./db.ts";
import { accounts } from "./schema.ts";

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

/** Makes the newest migration pending again, as if this build had just added it. */
function unapplyLatest() {
  const sqlite = new DatabaseSync(path);
  sqlite.exec(`DROP TABLE players;
    DELETE FROM __drizzle_migrations WHERE id = (SELECT max(id) FROM __drizzle_migrations)`);
  sqlite.close();
}

function hasTable(file: string, table: string) {
  const sqlite = new DatabaseSync(file);
  const row = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE name = ?")
    .get(table);
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
  expect(hasTable(copy!, "players")).toBe(false);
  expect(hasTable(path, "players")).toBe(true);
  const sqlite = new DatabaseSync(copy!);
  expect(sqlite.prepare("SELECT username FROM accounts").all()).toEqual([
    { username: "Kept" },
  ]);
  sqlite.close();
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
