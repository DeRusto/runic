# What Phaser AE can do for a multiplayer client

Research for [#2](https://github.com/DeRusto/runic/issues/2), done 2026-11-03 against `@phaser-ae/cli` 0.7.5 and
engine release `v3-82bf126`.

**Short answer:** Phaser AE does not ship Phaser 4. It ships its own engine, a source-available kernel plus
expansion packs (kernel `3.0.0-2`, "Phaser AE v3"), with its own API and an import gate for game code. An AE game
folder therefore cannot *be* Runic's Phaser 4 client. AE is useful beside it: art, sound and the design document
come out as files and Markdown that a Phaser 4 client can load. Those tools spend phaser.io credits, and this
account has none.

Each claim is marked **[verified]** (read in a primary source or observed on this machine) or **[inferred]**
(reasoned from what was read, not tested).

## Sources

- `npx -y @phaser-ae/cli --help`, `credits`, `games`, `tools`, `packs search` (run on this machine).
- The npm package `@phaser-ae/cli@0.7.5` (`npm pack` into a scratch dir): `README.md`, `LICENSE`, `lib/*.mjs`.
- A probe game from `phaser-ae blank "runic-probe"` in a scratch folder outside the repo: its `CLAUDE.md`,
  `package.json`, `.gitignore`, `game/`, and the engine it downloaded (`phaser/README.md`, `phaser/LICENSE.md`,
  `phaser/engine/kernel/README.md`, `phaser/engine/bakery/src/check.ts`, `build-game.ts`).
- phaser.io: [pricing](https://phaser.io/pricing), [Terms of Use](https://www.phaser.io/community/terms-of-use),
  [Phaser Game Agent announcement](https://phaser.io/news/2026/06/phaser-game-agent), HTTP headers of phaser.io pages.

## 1. The engine: not Phaser 4

- **[verified]** The engine's `package.json` is `phaser-ae-engine`, with workspaces `engine/kernel`
  (`@phaser-ae/kernel` 3.0.0-2), `engine/bakery` and `engine/vendor/typography`. Neither it nor the probe game
  depends on the `phaser` npm package.
- **[verified]** The kernel README describes its own frame loop, roster, scenes, input, loader and contracts. It sets
  rules such as "Game code cannot reach the canvas or the GPU" and fixed-step time with no `Date.now()` or
  `setTimeout`. The generated `game/README.md` calls it "A Phaser AE v3 game".
- **[verified]** phaser.io's announcement says the agent "runs on Phaser AE: a framework rebuilt from scratch
  specifically for an AI audience", separate from the open-source framework.
- **[verified]** Licence: the engine and packs are under the PolyForm Shield License 1.0.0, with an added permission
  to "make games ... and to publish, distribute, sell and operate those games" (`phaser/LICENSE.md`). The CLI alone
  is MIT.

**Consequence [inferred]:** writing the Runic client in AE means using the AE API instead of Phaser 4's. Code,
tutorials and plugins for open-source Phaser would not carry over, and AE's packs (for example `tiles-2d`, `nav` A*,
`grid-move`) would stand in for Phaser 4 features. That conflicts with the map's stated stack.

## 2. Can an AE game talk to a self-hosted Colyseus server?

- **[verified]** The game gate (`bakery/src/check.ts`) flags, in the game's own `.ts` files: undocumented
  `@phaser-ae/*` imports, `any`, `Math.random`, `Date.now`/`performance.now`/`setTimeout`/`setInterval`/
  `requestAnimationFrame`, and `document.*`/`window.*` access (except `window.location` and detached canvases). It
  does **not** check imports outside the `@phaser-ae` scope, and it does not mention `WebSocket` or `fetch`.
- **[verified]** The bundle is esbuild, `bundle: true`, `format: 'esm'`, browser target (`build-game.ts`), so an npm
  import would be bundled.
- **[verified]** No multiplayer or networking pack turned up in `packs search "multiplayer networking websocket
  server"`. Nothing in the engine source mentions `WebSocket`, multiplayer or Colyseus.
- **[inferred]** `import { Client } from 'colyseus.js'` plus `new WebSocket(...)` in game code would probably pass
  the gate and bundle. It would still run against the engine's grain: network callbacks arrive outside the fixed
  step, and the gate's time rules forbid the timers a reconnect loop would normally use.
- **[not verified]** Whether a game *published on phaser.io* may open a websocket to another host. phaser.io pages
  send `content-security-policy: frame-ancestors 'self'` and `x-frame-options: SAMEORIGIN`, but there was no
  published AE game to inspect (the account has none, and publishing was out of scope). The play page's CSP,
  sandbox and `connect-src` remain unknown.
- **[verified]** Terms: the Terms of Use say nothing about multiplayer, external servers or network connections.
  The engine licence explicitly allows *operating* games. The only stated restriction is on building a competing
  game-making product. Nothing read forbids multiplayer. The earlier refusal by the phaser.io web agent looks like
  that agent's behaviour, not a written rule **[inferred]**.

## 3. Can the AE folder live in this monorepo as the client package?

- **[verified]** A game folder holds `CLAUDE.md`/`AGENTS.md`, `package.json` (every script runs
  `node phaser/...`), `.claude/`, `.phaser/build.json` (the link to the game on phaser.io), `design/`, `game/`
  and `phaser/`. Its `.gitignore` excludes `phaser/`, `node_modules/`, `dist/` and `.phaser/`.
- **[verified]** The engine is downloaded per folder into `phaser/` (with its own Playwright and Chromium for
  `play`/`smoke`), and `phaser-ae update` replaces it. The CLI says not to edit `phaser/` or the generated
  `game/engine.ts` and `game/assets.json`.
- **[inferred]** The folder is self-contained, with relative paths and its own package.json, so it could sit at, say,
  `client-ae/` beside `server/`. Running it as an npm/pnpm workspace member is untested, and so is importing a
  `shared/` package from outside `game/`. The bake, the gate's `walk(game)` and `tsc -p game` all assume the game
  lives under `game/`. A clone without `.phaser/` also loses its link to phaser.io, so `crew`/`publish` would need
  that file recreated (it is gitignored).

## 4. What the crew, tools and packs produce

- **[verified]** `phaser-ae tools` lists 23 tools on phaser.io: Sprite Factory (sprite sheets), Images, Anime,
  Textures (seamless), Layers, Poses (sprite sheets from poses), Logo, Title Screen, Game UI (a theme file), Vector
  Art, 3D Models, Shaders, Videos, Music, Sound effects, Synth (chiptune and effects "the engine plays as-is"), Mood
  Board, World, Characters, Controls, Physics, Promo, and Your files.
- **[verified]** `crew`/`tool` results come back as entries in `game/assets.json`. Each entry has a `kind` and a
  `url`, which is either a full `https://` address or a name under `baseURL`, which points at phaser.io storage. A
  sprite loads as `<file>-<size>.webp`. What each file is for lands in `design/assets.md`, and pictures are
  downloaded to `design/crew/` with a plain `fetch` (`lib/crew.mjs`). The files are therefore reachable over HTTP
  and could be downloaded and loaded by Phaser 4 **[inferred]**. Audio formats and the exact sprite-sheet layout
  were not seen, because no credits were spent.
- **[inferred]** Some outputs only work inside AE: the Title Screen (played by the `title-screen` pack), the Game
  UI theme, shaders, Synth tunes and Vector Art are formats or code that AE's engine runs. Plain images, sprite
  sheets, textures, music and sound effects should be engine-neutral.
- **[verified]** `phaser-ae gdd` writes the design document to `design/design.md` (Markdown). `idea` pushes an
  idea onto the design. The design tools (World, Characters, Mood Board) feed it. This is the design-document
  use the map wants, and it does not depend on the client engine.
- **[verified]** Packs are AE engine modules (TypeScript), downloaded into `game/node_modules/@phaser-ae`. They
  are useless to a Phaser 4 client. This basic account can add only the free ones.
- **[verified]** Terms §4.3: "Phaser does not claim ownership of Your Content." Terms §4.4: content posted to
  *public* areas may be used by other registered users. Nothing read addresses AI-generated asset rights
  specifically, so whether assets can be used outside phaser.io rests on §4.3 and is not stated outright.

## 5. Credits

- **[verified]** Balance before and after `blank`: **0 credits**. `blank`, `games`, `tools`, `packs search` and
  `credits` spent nothing.
- **[verified]** README: "The build runs on your agent's plan, not phaser.io credits." "The crew's work uses
  phaser.io credits." The game's `CLAUDE.md` adds that the crew's writing and files are paid from the balance, that
  the Chief asks "before spending credits", and that with none left `crew` and `tool` stop and point to top-up.
- **[verified]** Pricing: "Credits pay for what the tools make: art, music, sound, designs and builds in the Phaser
  sandbox". Every tool shows its price first, and credits last a year. Pro costs $20 a month with 8,000 credits a
  month, all packs, and uploads (`upload` is "Pro"). Packs sold by `credits`: 3,500 (+250) for $10 up to 44,000
  (+6,500) for $100.
- **Consequence:** using AE for art, sound or the design document needs credits bought first, or Pro.

## Side effects of the probe

`blank` created a game "runic-probe" on the user's phaser.io account (unpublished, in "Games started blank"). It
also started a background `phaser-ae room --stream` follower for the scratch folder and installed Chromium for
Playwright there. Nothing was published.

## Open questions

- The CSP and sandbox on a published AE game's play page (`connect-src`): settling it needs one trivial published
  test game that tries a `wss://` connection.
- The audio and sprite-sheet formats the crew delivers, and any licence terms attached to them: settling it needs a
  small credit spend.
