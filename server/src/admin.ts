import { cutOff, isValidPassword, resetPassword } from "./accounts.ts";
import { openDatabase } from "./db.ts";

const USAGE =
  "usage: admin reset-password <username> <new password> | admin cut-off <username>";

const [command, username, password] = process.argv.slice(2);
const database = await openDatabase();
let found: boolean;
if (command === "reset-password" && username && password) {
  if (!isValidPassword(password))
    throw new Error("Passwords need at least 8 characters");
  found = await resetPassword(username, password);
} else if (command === "cut-off" && username) {
  found = cutOff(username);
} else {
  throw new Error(USAGE);
}
await database.shutdown();
if (!found) throw new Error(`No account named ${username}`);
console.log(`${command}: done for ${username}`);
