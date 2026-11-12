# Maps

`region.tmj` is the world's one region, in [Tiled](https://www.mapeditor.org)'s JSON format. `region.tsj` is its tileset, and `region.png` is flat stand-in colour: Tiled shows a plain top-down grid, and the game draws the real look.

Open `region.tmj` in Tiled to paint it, or edit it through the `tiled` MCP server. The game loads it with `loadRegion` (`shared/src/regionMap.ts`), which refuses anything it can't use, so a bad map fails at startup.

## Layers

| Layer        | Type    | Holds                                                | Rule                        |
| ------------ | ------- | ---------------------------------------------------- | --------------------------- |
| `ground`     | Tiles   | grass, thicket, path, ashen                          | Every cell is filled        |
| `features`   | Tiles   | props, trees, stations, house walls and doors        | At most one per tile        |
| `placements` | Objects | the respawn, enemy homes, NPCs, site pools and spots | One per tile, snapped to it |

If it's just what stands on a tile, it's a tile in `features`. If it has a name, its own settings, or something refers to it, it's an object in `placements`.

A pooled site has no tile in `features`: its spot is plain ground, and the server puts a site on `active` of a pool's spots at random. When one runs out it disappears, and after its regrow time a full one comes back at a free spot of the same pool. The loader refuses a spot outside every pool and a pool with fewer spots than `active`.

Trees are fixed sites: a Birch, Oak or Charwood tile in `features` always stands there, shows a stump while it's run out, and grows back in place. A `tree` prop is scenery and can't be chopped.

Whether a tile blocks walking comes from the `blocks` property on its tile in the tileset, so there's no collision layer to keep in step. Don't flip or rotate tiles: a tile's rotation comes from `tileHash`.

An object's class is one of these:

| Class       | Needs                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `respawn`   | Nothing. There's exactly one                                                                                                     |
| `enemyHome` | An `enemy` string property: `spider`, `skeleton`                                                                                 |
| `npc`       | Its name: a villager id, `odo`, `marta`, `aldous`, `bram`                                                                        |
| `sitePool`  | A rectangle with `site` (`vein`, `bush`), `kind` and `active` (an int)                                                           |
| `siteSpot`  | A point inside a `sitePool`, on a tile that doesn't block. Where pools overlap, its name is the `kind` of the pool it belongs to |

## Before committing

Run this from inside `maps/`, or Tiled rewrites the tileset's image path against the folder you're in. The server writes tile data as one long line; this puts it back to one row per line, so a small edit stays a small diff.

```bash
tiled --export-map json region.tmj region.n.tmj && mv region.n.tmj region.tmj
```
