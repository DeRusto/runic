import { fileURLToPath } from "node:url";
import { GameDatabase } from "@colyseus/database";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";

const MIGRATIONS = fileURLToPath(new URL("../drizzle", import.meta.url));

export const openDatabase = async () => {
  const path = process.env.DATABASE_PATH;
  if (!path) throw new Error("DATABASE_PATH must be set");
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
