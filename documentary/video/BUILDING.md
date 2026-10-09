# Building scenes for the MH370 film

The film is 13 scenes (`scenes/s01.html` … `scenes/s13.html`), rendered frame by frame at 1920×1080, 30 fps, by `tools/render.mjs`, then joined with the narration by `tools/assemble.sh`.

`scenes/s01.html` is the reference scene. Read it first and match its look.

## The scene contract

```html
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>sNN · Title</title>
<link rel="stylesheet" href="style.css"><style>/* scene-only CSS */</style></head>
<body data-scene="sNN">
<div id="stage"></div>
<script src="mapdata.js"></script><script src="timing.js"></script><script src="lib.js"></script>
<script>
S.scene({
  fadeIn: 0.6, fadeOut: 0.6,      // dip from/to black at the scene edges (seconds)
  setup: function () { /* build DOM/SVG once */ },
  draw: function (t) { /* set every animated property from t (seconds) */ },
});
</script></body></html>
```

**`draw(t)` must be a pure function of `t`.** The renderer seeks to arbitrary frames. No CSS transitions or animations, no `setTimeout` or `requestAnimationFrame`, no `Math.random()` (use a seeded function of the index), and no state carried between calls. To hide something, set its opacity from `t`; `S.show(node, opacity, transform)` does this and also sets visibility.

**Time everything from narration cues, not absolute seconds.** `S.cue("s04b")` is when that segment's narration starts and `S.cueEnd("s04b")` is when it ends. Durations change when the script is re-recorded, so never hard-code scene times. `S.duration` is the scene length.

## lib.js reference (global `S`)

- **Timing:** `cue(id)`, `cueEnd(id)`, `seg(id)` → `{start, end, sub}`, `duration`.
- **Easing:** `prog(t, a, b)` gives 0..1 between times a and b. Also `ease(p)` (in-out cubic), `easeOut(p)`, `easeIn(p)`, `lerp(a, b, p)`, `clamp(x, a, b)`. `fadeWin(t, a, b, d)` fades in at `a`, out ending at `b`, over `d` seconds.
- **Text:** `clock(sec, withSec)` gives `"01:19:30"`, `hms(h, m, s)` gives seconds, and `typed(text, p)` gives the first fraction p of the text.
- **DOM:** `div(className, parent, html)` (parent defaults to the stage), `el(svgTag, attrs, parent)`, `show(node, opacity, transform)`.
- **Maps:** `S.map(name, parent)` builds a full-frame map: `night` (Malay Peninsula), `ocean` (Africa to Australia), `south` (the 7th arc search region) or `debris` (western Indian Ocean). It returns `{svg, P, layer(cls), camera(x, y, zoom), cameraLL(lon, lat, zoom), fadeWest(lon0, lon1)}`.
  - `P(lon, lat)` gives `[x, y]` in frame pixels at zoom 1.
  - The camera can pan and zoom (zoom 1 to about 2.5). Labels made with `pin()` keep a constant on-screen size.
  - `MAPDATA[name].bounds` gives each map's lon/lat extent.
- **Labels:** `pin(parent, P, [lon, lat], lines, {mark: "dot"|"ring"|"tri"|"sat", anchor, dx, dy, cls: "place"|"sea"|..., sub: true})`. `lines` is a string or an array of strings (second and later lines are dimmer when `sub`).
- **Paths:** `pathFrom(P, [[lon, lat], ...])` gives an SVG `d` string. `drawPath(pathEl, p)` reveals the first fraction of a stroked path.
- **Satellite rings:** `RINGS` (7 rings with `myt`, `utc` and `d` = radius in degrees), `ringPts(d, th0, th1)` (points along a ring by bearing from north; east side is 0–180), `ringThetaAtLat(d, lat)` and `bandPath(P, d, halfWidth, latS, latN)` (a search band along a ring). The 7th arc is `d = 44.2`. Search bands used on the web page: 2014–17 `bandPath(P, 44.2, 0.5, -39.5, -33)`, 2018 `bandPath(P, 44.2, 0.35, -35.5, -25)`. Use `fadeWest(72, 88)` as a group mask so ring tails fade instead of ending abruptly.
- **The night track:** `TRACK` holds `[clockSeconds, lon, lat]` fixes. `trackAt(sec)` gives `{lon, lat}`, `trackPts(s0, s1)` gives the polyline between two clock times, and `headingAt(P, sec)` gives the screen heading. `PLACES` has KLIA, IGARI, PENANG, PULAU_PERAK, KOTA_BHARU, HCMC, LAST_RADAR, SINGAPORE, KUALA_LUMPUR and PERTH. `PLANE_D` is an aircraft glyph path pointing up. The transponder was lost at 01:21:13 = `S.hms(1,21,13)`.
- **CSS classes (style.css):** `.kicker`, `.h1`, `.h2`, `.h3`, `.quote`, `.quote-src`, `.chip`, `.card`, `.clock`, `.clock-sub`, `.mono`, `.serif-i`, `.abs`. Map classes: `.route-civil` (solid magenta), `.route-mil` (dotted magenta), `.route-planned`, `.arc`, `.arc.a7`, `.band.s1`, `.band.s2`, `.mk`. Colour tokens: `--route` (magenta), `--arc` (blue), `--s1` (orange, 2014–17 search), `--s2` (green, Ocean Infinity), `--v-no`, `--v-unlikely`, `--v-unproven` and `--v-open` (verdicts), plus `--ink`, `--ink-2`, `--ink-3`, `--line` and `--plate`.

## Sound cues

A scene may add `sfx: function () { return [["ping", S.cue("s06c") + 1.2], ...]; }` to `S.scene({...})`. Sounds available:

- `ping`: a soft sonar/satellite ping, about 1.5 s. Use one per handshake ring as it appears.
- `blip`: a short radar blip.
- `hit`: a low soft impact for a big reveal, such as the title or a verdict stamp.

Use them sparingly: at most a handful per scene.

## Layout rules

- **Captions own the bottom 200 px.** Keep all scene text and important marks above y = 860. Map land and water can run underneath.
- Keep at least 96 px side margins for text. Corners are good places for persistent context such as the clock or kicker.
- Sizes are for a TV frame: body labels at least 24 px, card headings 48–96 px, mono data 24–32 px. Nothing smaller than 20 px.
- Use one focal point at a time. Fade old elements out when the narration moves on.
- Motion should be calm, with eased moves of 0.6–1.5 s. Nothing should bounce or spin.
- Numbers and labels on screen must match the scene's `visual` text in `script.json` exactly, unless that text is wrong. No invented facts.
- No photographs or likenesses of real people, no AI-generated imagery and no network resources. Use only what is in `scenes/`.

## Checking your work

```sh
cd documentary/video/tools
node render.mjs --still s05 1 6.5 12 20      # writes ../build/stills/s05-1.png etc. and prints page errors
```

Look at every still you render with the Read tool. Check at least one frame per segment, plus the first and last second. Look for:

- text overlapping text or the caption zone, clipped labels, empty or broken frames
- elements that should be visible but aren't (wrong cue), or old elements that never leave
- console errors (printed by the command)

Optionally render the whole scene to video with `node render.mjs s05`, which writes `../build/scenes/s05.mp4`.
