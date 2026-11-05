import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { GameDatabase } from "@colyseus/database";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";

const MIGRATIONS = fileURLToPath(new URL("../drizzle", import.meta.url));
const COPIES_KEPT = 5;

/** A failed copy throws, so nothing migrates without one. */
function copyIfMigrationsPending(path: string) {
  if (!existsSync(path)) return;
  const sqlite = new DatabaseSync(path);
  try {
    const tracked = sqlite
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE name = '__drizzle_migrations'",
      )
      .get();
    const applied = new Set(
      tracked
        ? sqlite
            .prepare("SELECT name FROM __drizzle_migrations")
            .all()
            .map((row) => row.name)
        : [],
    );
    const local = readMigrationFiles({ migrationsFolder: MIGRATIONS });
    if (local.every((migration) => applied.has(migration.name))) return;

    const folder = join(dirname(path), "pre-migration");
    mkdirSync(folder, { recursive: true });
    const stamp = new Date().toISOString().replaceAll(":", "-");
    // VACUUM INTO, not a file copy: a crash can leave recent writes in the -wal file.
    sqlite.prepare("VACUUM INTO ?").run(join(folder, `${stamp}.db`));
    for (const old of readdirSync(folder).sort().slice(0, -COPIES_KEPT)) {
      rmSync(join(folder, old));
    }
  } finally {
    sqlite.close();
  }
}

export const openDatabase = async () => {
  const path = process.env.DATABASE_PATH;
  if (!path) throw new Error("DATABASE_PATH must be set");
  copyIfMigrationsPending(path);
  const database = new GameDatabase({
    dialect: "sqlite",
    connectionString: path,
    migrations: { files: MIGRATIONS },
  });
  await database.boot();
  db = database.drizzle as unknown as NodeSQLiteDatabase;
  return database;
};

// One process, one database (spec section 1). Never pass it to the Server's `database`
// option: that mounts @colyseus/auth's /auth routes, which ADR 0002 rules out.
export let db: NodeSQLiteDatabase;
