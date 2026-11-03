# Our own username login, not @colyseus/auth's email login

`@colyseus/auth` only accepts an email as the login, but friends log in with a username. So the server has its own two small endpoints, register and login, backed by our own `accounts` table, which holds a unique username and an scrypt password hash. Login issues the same JWT that `Room.onAuth` already verifies. We ruled out feeding the library made-up addresses like `<username>@runic.invalid`, because every stored login would then be fake data that has to be migrated away later. We also ruled out asking friends for real emails, which collects personal data for no benefit.

## Consequences

- Our register endpoint checks the invite code.
- Cutting a player off is a column on `accounts` that `onAuth` checks, because the library's `ban` and `bumpTokenVersion` work only on its own users table.
- No email is ever sent. A forgotten password is reset by hand by the admin.
- A public instance would build on this table: add an email column, verification and resets as needed. Nothing has to be migrated away from.
