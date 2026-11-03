# State of Phaser 4 and Colyseus today (2026-11-03)

Research for [#3](https://github.com/DeRusto/runic/issues/3). **Verified** means it was read from a primary source (npm registry, official docs, official GitHub repo) on 2026-11-03, with the link given. **Inference** marks our own conclusions for Runic.

## TL;DR

- **Phaser 4 is stable.** `phaser@4.2.1` is npm `latest` (4.0.0 shipped 2026-04-10). It has a new WebGL renderer, Canvas is deprecated, and `TilemapGPULayer` exists. Standard sprites, text and tilemaps should work without changes.
- **Colyseus is at 0.18.** `colyseus@0.18.10`, `@colyseus/core@0.18.25`, `@colyseus/schema@5.0.43`, client `@colyseus/sdk@0.18.9` (the old `colyseus.js` is stuck at 0.16). It needs Node >= 22.
- **Fixed tick:** `setTimestep()` (renamed from `setSimulationInterval()`) or the new `setFixedTimestep(step, tickRate)`. `patchRate` is separate and defaults to 50 ms.
- **Auth and persistence are first-party:** `@colyseus/auth` (email/password, anonymous, OAuth, JWT) and an optional `@colyseus/database`. Clients reconnect automatically via `onDrop`/`allowReconnection`/`onReconnect`.
- **Hosting:** one Node process needs no Redis. Put nginx in front with WebSocket upgrade headers. Use PM2 in `fork` mode, not `cluster`.

## Phaser 4

### Version and release status (verified)

- `npm view phaser dist-tags`: `latest: 4.2.1`, `beta: 4.0.0-rc.7`. Release dates from `npm view phaser time`: 4.0.0 on 2026-04-10, 4.1.0 on 2026-04-30, 4.2.0 on 2026-06-19, 4.2.1 on 2026-07-09. 4.0.0 followed a beta/RC series that ran from 2024-11 to 2026-03.
- Release notes: https://github.com/phaserjs/phaser/releases/tag/v4.0.0
- Migration guide: https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md

### Changes from Phaser 3 that matter for a tile game (verified, migration guide and release notes)

- **Renderer:** the WebGL renderer was rewritten. The v3 pipelines are replaced by "render nodes", and custom pipelines must be rewritten and registered via `RenderConfig#renderNodes`. Per the guide, standard Sprites, Text and Tilemaps should work without changes. **Canvas is deprecated.** FX and masks are merged into one Filter system, and `BitmapMask` is removed (use `filters.internal.addMask`). Lighting is enabled with `setLighting(true)` instead of the `Light2D` pipeline.
- **Tilemaps:** `TilemapLayer` still exists, and both it and the new `TilemapGPULayer` support lighting. `TilemapGPULayer` is created with the `gpu` flag on `Tilemap.createLayer()` and draws a whole layer as one quad. Its limits: WebGL only, one tileset with one texture, orthographic only, at most 4096x4096 tiles, and edits are not applied until you call `generateLayerDataTexture` ([API docs](https://docs.phaser.io/api-documentation/class/tilemaps-tilemapgpulayer)).
- **Pixel art:** `roundPixels` now defaults to `false` (it was `true` in v3). Per-object `vertexRoundMode` is `"safeAuto"` by default. Texture Y=0 is now at the bottom, which matters only for custom shaders and compressed textures.
- **Camera:** the meaning of `Camera#matrix` changed: it now includes scroll but not position. Ordinary use of `scrollX`, `scrollY` and `zoom` is unaffected.
- **Removed:** `Geom.Point` (geometry now returns `Vector2`), `Phaser.Struct.Set` and `Phaser.Struct.Map` (use native `Set`/`Map`), `Mesh`, `Plane`, `Camera3D`, `Math.PI2`, and `TextureManager.generate`. `setTintFill()` became `setTint().setTintMode(Phaser.TintModes.FILL)`.
- **Input:** the migration guide and release notes list no input changes. *Inference:* v3 pointer and keyboard code carries over.
- **TypeScript and bundler:** the package ships its own types (`types/phaser.d.ts`) and an `exports` map with ESM (`dist/phaser.esm.js`) and CJS builds (read from the [package.json](https://github.com/phaserjs/phaser/blob/master/package.json) on master). The official [template-vite-ts](https://github.com/phaserjs/template-vite-ts) pins `phaser: 4.0.0` with Vite ^6.3 and TypeScript ~5.7.

### Inference for Runic

- Classic orthographic tilemaps work in both layer types. `TilemapGPULayer` is a good fit for static ground layers. Keep layers that change often (for example, depleting resources) as a normal `TilemapLayer` or as sprites, because GPU layers need a regenerate call after each edit.
- Set `roundPixels: true` explicitly if we want the crisp v3 pixel-art look.
- Target WebGL only, because Canvas is deprecated.

## Colyseus

### Versions (verified, npm registry, 2026-11-03)

| Package | latest | Notes |
|---|---|---|
| `colyseus` | 0.18.10 (2026-10-22) | `engines.node: ">= 22.x"` |
| `@colyseus/core` | 0.18.25 | peers: `@colyseus/schema ^5.0.8`, `@colyseus/ws-transport 0.18.x`, `@colyseus/auth 0.18.x`, `express ^4 \|\| ^5`, `zod ^4` |
| `@colyseus/schema` | 5.0.43 | |
| `@colyseus/sdk` | 0.18.9 | the JS/TS client |
| `colyseus.js` | 0.16.22 | the old client package, no 0.17 or 0.18 release |
| `@colyseus/auth`, `@colyseus/ws-transport` | 0.18.4 | |
| `create-colyseus-app` | 0.18.1 | scaffolder |

0.17.0 shipped 2026-01-09, and the first 0.18 SDK shipped 2026-05-22. Migration guide: https://docs.colyseus.io/migrating/0.18

### Room lifecycle (verified, https://docs.colyseus.io/room)

- The hooks are `onCreate`, `onAuth`, `onJoin`, `onDrop`, `onReconnect`, `onLeave` and `onDispose`. The return value of `onAuth` becomes `client.auth`. Message handlers are declared as a `messages = { type: (client, payload) => ... }` class field. 0.18 adds request/response: the client calls `await room.request(...)`, and the handler returns a value or calls `ctx.reject` ([migration](https://docs.colyseus.io/migrating/0.18)).
- `maxClients` defaults to `Infinity`, and a full room is locked. `autoDispose` defaults to `true`, so the room is disposed when the last client leaves.
- 0.18 removed `client.id`; use `sessionId` instead. Calls to `setMetadata` now replace the metadata instead of merging it.

### State sync with @colyseus/schema 5 (verified, https://docs.colyseus.io/state)

- Define state with `schema({...}, "Name")` plus `t.*` builders, or with `@type()` decorators. Decorators need two tsconfig flags. Collections are `MapSchema` and `ArraySchema`. Multi-dimensional arrays are unsupported.
- **A Schema can have at most 63 fields, inherited fields included.** A 64th field throws when the class is defined. Field order must match between server and client.
- The server sends delta patches with only the changed properties, every `patchRate`. The default is 50 ms (20/s), and `patchRate = null` switches to manual `broadcastPatch()`. Each client can see its own subset of the state through a StateView.
- On the client, `Callbacks.get(room)` provides `onAdd`, `onRemove`, `onChange` and `listen(instance, "prop", cb)`. Clients only `room.send()`; the server is authoritative.

### Fixed tick (verified)

- `setTimestep(cb, delay?)` runs a variable step: the callback gets the measured `deltaTime`, and the default interval is 16.6 ms. `setSimulationInterval()` is a deprecated alias for it. `setFixedTimestep(step, tickRate)` advances by a constant `dt` and tells predicting clients the rate ([room docs](https://docs.colyseus.io/room), [migration](https://docs.colyseus.io/migrating/0.18)). 0.18 also adds netcode primitives: `defineInput`, `Predict`, `room.clock` and `allowRewindState`.
- The official tutorial's Part 4 uses an accumulator with an input queue. Each player has an `inputQueue`, the message handler pushes onto it, and `setSimulationInterval` accumulates `deltaTime` and calls `fixedTick()` while `elapsed >= fixedTimeStep`, draining the queue ([Part4Room.ts](https://github.com/colyseus/tutorial-phaser/blob/master/server/src/rooms/Part4Room.ts)).
- *Inference for Runic:* a 600 ms RSC-style tick maps directly onto `setFixedTimestep(600, ...)` or the accumulator pattern. Clicks are queued and processed once per tick. We could set `patchRate` to the tick (or `null` with a `broadcastPatch()` at the end of each tick) so that clients get exactly one patch per tick. We have not tested this; it is the job of the netcode/tick ticket.

### Client SDK and Phaser integration (verified)

- The client package is `@colyseus/sdk`. Create it with `new Client<typeof server>(URL)`, which gives typed rooms when the server's `app.config` type is imported.
- The official Phaser tutorial is in the docs at https://docs.colyseus.io/learn/tutorial/phaser, with source at https://github.com/colyseus/tutorial-phaser. Its four parts are basic movement, linear interpolation, client-predicted input and fixed tickrate. **The repo still pins `phaser ^3.55.2` and `@colyseus/sdk ^0.17.0` / `colyseus ^0.17.0`** (repo last pushed 2026-01-27). It uses Vite and TypeScript, and connects from within a `Phaser.Scene` (`client.joinOrCreate`, then `Callbacks.get(room).onAdd(...)` to create sprites).
- *Inference:* no official Phaser 4 + Colyseus 0.18 template exists. The integration has no Phaser-specific glue, because the SDK is framework-agnostic, so the tutorial patterns should carry over. Combine `phaserjs/template-vite-ts` with `create-colyseus-app` 0.18.

### Auth and persistence (verified, https://docs.colyseus.io/auth)

- `@colyseus/auth` provides email/password, anonymous login, OAuth ("200+ providers", for example Discord and Google), password reset by email, and JWTs that the room's `onAuth` verifies. HTTP routes are protected with `auth.middleware()`. The client gets typed auth methods. You can implement the backend callbacks against your own database.
- New in 0.18: `@colyseus/database` is an optional user store that you add as a `GameDatabase` to `defineServer`. It handles route mounting and bans, and revokes tokens through `tokenVersion`/`bumpTokenVersion()`. 0.18 also changed the password hasher (per-password salt), so 0.17 users have to reset their passwords. That does not affect a new project.
- *Inference:* there is no built-in hook for game-state persistence such as player inventories. We would save from `onLeave`/`onDispose` or on a timer ourselves. Whether `@colyseus/database` can also hold game data was not checked; that belongs to the persistence ticket.

### Reconnection (verified, https://docs.colyseus.io/room/reconnection)

- On the server, `onDrop(client, code)` fires on an unexpected disconnect. Calling `allowReconnection(client, seconds | "manual")` there holds the client's seat. `onReconnect(client)` fires when the client returns, keeping its `sessionId`, `auth`, `userData` and view. `onLeave` fires on a permanent departure.
- On the client, the SDK reconnects automatically with exponential backoff on the same `Room` instance (since 0.17), so listeners stay attached. If that fails, `onLeave` gets code 4003. After a page reload, call `client.reconnect(room.reconnectionToken)`. The token changes on every connection, so save it again each time.

### Hosting (verified, https://docs.colyseus.io/deployment)

- Use Node >= 22 (npm `engines`, and the Docker example uses `node:22`). Compile with `tsc` and run with `node` and `NODE_ENV=production`, not `tsx`.
- A **single process needs no extra infrastructure.** A shared presence/driver is only needed with multiple processes.
- WebSockets go through nginx with `proxy_http_version 1.1`, the `Upgrade`/`Connection` headers, and long read/send timeouts (86400s). Sticky sessions are not required. Terminate TLS at the proxy, and the SDK then uses `wss://`.
- With PM2, use `exec_mode: 'fork'`, **not** `cluster`. Graceful shutdown on SIGTERM/SIGINT is built in.
- A Bun WebSocket transport exists (docs page linked). We did not evaluate it.

## Not checked

- Phaser 4.1 and 4.2 changelogs (only the 4.0 notes were read).
- The exact semantics of `setFixedTimestep` in 0.18 (for example, the meaning of `tickRate`), and whether the tutorial runs unchanged on 0.18. https://docs.colyseus.io/room has the details.
- Real behavior and performance of either stack. Nothing was built or run.
