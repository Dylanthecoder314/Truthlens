# The Vanishing of MH370

An interactive web documentary about Malaysia Airlines flight MH370, which disappeared on 8 March 2014 with 239 people on board.

Published (private until shared): https://claude.ai/artifact/DttCnhCaXVWPPrdN9z3ABu

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The documentary page. Self-contained: styles, script and map geometry are inline. |
| `RESEARCH.md` | Fact sheet behind every claim on the page, with sources and a list of what is approximate. |
| `CHAT_LOG.md` | Record of the conversation that produced this work. |
| `tools/build-maps.mjs` | Projects Natural Earth coastlines for the two maps and writes them into the `MAPDATA` block of `index.html`. |

## Chapters

Prologue (239 on board) · 1 Departure · 2 "Good night" · 3 A ghost on military radar · 4 Seven handshakes · 5 The search · 6 What the sea gave back · 7 The official answer · 8 Claims and evidence · 9 Still searching · Sources

Interactive parts:

- **Fig. 1, The last radar track.** A time slider and play button move the aircraft from takeoff (00:42 MYT) to the last military radar contact (02:22 MYT). Transponder, radar, radio and ACARS states update as you scrub.
- **Fig. 2, The 7th arc.** The seven Inmarsat handshake rings, the 2014–17 and 2018 search areas and the debris finds. Each layer can be toggled, and selecting a handshake highlights its ring.

## Rebuilding the maps

Only needed if you change a map's extent in `tools/build-maps.mjs`:

```sh
cd documentary/tools
npm install
npm run build
```

## Updating the page

Edit `index.html`, then republish it to the same artifact URL. The status box in chapter 9 and the "Updated" date in the header are as of 7 October 2026.
