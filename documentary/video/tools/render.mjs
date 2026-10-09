// Renders scenes frame by frame with headless Chromium and encodes them with ffmpeg.
//
//   node render.mjs                     render every scene to ../build/scenes/<id>.mp4
//   node render.mjs s03 s04             render only these scenes
//   node render.mjs --still s03 4 12.5  write ../build/stills/s03-4.png and s03-12.5.png
//   node render.mjs --jobs 3 ...        pages rendered in parallel (default 3)
//   node render.mjs --parts 3 ...       split each scene into 3 frame ranges rendered in parallel
//   node render.mjs --root ../remaster  render another project (its scenes/ and build/)
//
// Needs Playwright (installed globally in this environment) and ffmpeg on PATH.

import { spawn, execSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); }
catch { playwright = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
function opt(name, def) {
  const i = argv.indexOf(name);
  if (i < 0) return def;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
}
const jobs = +opt("--jobs", 3);
const parts = +opt("--parts", 1);
const ROOT = path.resolve(opt("--root", path.resolve(HERE, "..")));
const SCENES = path.join(ROOT, "scenes");
const timing = JSON.parse(readFileSync(path.join(SCENES, "timing.js"), "utf8").replace(/^[\s\S]*?window\.TIMING = /, "").replace(/;\s*$/, ""));
const FPS = timing.fps;

async function openScene(browser, id, query = "") {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const file = path.join(SCENES, `${id}.html`);
  if (!existsSync(file)) throw new Error(`missing ${file}`);
  await page.goto(pathToFileURL(file).href + query);
  await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 15000 });
  await page.evaluate(() => window.__ready);
  return { page, errors };
}

async function stills(browser, id, times) {
  const out = path.join(ROOT, "build", "stills");
  mkdirSync(out, { recursive: true });
  const { page, errors } = await openScene(browser, id);
  for (const t of times) {
    await page.evaluate((x) => window.__seek(x), t);
    const f = path.join(out, `${id}-${t}.png`);
    await page.screenshot({ path: f });
    console.log(f);
  }
  if (errors.length) console.log(`${id} errors:\n  ${errors.join("\n  ")}`);
  await page.close();
}

// Render frames [from, to) of a scene into one file.
async function renderRange(browser, id, from, to, file) {
  const { page, errors } = await openScene(browser, id);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS), file], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c} for ${file}`)))));
  for (let i = from; i < to; i++) {
    await page.evaluate((x) => window.__seek(x), i / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await done;
  await page.close();
  if (errors.length) { console.log(`${id} [${from}-${to}) ERRORS: ${errors.join(" | ")}`); process.exitCode = 1; }
}

async function sceneSfx(browser, id, out) {
  const { page } = await openScene(browser, id);
  const sfx = await page.evaluate(() => window.__sfx || []);
  writeFileSync(path.join(out, `${id}.sfx.json`), JSON.stringify(sfx));
  await page.close();
}

const browser = await playwright.chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] });
try {
  if (argv[0] === "--still") {
    await stills(browser, argv[1], argv.slice(2).map(Number));
  } else {
    const ids = argv.length ? argv : timing.order;
    const out = path.join(ROOT, "build", "scenes");
    mkdirSync(out, { recursive: true });
    const tasks = [];
    for (const id of ids) {
      await sceneSfx(browser, id, out);
      const frames = Math.round(timing.scenes[id].duration * FPS);
      const n = Math.max(1, Math.min(parts, Math.floor(frames / 60)));
      for (let k = 0; k < n; k++) {
        const from = Math.round((frames * k) / n), to = Math.round((frames * (k + 1)) / n);
        tasks.push({ id, k, n, from, to, file: path.join(out, n === 1 ? `${id}.mp4` : `${id}.part${k}.mp4`) });
      }
    }
    const t0 = Date.now();
    const queue = [...tasks];
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) {
        const t = queue.shift();
        await renderRange(browser, t.id, t.from, t.to, t.file);
        console.log(`${t.id}${t.n > 1 ? ` part ${t.k + 1}/${t.n}` : ""}: ${t.to - t.from} frames (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`);
      }
    }));
    for (const id of ids) {
      const ps = tasks.filter((t) => t.id === id && t.n > 1);
      if (!ps.length) continue;
      const list = path.join(out, `${id}.parts.txt`);
      writeFileSync(list, ps.map((t) => `file '${path.basename(t.file)}'`).join("\n") + "\n");
      execSync(`ffmpeg -y -loglevel error -f concat -safe 0 -i "${list}" -c copy "${path.join(out, id + ".mp4")}"`);
      console.log(`${id}: joined ${ps.length} parts`);
    }
  }
} finally {
  await browser.close();
}
