# Art for Square Bottom-Bar Buttons

Research for [#172](https://github.com/DeRusto/runic/issues/172), under the map [#170](https://github.com/DeRusto/runic/issues/170). The question: which button frames and icons on disk can turn the bottom bar's text buttons into square buttons, each a frame with an icon, and may that art go in this public repository?

**Every proposed file is a Kenney file under CC0 1.0, so any of it can be committed.** The frame needs no new art: `client/public/ui/button_brown.png` is already in the repository. The icons come from two more Kenney packs, Game Icons and Board Game Icons, and each of those needs its licence file copied beside it and a line in `client/public/LICENSE.txt`.

Paths under `Game Assets/` below are relative to `C:\Users\derus\Game Assets\kenney-game-assets\`.

## The Buttons Today

The bottom bar's buttons sit in `#bar-buttons` in `client/index.html`. There are five:

| Button | Element | Label today | Hotkey | Where the hotkey lives |
| --- | --- | --- | --- | --- |
| Turn view left | `#turn-left` | ⟲ | Q | `quartersForKey` in `client/src/cameraTurn.ts` |
| Turn view right | `#turn-right` | ⟳ | E | `quartersForKey` in `client/src/cameraTurn.ts` |
| Character sheet | `#character` | Character | C | `client/src/characterSheet.ts` |
| Social panel | `#social-button` | Social | O | `client/src/socialPanel.ts` |
| Log out | `#logout` | Log out | none | |

The two turn buttons already show a symbol, and a `<kbd>` hint row under them names Q and E. Character and Social carry `aria-pressed`, so each also has an "open" state. `client/src/bottomBar.ts` builds the inventory slots, chat and skill bars but none of these five buttons.

## Proposed Icons

| Button | Icon file | Pack | Size |
| --- | --- | --- | --- |
| Turn view left | `Game Assets/Icons/Board Game Icons/PNG/Double (128px)/arrow_counterclockwise.png` | Board Game Icons 1.1 | 128 px |
| Turn view right | `Game Assets/Icons/Board Game Icons/PNG/Double (128px)/arrow_clockwise.png` | Board Game Icons 1.1 | 128 px |
| Character sheet | `Game Assets/Icons/Game Icons/PNG/Black/2x/singleplayer.png` | Game Icons 1.0 | 100 px |
| Social panel | `Game Assets/Icons/Game Icons/PNG/Black/2x/multiplayer.png` | Game Icons 1.0 | 100 px |
| Log out | `Game Assets/Icons/Game Icons/PNG/Black/2x/exitRight.png` | Game Icons 1.0 | 100 px |

Game Icons covers Character (one figure), Social (two figures) and Log out (an arrow leaving a door frame), but it has no pair of rotate arrows; its `return.png` turns one way only. Board Game Icons supplies the mirrored pair. Both packs draw flat, single-colour glyphs, so they sit together well.

Board Game Icons ships white glyphs only, while Game Icons ships black and white. On the tan face of `button_brown.png`, white would be faint, so the simplest way to give all five one colour is a CSS mask: set the icon as `mask-image` on a box whose `background-color` is the bar's brown text colour (`#4a3018`). The glyph colour then comes from CSS and the pack colour no longer matters.

Fallbacks, should a glyph read poorly at bar size: `Board Game Icons/.../character.png` and `pawns.png` for Character and Social, and `Game Icons/PNG/Black/2x/power.png` or `door.png` for Log out. Both packs also hold SVG versions (`Board Game Icons/Vector/Icons/*.svg`, and one combined sheet per colour in `Game Icons/Vector/`), but the PNGs are large enough for a button under 64 px.

## Proposed Frame

The art in `client/public/ui/` is from Kenney's **UI Pack - Adventure 1.1** (`button_brown.png`, `button_brown_close.png`, `button_grey.png`, `panel_brown.png`, all byte-identical to that pack's `PNG/Default/` files). That pack has no square button and no hover or pressed images. It does have 9-patch art (a nine-slice image whose corners stay fixed while the edges and centre stretch), and the repository already uses `button_brown.png` that way for the smithing panel's recipe buttons (`#smithing-rows button` in `client/index.html`).

| State | Proposal | Source |
| --- | --- | --- |
| Normal | `button_brown.png` as `border-image` with slice 8, sized square | already in `client/public/ui/` |
| Hover | the same image with `filter: brightness(1.12)` | the smithing buttons' rule |
| Pressed (`:active`) | `transform: translateY(1px)` | the smithing buttons' rule |
| Disabled | `button_grey.png` | already in `client/public/ui/` |
| Open panel (`aria-pressed="true"`) | optional: `panel_brown_dark.png`, a 64 px all-brown 9-patch | `Game Assets/UI assets/UI Pack - Adventure/PNG/Default/` |

This keeps the bar in the same style as every panel, and the bar's buttons behave like the smithing buttons. `button_brown.png` is 48 by 24 px; with the 8 px slice its corners and edges keep their size on a square box.

**An alternative with real pressed art exists in an older pack.** Kenney's **UI Adventure Pack 1.0** (`Game Assets/UI assets/UI Adventure Pack/PNG/`) has `buttonSquare_brown.png` (45 by 49 px; the extra 4 px is its raised bottom edge) and `buttonSquare_brown_pressed.png` (45 by 45 px), plus beige, grey and blue versions. Its wood-grain style differs from the flat UI Pack - Adventure look of the current panels, so it would set the bar apart from them. It has no hover image either.

## Licences

Each line below quotes the pack's own `License.txt`.

| Pack | Licence file | Licence |
| --- | --- | --- |
| UI Pack - Adventure 1.1 | `Game Assets/UI assets/UI Pack - Adventure/License.txt` (copy in the repository: `client/public/ui/LICENSE-Kenney-UI-Pack-Adventure.txt`) | CC0 1.0 |
| Game Icons 1.0 | `Game Assets/Icons/Game Icons/License.txt` | CC0 1.0 |
| Board Game Icons 1.1 | `Game Assets/Icons/Board Game Icons/License.txt` | CC0 1.0 |
| UI Adventure Pack 1.0 (alternative only) | `Game Assets/UI assets/UI Adventure Pack/License.txt` | CC0 1.0 |

Every file reads "License: (Creative Commons Zero, CC0)" and links to `http://creativecommons.org/publicdomain/zero/1.0/`. Crediting Kenney is optional.

To commit the icons, follow the convention `client/public/LICENSE.txt` already sets for the `ui/` folder: copy each new pack's `License.txt` into `client/public/ui/` as `LICENSE-Kenney-Game-Icons.txt` and `LICENSE-Kenney-Board-Game-Icons.txt`, put the icon PNGs in `client/public/ui/` (the `icons/` folder holds item icons only), and list both licence files under `ui/` in `client/public/LICENSE.txt`. No new art is needed for the frame unless the optional open-panel state is adopted, which adds `panel_brown_dark.png` from the pack already licensed there.

## Not Checked

These icons have not been tried at bar size in the running game, so the fallbacks above may be needed. Whether Log out gets a hotkey stays open on the map.
