# Runic: first playable slice

**Status: reviewed.** Terms are defined in `GLOSSARY.md`. Decisions come from the closed tickets on the [map](https://github.com/DeRusto/runic/issues/1) and from `docs/adr/`. Where they disagree, the later one wins (§12 lists what was replaced). Rules no ticket decided are marked **[Qn]** (ruled on in review, §13) or **[Dn]** (a default accepted in review, §14).

All timers are whole **ticks** of 300 ms. All numbers are rough first values to tune in playtests.

## 1. What the slice is

Invited friends open `runicrpg.com`, log in with a username and password, and share one small **region**. They click to walk, pick food from **bushes**, fight **Spiders**, and chat. Levels and experience are the only progression. There is no scripted goal.

Done means a few friends can play together at once on the hosted server, and log out and back in with their progress intact (§10).

Out of scope: more than one server process; quests, trading, banking, economy; mobile or touch; making money; a public login system; player-versus-player combat; weapons and equipment; dropping or picking up items, or any death penalty; chat commands or filtering; anti-cheat beyond the server deciding all outcomes; recreating RuneScape Classic's content. The original world, names and art are ours; only the mechanics and feel are borrowed.

## 2. A session

1. A new friend gives a username, a password and the **invite code**, and appears on the **respawn tile** in the **village** with an empty **inventory**, level 1 in Combat, Defense and Foraging, level 10 in Hitpoints, and 10 **health**. A returning player appears on their saved tile with their saved health.
2. They walk to the **thicket** and click **berry bushes** for **food**. At Foraging 10, **herb bushes** open up.
3. They walk to the **field** and click a Spider. They trade blows until one dies, eating mid-fight if needed. Dying means a **respawn** in the village with everything kept.
4. They chat. Everyone in the region sees everyone move and sees every chat line.
5. They log out, unless a **combat lock** is running.

## 3. The region

- One region, exactly 64×64 tiles. Tile (x, y) sits at world (x, 0, y), and a tile is 1 world unit.
- It is stored as a **text grid** in a TypeScript string in `shared/`: 64 lines of 64 characters. Client and server import the grid, its parser and the kind table from there.

| Char | Tile | Blocks |
|---|---|---|
| `.` | grass | |
| `,` | thicket floor | |
| `=` | path | |
| `T` / `t` | tree on grass / on thicket floor | yes |
| `o` | rock on grass | yes |
| `"` | grass tuft on grass | |
| `b` / `h` | berry bush / herb bush on thicket floor | yes |
| `S` | Spider home on grass | |
| `R` | respawn tile on path | |

- A tile stores only its kind. Colour variation, model variant and rotation come from a hash of (x, y).
- The ground is flat. Each ground kind has a fixed visual offset, with paths slightly below grass.
- Players and Spiders never block, and can share a tile.
- The edge is a ring of blocking trees inside the grid. Beyond it is a dark background, with no camera clamp.
- The village, thicket and field are not stored. No code asks which one a tile is in.
- Layout rules: a village, a thicket and a field joined by paths, with any two points well under a minute's walk (a straight 64 tiles takes about 38 s). You judge it by walking around once the client runs.

**Region test (Vitest):** exactly 64×64; only known characters; one `R`, 12 `b`, 6 `h`, 8 `S`; the outer ring all blocks; every Spider home and a tile next to every bush is reachable from `R`. The counts live only in this test.

## 4. Simulation rules

### Tick and intents

- One fixed simulation step owns every timer. There are no separate clocks for game state.
- The client sends **intents only**: walk to a tile, act on a bush or Spider, eat the food in a slot, a chat line, log out. The server checks each one, ignores anything invalid, and decides every outcome.
- Intents queue and apply at the start of the next tick.
- Each player has one **action**: walking, foraging or fighting. A newer click replaces it. Eating and chat don't.
- A dead player's intents are ignored, except chat **[D8]**.

### Movement

- The server finds paths with BFS on the grid: 8 directions, no cutting past blocked corners, one tile every 2 ticks (diagonals cost the same).
- If the clicked tile can't be reached, the player walks to the nearest reachable one.
- **Next to** means one legal step away, with the same corner rule, or on the same tile **[D1]**.

### Fighting

- Clicking a Spider walks the player next to it and follows it if it moves.
- The player's first swing lands on the tick they arrive. After that, each side swings every 8 ticks.
- A Spider's first swing comes 4 ticks after the player's first, then every 8, so blows alternate.
- Swing timers belong to the player and the Spider, so clicking away and back can't beat 8 ticks **[D2]**.
- Eating adds 4 ticks to the player's next swing.
- Any swing at a Spider starts a fight, hit or miss. The fight's start tile is the Spider's tile at that moment **[D3]**.
- Several players can hit one Spider. Each gets Combat experience for their own damage. The Spider targets whoever swung at it most recently, and keeps its own swing rhythm when the target changes.
- **Leash:** when the target is more than 4 tiles from the fight's start tile, or dead, or gone, the Spider gives up **[D3]**. It walks home at a tile per 2 ticks and returns to full health on arrival. It can be attacked on the way, which starts a new fight **[D3]**.
- Fighting ends for a player when the target dies or they click something else. Nothing retargets by itself.
- A dead Spider disappears and returns 100 ticks later at its home with full health. It drops nothing.

### Wandering

An idle Spider has a 1-in-10 chance each tick to step to an adjacent walkable tile within 5 tiles of its home **[D4]**. Steps take 2 ticks, as all Spider moves do.

### Foraging

- Clicking a bush walks the player next to it. They then make one attempt every N ticks, starting on arrival **[D5]**. The pick timer belongs to the player, so an attempt within the last N ticks delays the first one at any bush, and re-clicking can't beat N ticks **[D17]**.
- Trying stops when a pick succeeds, the bush runs out, the inventory is full, or the player clicks something else. So **one successful pick ends the action: one click, one food**, as [Server simulation model](https://github.com/DeRusto/runic/issues/6) has it.
- A failed pick gives nothing and doesn't use up the bush. Only a success gives experience.
- Picks are shared between players. A partly picked bush doesn't regrow until it runs out.
- A click is ignored if the bush is run out, the Foraging level is too low, or the inventory is full. The client prints a local line in the chat box saying why, with no server message **[D6]**.

### Inventory and food

- 30 slots, one item per slot. A pick goes in the first empty slot.
- Clicking a slot eats that food: berries heal 2, herbs heal 5, up to max health. Eating at full health is allowed (it heals nothing and frees the slot), and that's the only way to free one.
- A player can eat at most once every 4 ticks **[Q4]**.

### Health and death

- Max health equals the Hitpoints level. A level-up raises the maximum, not current health **[D7]**.
- Regeneration is 5% of max health, rounded up, every 20 ticks while no combat lock runs **[Q2]**.
- At 0 health the action ends at once and the Spider gives up. The player stays dead on their tile for 5 ticks, then respawns on the respawn tile at full health.

### Combat lock

- Any swing by or at a live, connected player sets their lock to 34 ticks (about 10 s), hit or miss **[Q3]**.
- The lock clears at respawn, not at death, so a dead player can't log out **[Q3]**.
- While it runs, logging out is refused and regeneration pauses.

### Disconnects and duplicate logins

- A player dropped with no combat lock leaves at once.
- A player dropped with a lock stays in the world, idle (action ended) **[D9]**, and can still be hit. Their lock keeps counting down and is not refreshed, so they leave at most 34 ticks after the drop **[Q3]**. Reconnecting in that time takes the character back.
- If an account logs in while already online, the old connection is saved and kicked once any lock ends, and the new one takes over.

### Chat

- Chat goes out through `broadcast` straight away, not through synced state. It shows in the chat box and as yellow text over the speaker's head for 3 s.
- The server trims chat lines and drops any over 120 characters. The client renders them as text, never as HTML **[D8]**.

## 5. Numbers

**Skills.** Total experience for level L = `50·(L−1)²`, capped at level 99 (480,200 XP). Experience stops at the cap **[D7]**. Only experience is stored; level is derived from it. Hitpoints starts at 4,050 XP (level 10). Pacing target: about 1 h to level 10 and about 50 h to 99 per skill.

| Skill | Experience |
|---|---|
| Combat | 6 per damage dealt; overkill doesn't count |
| Hitpoints | 6 per damage dealt; overkill doesn't count |
| Defense | 6 per Spider swing at you, landed or missed, plus 4 per damage taken |
| Foraging | 10 per successful berry pick, 25 per herb pick |

**Fighting**

| | Player | Spider |
|---|---|---|
| Hit chance | 40% + 0.5% per Combat level above 1 | 35% − 0.2 points per Defense level above 1 |
| Damage on a hit | 1..(2 + floor(Combat / 20)) | 1..2 |
| Health | Hitpoints level | 8 |
| Swing | every 8 ticks | every 8 ticks, offset 4 |

**Foraging**

| | Berry bush | Herb bush |
|---|---|---|
| Foraging needed | 1 | 10 |
| Picks before running out | 5 | 3 |
| Regrows in full, after running out | 50 ticks | 100 ticks |
| Heals | 2 | 5 |

- Success chance: 50% + 2% per level above the bush's requirement, capped at 100%.
- Attempt interval by Foraging level: 8 ticks; 7 at 15; 6 at 30; 5 at 45; 4 at 60.

**Everything else:** 8 Spiders, 12 berry bushes, 6 herb bushes; walking 2 ticks per tile; leash 4 tiles; wander within 5 tiles of home; Spider respawn 100 ticks; player dead 5 ticks; combat lock 34 ticks; regeneration every 20 ticks; save every 100 ticks.

All of these live in `shared/` as named constants, apart from the counts (region test only).

## 6. Server

**Stack:** Colyseus 0.18 on Node 22, `@colyseus/schema` 5, run with `tsx` with no compile step.

**Room**
- One room holds the whole region, with no interest management.
- It's created at server start with `autoDispose = false`, so bushes and Spiders keep running while nobody's online **[D10]**. Clients use `join`, never `joinOrCreate`, so a second world can't appear **[D10]**.
- Our own 300 ms accumulator in `setTimestep`, checked every 20 ms rather than `setFixedTimestep(step, 1000/300)`, whose timer drifts and doubles a patch about every 9 s; `patchRate = null`, and one `broadcastPatch()` per tick (ADR 0001). A joining client gets the full state once.
- `onAuth` verifies the JWT and refuses accounts that are cut off.

**Each tick, in order** **[D11]**
1. Apply queued intents.
2. Advance player actions (moves, swings, picks).
3. Advance Spiders (chases, swings, wandering, going home).
4. Advance timers (lock, regeneration, regrowth, respawns, dead players).
5. Save if due.
6. `broadcastPatch()`, then send that tick's events.

**Synced state**
- Each player: username, tile, action, target, health, max health, experience, inventory, dead flag. Sent to everyone, because hiding it from invited friends isn't worth a `StateView` **[D11]**.
- Each Spider: tile, health, target, state (idle, fighting, going home, dead).
- Each bush: picks left (kind and tile come from the grid).
- Clients slide between tiles and don't predict, so a tile change is all the movement data needed.

**Events.** One-shot moments can't be derived cleanly from state, so the server sends one `events` broadcast per tick, right after the patch, when there's anything to report **[D11]**: swing started (who, at whom, hit or miss, damage), pick attempted (who, success), eaten (who, healed), died, respawned, Spider returned. The client times its animations and numbers from these (§7).

**Testability.** Game rules live in plain functions and classes with an injected random source, away from the Colyseus room, so Vitest can run ticks without a network **[D11]**.

**Accounts** (ADR 0002)
- Our own `POST /api/register` (username, password, invite code) and `POST /api/login` (username, password), which return a JWT lasting 30 days.
- Usernames: 3 to 12 of `A-Z a-z 0-9 _`, unique ignoring case. Passwords: at least 8 characters **[D12]**.
- The JWT secret and invite code are environment variables, never in the repo.
- No email is ever sent. A small admin script on the server resets a password or cuts an account off **[D12]**.

**Database:** SQLite through `@colyseus/database`, holding only our own Drizzle tables, with `drizzle-kit generate` migrations.

| Table | Columns |
|---|---|
| `accounts` | id, username (unique, stored with its original case), lowercase username (unique), scrypt password hash, cut-off flag, created at |
| `players` | account id (primary key), experience for each of the 4 skills, tile x, tile y, health, inventory (30 slots as JSON) |

**Saving**
- Written when a player leaves, every 100 ticks for everyone online, and for everyone at a clean shutdown. A crash loses at most 30 s.
- Saved: experience, inventory, tile, health. Not saved: action, fights, and all world state, so bushes and Spiders reset on restart.
- A dead player is saved as if already respawned, on the respawn tile at full health, so nobody can come back with 0 health **[D13]**.
- At login, a saved tile that now blocks or is off the grid becomes the respawn tile, and everything else is kept.

## 7. Client

**Stack:** three.js, bundled by Vite, with `@colyseus/sdk`. UI is HTML over the canvas (ADR 0003).

**Camera and look**
- Orthographic, looking down the (1,1,1) diagonal. It follows the player, never rotates, and the wheel zooms from 0.6× to 2.5×. About 12 tiles show top to bottom at default zoom.
- Low-poly and flat-shaded, with a hemisphere light plus a sun that casts shadows.
- Ground is one slab per tile, drawn with instancing along with the props.
- A player is about 1.15 units tall. A Spider is about 1.1 units wide.

**Clicks.** The ray tests live Spiders and bushes first, then falls through everything else to the ground plane to pick a tile (ADR 0003, amended). Trees, rocks and other players never catch a click. The marker on the clicked tile shows at once; everything else waits for the server, so an input takes up to one tick to show.

**Screens** **[D14]**
- Login and register form: username, password, plus the invite code when registering. The token is kept in `localStorage`, so returning friends skip the form until it expires.
- A plain "Loading…" until models are ready.
- In game, a full-width bottom bar: chat on the left, the 30 slots (10×3) in the middle, skill bars with level and progress on the right, plus a health readout and a logout button.
- Over each player: username, health bar when below full health **[D14]**, chat text. Over each Spider: health bar when below full health.

**Clips**

| Moment | Player | Spider |
|---|---|---|
| Standing | `Idle_A` | `Spider_Idle` |
| Moving | `Running_A` looped at 2× | `Spider_Walk` looped at 2.9× |
| Between swings | `Melee_Unarmed_Idle` | `Spider_Idle` |
| Swing | `Melee_Unarmed_Attack_Punch_A` once | `Spider_Attack` once |
| Being hit | `Hit_A`, unless a one-shot clip is playing | Red flash and small nudge away from the attacker |
| Foraging | `PickUp` once per attempt, sped up to fit (1.08× at 4 ticks) | |
| Eating | `Use_Item` at 1.33×; no clip while walking, only the heal number | |
| Dying | `Death_A`, held | `Spider_Death`, held, then sinks and disappears |
| Respawning | `Spawn_Ground` | Scales up at its home |

- Crossfade 0.12 s between clips. Clips have no root motion, so the tile slide (600 ms) moves the model. Models face the way they're moving, or their target in a fight **[D14]**.
- **Hits show at the clip's contact moment**, not on the tick: 0.55 s after a player's swing starts, 0.45 s after a Spider's. The server decides on the tick, and the client delays the number, flash and health bar. `PickUp` shows its result at 0.4 of the clip, and success looks the same as failure until then.
- Numbers: red for damage, blue "miss", green for eating. Regeneration shows no number **[D14]**.

**Reconnecting**
- The SDK's auto-reconnect handles a drop during a combat lock. If that fails, including after a deploy or a drop with no lock, the client rejoins with its stored token, or shows the login form if the token has expired **[D15]**.
- The client compares a build version on reconnect, and reloads the page if it differs.

**Assets** (all CC0, committed under `client/`)
- Characters: KayKit Adventurers on `Rig_Medium`. Each player gets Knight or Barbarian from a hash of their username **[Q5]**.
- Clips: `Rig_Medium_General`, `Rig_Medium_MovementBasic`, `Rig_Medium_CombatMelee` as they ship (about 2.5 MB), loaded once and shared across characters.
- Spider: Quaternius Easy Enemy Pack. Convert `Spider.fbx` to GLB once with `GLTFExporter`, forcing material opacity to 1, and commit the GLB. Update the skeleton before `Box3.setFromObject` when measuring it, or it scales to almost nothing.
- Props and bushes: KayKit Forest Nature free tier. Two bush models for berry and herb, each with its own tint so they read apart at a distance. A run-out bush is the same model shrunk and greyed in code.
- Copies of the character, clip, Spider and bush files are on the [`prototype/models-move-and-fight`](https://github.com/DeRusto/runic/tree/prototype/models-move-and-fight/client/prototype-models) branch, a useful reference for the clip code too.
- Sound: none in the slice **[Q1]**.

## 8. Repo and toolchain

- One repo on npm workspaces: `client/`, `server/`, `shared/`. Strict TS from a root `tsconfig.base.json`. `shared` has no build step; client and server import its source, and `tsc --noEmit` checks everything.
- `shared` holds intent and message types, constants, tile math (distance, 8-way neighbours), and the region grid, parser and kind table. Pathfinding stays on the server. Schema classes stay on the server, and the client imports them with `import type`.
- `npm run dev` starts both through `concurrently`. The server listens on 2567, and Vite proxies to it so the client always talks to its own origin. The proxy must cover the websocket path, Colyseus's matchmaking HTTP routes and `/api` **[D16]**.
- Checks: Vitest for `shared` and `server`, Prettier for formatting, no ESLint. Node 22 LTS, pinned with `engines` and `.nvmrc`.
- `ae/` at the root (not a workspace) is created only if Phaser AE gets used **[Q1]**.

## 9. Hosting

One Coolify app, one container, on the existing RackNerd VPS in Los Angeles (6 vCPU, 8 GB, Ubuntu 24.04), shared with the sites Coolify already hosts.

- **Domain:** `runicrpg.com`, bought by the admin and pointed at the server. Coolify's proxy handles Let's Encrypt, and `www` redirects to the bare domain. No nginx or PM2.
- **Serving:** one Node process serves the built client, the websocket and the `/api` endpoints on one origin.
- **Build:** a `Dockerfile` in the repo, built on the server. It runs `vite build` and starts the server with `node --import tsx` rather than `npm run` or the `tsx` wrapper, so the shutdown save gets the stop signal **[D16]**.
- **Deploys:** manual, by clicking Deploy, with a consistent container name so the old container stops first. Otherwise two game processes share one database and the old one's shutdown save can overwrite newer progress. Coolify's default grace period is 30 s. Players drop for a few seconds and reconnect, with no in-game warning.
- **Data:** the SQLite file lives on a persistent volume, with its path from an environment variable. Migrations run at server start; if any are pending, the database is first copied to a separate folder on the volume, keeping the last few copies.
- **Backups:** nightly, a clean live copy (`VACUUM INTO`, or `.backup`) goes to a backup folder on the volume, run as a Coolify scheduled task **[D16]**. Coolify's backup archives that folder to the admin's R2 setup for 14 days. A brief stop of the game is the fallback only if Coolify can't archive from that folder. One test restore before inviting friends.
- **Upkeep:** automatic security updates and key-only SSH across the server. Ports limited to 22, 80, 443 and what other services need. The game's port isn't published on the host and the Colyseus monitor isn't exposed. No monitoring or alerts.

## 10. Done means

Each build ticket has its own tests. The slice as a whole is done when, on `runicrpg.com`:

1. A friend registers with the invite code. A wrong code is refused.
2. Two friends in different places see each other walk and chat.
3. A click on an unreachable tile walks to the nearest reachable one. Clicking the top of a bush or a Spider's back targets it.
4. A player picks berries to 30 slots and is then refused. They eat to free a slot.
5. A player kills a Spider, seeing every clip, number and health bar in §7, and it returns 30 s later.
6. Walking away ends the fight at the leash, and the Spider walks home and recovers.
7. A player dies, holds for 1.5 s, respawns in the village with everything kept, and can't log out during a combat lock.
8. Herb bushes refuse a player below Foraging 10 and accept one at 10.
9. Experience, inventory, tile and health survive logout, a Deploy and a restored backup.
10. A Deploy reconnects everyone by itself, reloading their page.
11. You've walked the region and accepted the layout.

**Unit tests must cover:** the experience curve, hit and damage rolls, swing and eat timing, leash, combat lock, foraging success and intervals, BFS corner rule and nearest tile, bush regrowth, the region test, and the save rules.

## 11. Suggested build tickets

Each is a thin working slice that builds on those above it. They are now GitHub issues #17 to #34.

| # | Ticket | Delivers | Needs |
|---|---|---|---|
| 1 | Skeleton and tick | Workspaces, `npm run dev`, Colyseus room ticking once per 300 ms; proves fractional `tickRate` and one patch per tick | |
| 2 | Region data | Grid format, parser, kind table, region test, first draft layout | 1 |
| 3 | Walk on the server | Walk intent, BFS, player in state, simulation test harness | 2 |
| 4 | See the world | three.js scene, camera, instanced ground and props, click to walk, slide, placeholder model | 3 |
| 5 | Accounts | Register, login, JWT in `onAuth`, tables, migrations, login form, admin script | 1 |
| 6 | Saving | Save and load rules, shutdown save, join rule for bad tiles, duplicate logins, logout | 3, 5 |
| 7 | Characters and chat | KayKit models and locomotion clips, nameplates, chat box and overhead text, bottom bar | 4 |
| 8 | Foraging and food | Bushes, inventory, eating, Foraging experience, skill bars, clips | 7 |
| 9 | Spiders and combat | Convert the GLB, wandering, fights, leash, experience, numbers, health bars, contact timing | 7 |
| 10 | Death, lock and drops | Death hold, respawn, regeneration, combat lock, reconnect | 8, 9 |
| 11 | Deploy | Dockerfile, Coolify app, domain, volume, secrets, reconnect and version reload; checks in §15 | 6 |
| 12 | Backups | Nightly copy, R2 archive, test restore | 11 |
| 13 | Layout and first playtest | Final region, pacing check against targets, tune numbers | 10, 11 |

## 12. What later decisions replaced

| Earlier | Now | By |
|---|---|---|
| Thornback | Spider, same numbers | Map; [#4](https://github.com/DeRusto/runic/issues/4), [#11](https://github.com/DeRusto/runic/issues/11) |
| Phaser 4 client, AE art | three.js, KayKit and Quaternius models | ADR 0003; [#5](https://github.com/DeRusto/runic/issues/5) |
| Meshy models ([#13](https://github.com/DeRusto/runic/issues/13)) | KayKit | ADR 0003 |
| nginx, PM2, Certbot, systemd | Coolify's proxy; Node serves the client | [#15](https://github.com/DeRusto/runic/issues/15) |
| `@colyseus/auth` with `<username>@runic.invalid` | Own endpoints and `accounts` table | ADR 0002; [#7](https://github.com/DeRusto/runic/issues/7) amendment |
| Two skills, hitpoints from Combat | Four skills | [#11](https://github.com/DeRusto/runic/issues/11) |
| Spider swings on the same tick as the player | First swing 4 ticks later | [#12](https://github.com/DeRusto/runic/issues/12) |
| Respawn on the next tick | Dead for 5 ticks | [#12](https://github.com/DeRusto/runic/issues/12) |
| A click ray hits only the ground | Bushes and Spiders first | [#14](https://github.com/DeRusto/runic/issues/14) |
| Database file next to the server | Persistent volume | [#15](https://github.com/DeRusto/runic/issues/15) |
| "Its part of the field" | Within 5 tiles of home | [#14](https://github.com/DeRusto/runic/issues/14) |
| Regeneration of 1% of max health | 5% | Review (§13) |

## 13. Rulings from review

- **Q1. Sound.** The map says to use Phaser AE for sound, but no ticket asks for any sound in the slice. *Ruling: no sound, and no `ae/` folder until it's needed.*
- **Q2. Regeneration.** [#11](https://github.com/DeRusto/runic/issues/11)'s "1% of max health, rounded up" comes to 1 at every level up to 99, so the percentage did nothing and a level-99 player took about 10 minutes to refill. *Ruling: 5% of max health, rounded up, every 20 ticks, kept as a percentage because gear can eventually raise max health past 99.* That's 1 health at Hitpoints 10 to 20 and 5 at 99, so an empty bar refills in 1 to 2 minutes at any level.
- **Q3. Combat lock.** No ticket said what starts the lock, and [#12](https://github.com/DeRusto/runic/issues/12) left open when it clears during death. [#6](https://github.com/DeRusto/runic/issues/6) keeps a dropped character until the lock runs out, while [#11](https://github.com/DeRusto/runic/issues/11) caps that at 34 ticks; if the Spider's swings refreshed the lock, the cap would break and the character would stay until killed. *Ruling: any swing by or at a connected player sets it; it clears at respawn; a dropped player's lock doesn't refresh.*
- **Q4. Eating speed.** No limit was decided, so a fast clicker could eat many items per tick and out-heal any fight. The eat clip was fitted to 4 ticks. *Ruling: at most once per 4 ticks.*
- **Q5. Who looks like what.** No ticket said which character a player is. *Ruling: Knight or Barbarian (the two proven in the mock), from a hash of the username, with no choosing and nothing stored.*

## 14. Accepted defaults

These filled small gaps and were accepted in review.

| | Default | Why |
|---|---|---|
| D1 | "Next to" uses the walking corner rule, and sharing a tile counts | Same rule everywhere; stops hits through a corner |
| D2 | Swing timers persist between fights | Otherwise re-clicking gives a free instant swing |
| D3 | A miss starts a fight; start tile is the Spider's; distance is in 8-way tiles from there to the target; Spider recovers on arriving home and can be hit on the way; a dead or gone target ends its interest | The tickets say "walks home and resets", and "goes back to its leash behaviour" without defining it |
| D4 | A wander "step" is to an adjacent tile | "Random tile" in [#11](https://github.com/DeRusto/runic/issues/11) would otherwise be a teleport |
| D5 | First pick attempt is on arrival | Matches the first swing |
| D6 | Refused bush clicks get a local chat-box line | Silence reads as a bug; needs no server work |
| D7 | Level-ups don't heal; experience stops at the cap | Simplest reading |
| D8 | Chat still works while dead; 120-character limit, rendered as text | 1.5 s of lost chat is a surprise; the limit and escaping are the trust boundary |
| D9 | A dropped character stops its action | A player who's gone shouldn't keep fighting |
| D10 | Room created at start, never disposed, joined with `join` only | Colyseus's default disposes an empty room, which would reset the world |
| D11 | Tick order, per-tick events message, state visible to all, rules separate from the room | Needed to build it; no ticket said |
| D12 | Username and password rules; a small admin script | The email-based rule went away with ADR 0002; a scrypt hash can't be edited by hand |
| D13 | Dead players save as respawned | Otherwise a save during death could bring someone back with 0 health |
| D14 | Login form, logout button, health readout, nameplates, health bars only when hurt, facing, no number for regeneration | [#5](https://github.com/DeRusto/runic/issues/5)'s UI frame didn't cover them |
| D15 | Client rejoins when reconnecting fails | A restart invalidates every reconnect token, and [#15](https://github.com/DeRusto/runic/issues/15) promises players auto-reconnect |
| D16 | `node --import tsx`, wider dev proxy, Coolify scheduled task for the nightly copy | [#15](https://github.com/DeRusto/runic/issues/15) needs signals delivered and a job to run; `tsx`'s own forwarding is unchecked |
| D17 | Pick timers persist between actions, and win over D5 when an attempt is still due | Same as D2: otherwise re-clicking gives a free instant attempt |

## 15. Check while building

Nobody has tested these. Each sits with the ticket that hits it first.

| Unknown | Ticket | If it fails |
|---|---|---|
| A fractional `tickRate` (`1000/300`) behaves as expected | 1 | Run the 300 ms step from our own accumulator in `setTimestep` |
| 4,096 instanced slabs plus props perform | 4 | Merge the ground by kind |
| `@colyseus/database` works with only our own Drizzle tables | 5 | Use Drizzle directly on SQLite |
| Issuing the JWT without `@colyseus/auth`'s user store | 5 | Sign with a small JWT library using the same secret |
| What state a reconnecting client receives | 10 | Rejoin instead |
| Forest Nature free tier has two distinct bushes | 8 | Tint one |
| The dark Spider reads on grass | 9 | Lighten it or tint the field grass |
| Websockets work through Coolify's proxy | 11 | Coolify proxy config |
| Coolify stops the old container before starting the new one | 11 | Must be fixed before friends play: it risks lost progress |
| Coolify's backup can archive the folder and keep 14 days | 12 | Upload to R2 from the nightly job, or the brief-stop fallback |
| 50 players at once: patch sizes and many skinned models on screen | 13 | Unchecked by design; the slice's goal is a few friends |
| Quaternius licence: the zip has no licence file, so CC0 rests on ADR 0003 | 9 | Confirm on the pack's page before anything public |
| Login is open to the internet with no rate limit, since sign-up abuse protection is out of scope | 5 | Accepted for friends; scrypt makes guessing slow but makes floods costly |
