import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { JWT } from "@colyseus/auth";
import { createEndpoint, createRouter } from "@colyseus/core";
import { eq, sql } from "drizzle-orm";
import type { SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import { db } from "./db.ts";
import { accounts } from "./schema.ts";

const USERNAME = /^[A-Za-z0-9_]{3,12}$/;
const MIN_PASSWORD = 8;
// scrypt runs on whatever arrives, so an unbounded password is a cheap way to burn CPU
const MAX_PASSWORD = 200;
export const PASSWORD_RULE = `Passwords are ${MIN_PASSWORD} to ${MAX_PASSWORD} characters`;
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  length: number,
) => Promise<Buffer>;

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

async function passwordMatches(password: string, stored: string) {
  const [, salt, hash] = stored.split(":");
  const expected = Buffer.from(hash!, "hex");
  return timingSafeEqual(
    await scryptAsync(password, Buffer.from(salt!, "hex"), expected.length),
    expected,
  );
}

function issueToken({
  id,
  username,
  tokenVersion,
}: typeof accounts.$inferSelect) {
  return JWT.sign({ id, username, tokenVersion }, { expiresIn: "30d" });
}

function findAccount(username: string) {
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.usernameLower, username.toLowerCase()))
    .get();
}

/** The account with this username in any case, without its password, or undefined. */
export function accountNamed(username: string) {
  const account = findAccount(username);
  return account && { id: account.id, username: account.username };
}

/** The account a token belongs to, or null if the token is bad or cancelled or the account is cut off. */
export async function accountForToken(token: string) {
  const payload = await JWT.verify<{ id: number; tokenVersion: number }>(
    token,
  ).catch(() => null);
  if (!payload) return null;
  const account = db
    .select()
    .from(accounts)
    .where(eq(accounts.id, payload.id))
    .get();
  if (!account || account.cutOff) return null;
  if (account.tokenVersion !== payload.tokenVersion) return null;
  return { id: account.id, username: account.username };
}

export function isValidPassword(password: string) {
  return password.length >= MIN_PASSWORD && password.length <= MAX_PASSWORD;
}

/** Also cancels every token issued so far. Returns false if there is no such account. */
export async function resetPassword(username: string, password: string) {
  const passwordHash = await hashPassword(password);
  return setAccount(username, {
    passwordHash,
    tokenVersion: sql`${accounts.tokenVersion} + 1`,
  });
}

/** Returns false if there is no such account. */
export function cutOff(username: string) {
  return setAccount(username, { cutOff: true });
}

function setAccount(
  username: string,
  fields: SQLiteUpdateSetSource<typeof accounts>,
) {
  const updated = db
    .update(accounts)
    .set(fields)
    .where(eq(accounts.usernameLower, username.toLowerCase()))
    .returning()
    .all();
  return updated.length > 0;
}

const register = createEndpoint(
  "/api/register",
  {
    method: "POST",
    body: z.object({
      username: z.string(),
      password: z.string(),
      inviteCode: z.string(),
    }),
  },
  async (ctx) => {
    const { username, password, inviteCode } = ctx.body;
    if (inviteCode !== process.env.INVITE_CODE) {
      throw ctx.error(403, { message: "Wrong invite code" });
    }
    if (!USERNAME.test(username)) {
      throw ctx.error(400, {
        message: "Usernames are 3 to 12 letters, digits or _",
      });
    }
    if (!isValidPassword(password)) {
      throw ctx.error(400, {
        message: PASSWORD_RULE,
      });
    }
    const [account] = db
      .insert(accounts)
      .values({
        username,
        usernameLower: username.toLowerCase(),
        passwordHash: await hashPassword(password),
      })
      .onConflictDoNothing()
      .returning()
      .all();
    if (!account) throw ctx.error(409, { message: "That username is taken" });
    return { token: await issueToken(account) };
  },
);

const login = createEndpoint(
  "/api/login",
  {
    method: "POST",
    body: z.object({
      username: z.string(),
      password: z.string().max(MAX_PASSWORD),
    }),
  },
  async (ctx) => {
    const account = findAccount(ctx.body.username);
    if (
      !account ||
      !(await passwordMatches(ctx.body.password, account.passwordHash))
    ) {
      throw ctx.error(401, { message: "Wrong username or password" });
    }
    if (account.cutOff)
      throw ctx.error(403, { message: "This account is cut off" });
    return { token: await issueToken(account) };
  },
);

export const accountRoutes = createRouter({ register, login });
