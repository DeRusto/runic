# Coding Standards

How code is written in Runic. These standards describe what the codebase already does; where the code and this document disagree, fix whichever one is wrong in the same change. Reviews (human and `/code-review`) check changes against this file.

Before working in an area, read [`GLOSSARY.md`](../GLOSSARY.md) and the ADRs in [`docs/adr/`](adr/) that touch it. The spec for the current slice lives in [`docs/spec/`](spec/).

## The checks

CI runs these on every pull request, and a change is not done until all three pass locally:

```bash
npm run format:check
```

```bash
npm run typecheck
```

```bash
npm test
```

Prettier owns formatting, with its defaults and no config file. Run `npm run format` and never hand-format around it. TypeScript runs in `strict` mode from [`tsconfig.base.json`](../tsconfig.base.json); do not loosen it, and do not silence it with `any`, `@ts-ignore` or `@ts-expect-error`. A non-null assertion (`!`) is fine where the surrounding code has already established the value exists, as tests often do.

## Where code lives

The repo is three npm workspaces:

| Workspace | Holds                                                                                            | Imports from     |
| --------- | ------------------------------------------------------------------------------------------------ | ---------------- |
| `shared`  | Game data, rules and message types that both sides need: tables, formulas, refusals, intents     | nothing of ours  |
| `server`  | The authoritative simulation, the Colyseus room, accounts, saves and the database                | `@runic/shared`  |
| `client`  | Drawing with three.js, the HTML UI, and turning clicks into intents                              | `@runic/shared`  |

Rules for placing code:

- If both the client and the server need a number, a table or a rule, it goes in `shared`. The client never keeps its own copy of a game value, so the two cannot drift.
- `shared` has no runtime dependencies and touches neither the DOM nor Node APIs.
- The client never imports from `server`, and the server never imports from `client`.
- Everything `shared` exports goes through [`shared/src/index.ts`](../shared/src/index.ts). Other workspaces import from `"@runic/shared"`, never from a path inside it.
- One file per game concept (`foraging.ts`, `gear.ts`, `pathfinding.ts`), named in camelCase after that concept. A file grows until a second concept moves in; then split it.

## The server decides

The server is the single source of truth (see [ADR 0001](adr/0001-300ms-server-tick.md)). The client sends intents and draws what the state and events say happened.

- **Intents.** Each client-to-server message type is a constant in `shared` named `<VERB>_INTENT`, with a doc comment stating its payload. [`WorldRoom`](../server/src/WorldRoom.ts) maps each one to a `Simulation` method and does nothing else with it.
- **Every payload is untrusted.** The TypeScript type on a message handler is a claim, not a check. The receiving code validates the shape and range before use (`typeof item !== "string"`, `isInventorySlot(slot)`, `all === true`), and an invalid intent is dropped silently. Copy only the fields you need out of a payload (`{ x: to.x, y: to.y }`), never the object itself.
- **Refusals.** A rule that can refuse an action is one function in `shared` named `<thing>Refusal`, returning the player-facing sentence or `undefined`. The client calls it to show the message; the server calls the same function and ignores the click. Never write the check twice.
- **Ticks.** All game timing is in whole ticks of `TICK_MS`. Constants that count ticks end in `_TICKS`; constants in wall-clock time end in `_MS`. Simulation code never reads `Date.now()` or timers; it counts ticks.
- **Randomness is injected.** `Simulation` takes its random source as a constructor argument (`Math.random` in the room, a fixed roll in tests). Never call `Math.random()` inside game rules.
- **Events.** Things that happen during a tick, as opposed to state that persists, go out as `WorldEvent`s, one batch per tick after the patch. Add a variant to the `WorldEvent` union in `shared` rather than a new message type.

## Game data and constants

- Game values live in tables and named constants in `shared`, never as literals in logic. Name constants in `SCREAMING_SNAKE_CASE` with their unit in the name (`_TICKS`, `_MS`, `_PERCENT`, `PER_LEVEL`).
- Tables are `as const` objects keyed by kind (`BUSHES`, `VEINS`, `GEAR`, `RECIPES`), and their key type comes from the table: `type BushKind = keyof typeof BUSHES`. Add a kind by adding a row, not a branch.
- When several features differ only in data, describe the difference in one registry and write the logic once over it, as `GATHERING` does for foraging and mining. More gathering skills are coming, so weigh a shared helper against the next skill, not today's line count.
- Cite the spec section a value comes from in its comment (`Spec §5.`), so a later reader can check it.
- Health and damage are integers in hundredths of a Hitpoints level (`HEALTH_PER_HITPOINTS_LEVEL`). Keep game arithmetic in integers and round once, where the spec says.

## TypeScript

- ES modules everywhere. Relative imports include the `.ts` extension (`"./pathfinding.ts"`).
- Use `import type` / inline `type` for imports used only as types.
- Prefer `type` aliases over `interface`. Prefer string-literal unions over enums.
- Prefer plain functions and `const` arrow functions. Use a class only for something with lifetime and state (`Simulation`, `WorldRoom`, `Overhead`). Keep members `private` unless another module calls them.
- Prefer `Map` and `Set` for keyed collections that change at runtime, and objects for fixed tables.
- Use named exports only; no `export default`.
- Validate configuration and external input at the boundary: environment variables at startup, HTTP bodies with `zod`, Tiled maps when loaded (the loader refuses a map it cannot use faithfully instead of guessing).

## Naming

- Use the glossary's terms in code, tests, comments and UI text, and avoid the words it lists under _Avoid_. A new concept gets a glossary entry first.
- Name things for what they mean in the game (`picksLeft`, `respawnTile`, `queueEat`), not for their data structure.
- Functions that answer a question read as the answer (`levelFor`, `slotFor`, `costsOf`, `gatherRefusal`). Functions that change state start with a verb (`addPlayer`, `queueWalk`, `showFights`).
- Files and variables use camelCase; types and classes use PascalCase; constants use SCREAMING_SNAKE_CASE.

## Comments

Comments explain what the code cannot show: why it is this way, what it is protecting against, and where a number comes from.

- Put a one-line `/** doc comment */` on every exported constant, type and function whose meaning is not obvious from its name, stating the unit, the payload or the edge case (`"" for nothing`, `0 for an empty one`).
- Write comments as full sentences in plain English.
- When the obvious fix is wrong, say so where someone would make it (`Not setFixedTimestep(...): its 300 ms timer drifts`), and link the issue that proved it (`see #17`).
- A known limit taken on purpose gets a comment in the form `// shortcut: <the limit>, <when to upgrade>`. These are tracked as debt, so do not use any other form.
- Do not narrate the code, leave commented-out code, or leave `TODO`s; open an issue instead.

## Tests

Vitest runs every `*.test.ts` file in the repo. Tests sit beside the code they test (`gear.ts`, `gear.test.ts`).

- Every rule, formula, refusal and parser gets a test. Every bug fix gets a test that fails without the fix.
- Name each test as a sentence about game behaviour (`"clicking a bush walks next to it and attempts on the tick of arrival"`), so a failure reads as a broken rule.
- Simulation tests build a small region from a text grid with `parseRegion`, run whole ticks, and assert on state and events. Fix the random roll; never depend on chance.
- Keep helpers local to the test file (`player()`, `runTicks()`, `addAt()`), and give each a doc comment if its setup is not obvious.
- Server tests that start a real server pick a port from the process id so parallel workers do not collide, and clean up in `afterAll`. The database is in-memory per worker ([`vitest.config.ts`](../vitest.config.ts)).
- Client tests cover logic and DOM output (panels, the bottom bar, icons). Rendering is checked by running the game.

## The database

The schema is [`server/src/schema.ts`](../server/src/schema.ts), and migrations in `server/drizzle/` are generated from it:

```bash
npm run db:generate -w server
```

- Never edit a migration that has been merged; add a new one.
- Commit the generated migration with the schema change that caused it.
- Old saves must still load. A new column has a default, so rows saved before it need no conversion, or the migration fills it in.
- Store the same units the simulation uses. A change of unit (such as health in hundredths) migrates the stored values.

## The client

- The UI is HTML and CSS over the canvas; three.js draws the world only.
- The client reads synced state and events and does no prediction (ADR 0001), so it never moves a figure or changes a number before the server says so.
- Every asset in `client/public/` keeps its licence beside it, and any new pack is listed in [`client/public/LICENSE.txt`](../client/public/LICENSE.txt) in the same commit that adds it.
- Interactive UI works by keyboard and has accessible names; do not drop this to save code.

## Dependencies

Add a dependency only when the standard library, the browser, or a package already installed cannot do the job in a few lines. Put it in the workspace that uses it, not the root, which holds tooling only. Commit `package-lock.json` with it.

## Commits and pull requests

- Branch from `main` as `<phase>/<topic>` (`phase-2/gear-expansion`), and merge through a pull request.
- Write commit subjects as one imperative sentence about what the change does for the game or the code, with no prefix or trailing period: `Add the ten gear slots and smithed armour for head, body and legs`.
- One pull request does one thing. Its body links the issue it closes by title (`Closes [Total level: shown on the character sheet](...)`) and says in a few sentences what changed and why it was done this way.
- A change that contradicts an ADR says so in the pull request, and either updates the ADR or adds a new one that supersedes it.
- A change to a game rule updates the spec or glossary it touches in the same pull request.
