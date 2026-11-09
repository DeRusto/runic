# Runic

A multiplayer online RPG for a small group of friends: a shared, persistent world on a tile grid, where players train skills. It runs in the browser, drawn in low-poly 3D through an isometric camera.

Players forage and mine, smelt bars and smith gear, then fight Spiders and Skeletons for the materials that unlock the next tier. Progress is saved on the server, and accounts need an invite code.

## Stack

- **Client:** [three.js](https://threejs.org/) and [Vite](https://vite.dev/), with the UI as HTML over the canvas
- **Server:** [Colyseus](https://colyseus.io/) on Express with a 300 ms tick, saving to SQLite through [Drizzle](https://orm.drizzle.team/)
- **Language:** TypeScript throughout, in npm workspaces: `client`, `server` and `shared`

## Getting started

You need Node 22.13 or later.

```bash
npm ci
```

```bash
cp server/.env.example server/.env
```

```bash
npm run dev
```

Open <http://localhost:5173> and sign up with the invite code from `server/.env`, which is `local-dev-invite` by default.

## Commands

| Command                                                               | What it does                                   |
| --------------------------------------------------------------------- | ---------------------------------------------- |
| `npm run dev`                                                         | Runs the server and the client, with reloading |
| `npm test`                                                            | Runs the tests with Vitest                     |
| `npm run typecheck`                                                   | Checks the types                               |
| `npm run format`                                                      | Formats the code with Prettier                 |
| `npm run admin -w server -- reset-password <username> <new password>` | Sets a player's password                       |
| `npm run admin -w server -- cut-off <username>`                       | Cuts a player off from the game                |

## Running it with Docker

The image builds the client and serves it from the game server on port 2567. Saves go in `/data`, so keep that on a volume.

```bash
docker build -t runic .
```

```bash
docker run -p 2567:2567 -v runic-data:/data -e JWT_SECRET=<a long random secret> -e INVITE_CODE=<your invite code> runic
```

## Documentation

- [`GLOSSARY.md`](GLOSSARY.md): what the game's terms mean
- [`docs/adr/`](docs/adr/): the decisions behind the architecture
- [`docs/spec/`](docs/spec/): the spec for each slice of the game
- [`docs/coding-standards.md`](docs/coding-standards.md): how the code is written

Work is tracked in [GitHub Issues](https://github.com/DeRusto/runic/issues).

## License

The code is under the [MIT License](LICENSE).

**The art is not.** Everything in `client/public/` stays under its own terms, and most of it is CC0, but not all of it. See [`client/public/LICENSE.txt`](client/public/LICENSE.txt) before reusing any of it.
