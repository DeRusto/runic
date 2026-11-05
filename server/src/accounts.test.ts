import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "@colyseus/sdk";
import { JWT } from "@colyseus/auth";
import { WORLD_ROOM } from "@runic/shared";
import { afterAll, beforeAll, expect, test } from "vitest";
import { startServer } from "./server.ts";

const PORT = 20000 + (process.pid % 5000);
const INVITE = process.env.INVITE_CODE!;
const dir = mkdtempSync(join(tmpdir(), "runic-accounts-"));
const dbPath = join(dir, "test.db");
let server: Awaited<ReturnType<typeof startServer>>;

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  server = await startServer(PORT);
});
afterAll(async () => {
  await server.gracefullyShutdown(false);
  rmSync(dir, { recursive: true, force: true });
});

function post(path: string, body: unknown) {
  return fetch(`http://localhost:${PORT}/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const register = (
  username: string,
  password = "password1",
  inviteCode = INVITE,
) => post("register", { username, password, inviteCode });
const login = (username: string, password = "password1") =>
  post("login", { username, password });

test("register returns a JWT lasting 30 days", async () => {
  const res = await register("Alice");
  expect(res.status).toBe(200);
  const { token } = await res.json();
  const { exp, iat } = (await JWT.verify(token)) as {
    exp: number;
    iat: number;
  };
  expect(exp - iat).toBe(30 * 24 * 60 * 60);
});

test("login takes the username in any case and returns a JWT lasting 30 days", async () => {
  await register("Bob");
  const res = await login("bOB");
  expect(res.status).toBe(200);
  const { token } = await res.json();
  const { exp, iat, username } = (await JWT.verify(token)) as {
    exp: number;
    iat: number;
    username: string;
  };
  expect(exp - iat).toBe(30 * 24 * 60 * 60);
  expect(username).toBe("Bob");
});

test("a wrong password or unknown username is refused", async () => {
  await register("Carol");
  expect((await login("Carol", "wrongpassword")).status).toBe(401);
  expect((await login("Nobody")).status).toBe(401);
});

test("a wrong invite code is refused", async () => {
  expect((await register("Dave", "password1", "wrong")).status).toBe(403);
  expect((await login("Dave")).status).toBe(401);
});

test.each(["ab", "abcdefghijklm", "has space", "bad-char", "émile", ""])(
  "username %j is refused",
  async (username) => {
    expect((await register(username)).status).toBe(400);
  },
);

test.each(["abc", "abcdefghijkl", "A_b_9"])(
  "username %j is accepted",
  async (username) => {
    expect((await register(username)).status).toBe(200);
  },
);

test("usernames are unique ignoring case", async () => {
  expect((await register("Erin")).status).toBe(200);
  expect((await register("ERIN")).status).toBe(409);
});

test("passwords need at least 8 characters", async () => {
  expect((await register("Frank", "1234567")).status).toBe(400);
  expect((await register("Frank", "12345678")).status).toBe(200);
});

test("a body missing fields is refused", async () => {
  expect((await post("register", { username: "Gina" })).status).toBe(400);
  expect((await post("login", {})).status).toBe(400);
});

test("passwords are stored as salted scrypt hashes, in tables from our migration alone", async () => {
  await register("Hank", "samepassword");
  await register("Hal", "samepassword");
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((row) => row.name as string);
  const rows = db
    .prepare(
      "SELECT password_hash FROM accounts WHERE username IN ('Hank', 'Hal')",
    )
    .all()
    .map((row) => row.password_hash as string);
  db.close();

  expect(tables).toContain("accounts");
  expect(tables.filter((name) => name.startsWith("colyseus_"))).toEqual([]);
  expect(rows).toHaveLength(2);
  rows.forEach((hash) =>
    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/),
  );
  expect(rows[0]).not.toBe(rows[1]);
});

function join_(token?: string) {
  const client = new Client(`http://localhost:${PORT}`);
  if (token) client.auth.token = token;
  return client.join(WORLD_ROOM);
}

test("a valid token joins the room; none or garbage does not", async () => {
  const { token } = await (await register("Ivy")).json();
  const room = await join_(token);
  expect(room.roomId).toBeTruthy();
  await room.leave();

  await expect(join_()).rejects.toMatchObject({ code: 525 });
  await expect(join_("garbage")).rejects.toMatchObject({ code: 525 });
});

test("an expired token does not join", async () => {
  const { token } = await (await register("Jack")).json();
  const { id, username } = (await JWT.verify(token)) as {
    id: number;
    username: string;
  };
  const expired = await JWT.sign({ id, username }, { expiresIn: -1 });
  await expect(join_(expired)).rejects.toMatchObject({ code: 525 });
});
const admin = (...args: string[]) =>
  promisify(execFile)(process.execPath, [
    "--import",
    "tsx",
    fileURLToPath(new URL("./admin.ts", import.meta.url)),
    ...args,
  ]);

test("a cut-off account can't log in or join with a token it already holds", async () => {
  const { token } = await (await register("Kim")).json();
  await admin("cut-off", "KIM");
  expect((await login("Kim")).status).toBe(403);
  await expect(join_(token)).rejects.toMatchObject({ code: 525 });
});

test("the admin script resets a password", async () => {
  await register("Lee");
  await admin("reset-password", "Lee", "newpassword");
  expect((await login("Lee")).status).toBe(401);
  expect((await login("Lee", "newpassword")).status).toBe(200);
});

test("the admin script fails on an unknown account or a password outside the rule", async () => {
  await register("Mia");
  await expect(admin("cut-off", "Nobody")).rejects.toThrow("No account");
  await expect(admin("reset-password", "Mia", "short")).rejects.toThrow(
    "8 to 200 characters",
  );
  expect((await login("Mia")).status).toBe(200);
});
