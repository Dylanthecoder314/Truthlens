// Scene runtime for the MH370 film.
//
// A scene is an HTML page that loads mapdata.js, timing.js and this file, then calls
//   S.scene({ setup(), draw(t), sfx() })
// draw(t) must set every animated property from t (seconds since the scene
// started) alone: the renderer seeks frame by frame, possibly out of order, so
// no CSS transitions/animations, timers or accumulated state.
//
// Preview a frame in a browser with  sNN.html?t=12.5  (add &captions=0 to hide captions).
(function () {
  "use strict";
  var W = 1920, H = 1080, RAD = Math.PI / 180, NS = "http://www.w3.org/2000/svg";
  var params = new URLSearchParams(location.search);
  var sceneId = document.body.getAttribute("data-scene");
  var T = (window.TIMING && window.TIMING.scenes[sceneId]) || null;
  if (!T) throw new Error("No timing for scene " + sceneId + " (run tools/tts.py)");

  /* ---------- timing ---------- */
  function seg(id) {
    for (var i = 0; i < T.segments.length; i++) if (T.segments[i].id === id) return T.segments[i];
    throw new Error("Unknown segment " + id + " in " + sceneId);
  }
  function cue(id) { return seg(id).start; }      // when narration of a segment starts
  function cueEnd(id) { return seg(id).end; }     // when it ends

  /* ---------- maths ---------- */
  function clamp(x, a, b) { return Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, x)); }
  function lerp(a, b, p) { return a + (b - a) * p; }
  function prog(t, a, b) { return b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)); } // 0..1 between times a and b
  function ease(p) { p = clamp(p); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
  function easeOut(p) { p = clamp(p); return 1 - Math.pow(1 - p, 3); }
  function easeIn(p) { p = clamp(p); return p * p * p; }
  // Fade 0→1 over `d` seconds starting at `a`, optionally back to 0 over `d` ending at `b`.
  function fadeWin(t, a, b, d) { d = d || 0.5; var v = easeOut(prog(t, a, a + d)); if (b !== undefined) v *= 1 - easeIn(prog(t, b - d, b)); return v; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  // 4373 -> "01:12:53"; withSec=false -> "01:12"
  function clock(sec, withSec) {
    sec = Math.floor(sec + 1e-6);
    var h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60, s = sec % 60;
    return pad(h) + ":" + pad(m) + (withSec === false ? "" : ":" + pad(s));
  }
  function hms(h, m, s) { return h * 3600 + m * 60 + (s || 0); }
  function typed(text, p) { return text.slice(0, Math.round(clamp(p) * text.length)); }

  /* ---------- DOM / SVG ---------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function div(cls, parent, html) {
    var d = document.createElement("div");
    if (cls) d.className = cls;
    if (html !== undefined) d.innerHTML = html;
    (parent || stage).appendChild(d);
    return d;
  }
  function r1(n) { return Math.round(n * 10) / 10; }
  function show(node, opacity, extraTransform) {
    node.style.opacity = opacity;
    node.style.visibility = opacity <= 0.001 ? "hidden" : "visible";
    if (extraTransform !== undefined) node.style.transform = extraTransform;
  }

  /* ---------- maps ---------- */
  function projector(name) {
    var m = window.MAPDATA[name];
    return function (lon, lat) {
      return [m.s * lon * RAD + m.tx, m.ty - m.s * Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2))];
    };
  }
  function pathFrom(P, pts) { // pts: [[lon, lat], ...]
    var d = "";
    for (var i = 0; i < pts.length; i++) { var xy = P(pts[i][0], pts[i][1]); d += (i ? "L" : "M") + r1(xy[0]) + " " + r1(xy[1]); }
    return d;
  }
  // Full-frame map. camera(cx, cy, zoom) frames projected point (cx, cy) at the
  // centre with the given zoom (1 = the map's native 1920x1080 view).
  var maskId = 0;
  function map(name, parent) {
    var m = window.MAPDATA[name];
    var svg = el("svg", { "class": "map", viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "xMidYMid slice" }, parent || stage);
    el("rect", { "class": "water", x: -2000, y: -2000, width: W + 4000, height: H + 4000 }, svg);
    el("path", { "class": "land", d: m.land }, svg);
    if (m.borders) el("path", { "class": "borders", d: m.borders }, svg);
    var P = projector(name);
    var api = {
      svg: svg, P: P,
      layer: function (cls) { return el("g", cls ? { "class": cls } : null, svg); },
      camera: function (cx, cy, zoom) {
        var w = W / zoom, h = H / zoom;
        svg.setAttribute("viewBox", r1(cx - w / 2) + " " + r1(cy - h / 2) + " " + r1(w) + " " + r1(h));
        svg.style.setProperty("--k", (1 / zoom).toFixed(4));
      },
      cameraLL: function (lon, lat, zoom) { var xy = P(lon, lat); api.camera(xy[0], xy[1], zoom); },
      // A mask that fades content out toward the west: fully hidden west of lon0,
      // fully visible east of lon1. Apply with group.setAttribute("mask", api.fadeWest(70, 86)).
      fadeWest: function (lon0, lon1) {
        var id = "fw" + (++maskId), defs = svg.querySelector("defs") || el("defs", null, svg);
        var g = el("linearGradient", { id: id + "g", gradientUnits: "userSpaceOnUse", x1: r1(P(lon0, 0)[0]), y1: 0, x2: r1(P(lon1, 0)[0]), y2: 0 }, defs);
        el("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0 }, g);
        el("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 1 }, g);
        var mk = el("mask", { id: id, maskUnits: "userSpaceOnUse", x: -4000, y: -4000, width: 12000, height: 12000 }, defs);
        el("rect", { x: -4000, y: -4000, width: 12000, height: 12000, fill: "url(#" + id + "g)" }, mk);
        return "url(#" + id + ")";
      },
    };
    api.camera(W / 2, H / 2, 1);
    return api;
  }
  // A label pinned to [lon, lat]. Its inner group is counter-scaled so text and
  // markers keep the same on-screen size when the camera zooms.
  // o: { mark: "dot"|"ring"|"tri"|"sat", anchor: "start"|"middle"|"end", dx, dy, cls, sub: true (2nd+ lines dimmer) }
  function pin(parent, P, ll, lines, o) {
    o = o || {};
    var xy = P(ll[0], ll[1]);
    var g = el("g", { transform: "translate(" + r1(xy[0]) + " " + r1(xy[1]) + ")", "class": "lbl " + (o.cls || "") }, parent);
    var s = el("g", { "class": "sc" }, g);
    if (o.mark === "dot") el("circle", { r: 7, "class": "mk" }, s);
    if (o.mark === "ring") el("circle", { r: 9, "class": "mk ring" }, s);
    if (o.mark === "tri") el("path", { d: "M0 -12L11 7H-11Z", "class": "mk wp" }, s);
    if (o.mark === "sat") el("path", { d: "M0 -13L13 0L0 13L-13 0Z", "class": "mk sat" }, s);
    if (lines) {
      var anchor = o.anchor || "start";
      var dx = o.dx !== undefined ? o.dx : (anchor === "end" ? -18 : anchor === "middle" ? 0 : 18);
      var dy = o.dy !== undefined ? o.dy : 8;
      var t = el("text", { x: dx, y: dy, "text-anchor": anchor }, s);
      [].concat(lines).forEach(function (ln, i) {
        var ts = el("tspan", { x: dx, dy: i ? "1.25em" : "0" }, t);
        if (i && o.sub) ts.setAttribute("class", "sub");
        ts.textContent = ln;
      });
    }
    return g;
  }
  // Reveal the first fraction p of an SVG path's length.
  function drawPath(path, p) {
    var L = path.__len || (path.__len = path.getTotalLength());
    path.style.strokeDasharray = L + " " + L;
    path.style.strokeDashoffset = (L * (1 - clamp(p))).toFixed(1);
  }

  /* ---------- satellite rings ---------- */
  // Small circles on the Earth around the Inmarsat-3F1 sub-satellite point (0°, 64.5°E).
  var SAT = [64.5, 0];
  // Radii in degrees of arc, reconstructed from the published BTO values.
  var RINGS = [
    { n: 1, myt: "02:25", utc: "18:25", d: 32.9 },
    { n: 2, myt: "03:41", utc: "19:41", d: 30.6 },
    { n: 3, myt: "04:41", utc: "20:41", d: 31.2 },
    { n: 4, myt: "05:41", utc: "21:41", d: 33.5 },
    { n: 5, myt: "06:41", utc: "22:41", d: 37.1 },
    { n: 6, myt: "08:11", utc: "00:11", d: 43.6 },
    { n: 7, myt: "08:19", utc: "00:19", d: 44.2 },
  ];
  function ringPoint(dist, theta) { // theta: bearing from north, degrees
    var d = dist * RAD, th = theta * RAD;
    return [SAT[0] + Math.atan2(Math.sin(th) * Math.sin(d), Math.cos(d)) / RAD, Math.asin(Math.sin(d) * Math.cos(th)) / RAD];
  }
  function ringThetaAtLat(dist, lat) { return Math.acos(clamp(Math.sin(lat * RAD) / Math.sin(dist * RAD), -1, 1)) / RAD; }
  function ringPts(dist, th0, th1, step) { var pts = []; step = step || 1; for (var th = th0; th <= th1 + 1e-9; th += step) pts.push(ringPoint(dist, th)); return pts; }
  // Band along a ring between two latitudes (east side), e.g. a search area.
  function bandPath(P, dist, half, latS, latN) {
    var a = [], b = [], lat;
    for (lat = latS; lat <= latN + 1e-9; lat += 0.25) a.push(ringPoint(dist + half, ringThetaAtLat(dist + half, lat)));
    for (lat = latN; lat >= latS - 1e-9; lat -= 0.25) b.push(ringPoint(dist - half, ringThetaAtLat(dist - half, lat)));
    return pathFrom(P, a.concat(b)) + "Z";
  }

  /* ---------- the night track (published fixes; approximate between them) ---------- */
  // [seconds after midnight MYT, lon, lat]
  var TRACK = [
    [2520, 101.710, 2.745],  // 00:42 takeoff, KLIA
    [4831, 103.585, 6.936],  // 01:20:31 IGARI
    [4873, 103.650, 7.010],  // 01:21:13 transponder lost
    [4960, 103.470, 6.880],  // the turn back
    [5580, 102.290, 6.170],  // over Kota Bharu
    [6751, 100.280, 5.220],  // 01:52 south of Penang Island
    [7380, 98.940, 5.680],   // 02:03 Pulau Perak
    [8532, 96.720, 6.810],   // 02:22:12 last military radar return
  ];
  var PLACES = {
    KLIA: [101.71, 2.745], IGARI: [103.585, 6.936], PENANG: [100.33, 5.41], PULAU_PERAK: [98.94, 5.68],
    KOTA_BHARU: [102.24, 6.13], HCMC: [106.63, 10.82], LAST_RADAR: [96.72, 6.81], SINGAPORE: [103.82, 1.35],
    KUALA_LUMPUR: [101.69, 3.14], PERTH: [115.86, -31.95],
  };
  function trackAt(sec) { // -> {lon, lat, heading (deg, screen-space needs P), seg}
    for (var i = 1; i < TRACK.length; i++) if (sec <= TRACK[i][0]) {
      var a = TRACK[i - 1], b = TRACK[i], f = clamp((sec - a[0]) / (b[0] - a[0]));
      return { lon: lerp(a[1], b[1], f), lat: lerp(a[2], b[2], f), seg: i };
    }
    var z = TRACK[TRACK.length - 1];
    return { lon: z[1], lat: z[2], seg: TRACK.length - 1 };
  }
  function trackPts(s0, s1) { // [[lon, lat]...] of the track between two clock times
    var p0 = trackAt(Math.max(s0, TRACK[0][0])), pts = [[p0.lon, p0.lat]];
    TRACK.forEach(function (k) { if (k[0] > s0 && k[0] < s1) pts.push([k[1], k[2]]); });
    var p1 = trackAt(s1); pts.push([p1.lon, p1.lat]);
    return pts;
  }
  function headingAt(P, sec) { // screen heading in degrees (0 = up) at a clock time
    var p = trackAt(sec), a = TRACK[p.seg - 1], b = TRACK[p.seg];
    var pa = P(a[1], a[2]), pb = P(b[1], b[2]);
    return Math.atan2(pb[0] - pa[0], -(pb[1] - pa[1])) / RAD;
  }
  // Aircraft glyph pointing up, ~30px long at k=1. Put it inside a group you translate/rotate.
  var PLANE_D = "M0 -22L3.6 -8L20 2V6.8L3.6 2.4L2.6 15L8.4 19.2V22L0 20L-8.4 22V19.2L-2.6 15L-3.6 2.4L-20 6.8V2L-3.6 -8Z";

  /* ---------- lifecycle ---------- */
  var stage = document.getElementById("stage") || div(null, document.body);
  if (!stage.id) stage.id = "stage";
  var caption = document.createElement("div"); caption.id = "caption"; stage.appendChild(caption);
  var fade = document.createElement("div"); fade.id = "fade"; stage.appendChild(fade);
  var showCaptions = params.get("captions") !== "0";
  var def = null, lastCaption = null;

  function captionAt(t) {
    for (var i = 0; i < T.segments.length; i++) {
      var cs = T.segments[i].chunks;
      for (var j = 0; j < cs.length; j++) if (t >= cs[j].start && t < cs[j].end) return cs[j].text;
    }
    return "";
  }
  function seek(t) {
    t = clamp(t, 0, T.duration);
    def.draw(t);
    var c = showCaptions ? captionAt(t) : "";
    if (c !== lastCaption) { caption.textContent = c; lastCaption = c; }
    var fi = def.fadeIn === undefined ? 0.6 : def.fadeIn, fo = def.fadeOut === undefined ? 0.6 : def.fadeOut;
    var o = 0;
    if (fi > 0 && t < fi) o = 1 - easeOut(t / fi);
    if (fo > 0 && t > T.duration - fo) o = Math.max(o, easeIn((t - (T.duration - fo)) / fo));
    fade.style.opacity = o.toFixed(3);
  }

  var S = {
    W: W, H: H, RAD: RAD, id: sceneId, timing: T, duration: T.duration, stage: stage,
    seg: seg, cue: cue, cueEnd: cueEnd,
    clamp: clamp, lerp: lerp, prog: prog, ease: ease, easeOut: easeOut, easeIn: easeIn, fadeWin: fadeWin,
    clock: clock, hms: hms, typed: typed,
    el: el, div: div, show: show, map: map, projector: projector, pathFrom: pathFrom, pin: pin, drawPath: drawPath,
    SAT: SAT, RINGS: RINGS, ringPoint: ringPoint, ringThetaAtLat: ringThetaAtLat, ringPts: ringPts, bandPath: bandPath,
    TRACK: TRACK, PLACES: PLACES, trackAt: trackAt, trackPts: trackPts, headingAt: headingAt, PLANE_D: PLANE_D,
    scene: function (d) {
      def = d;
      window.__duration = T.duration;
      window.__seek = seek;
      window.__ready = document.fonts.ready.then(function () {
        if (def.setup) def.setup();
        // Optional sound cues: sfx() returns [["ping"|"blip"|"hit", seconds], ...].
        window.__sfx = def.sfx ? def.sfx() : [];
        var t0 = parseFloat(params.get("t"));
        seek(isNaN(t0) ? 0 : t0);
        return T.duration;
      });
    },
  };
  window.S = S;
})();
