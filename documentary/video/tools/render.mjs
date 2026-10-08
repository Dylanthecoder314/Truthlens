// Renders scenes frame by frame with headless Chromium and encodes them with ffmpeg.
//
//   node render.mjs                     render every scene to ../build/scenes/<id>.mp4
//   node render.mjs s03 s04             render only these scenes
//   node render.mjs --still s03 4 12.5  write ../build/stills/s03-4.png and s03-12.5.png
//   node render.mjs --jobs 3 ...        scenes rendered in parallel (default 3)
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
const ROOT = path.resolve(HERE, "..");
const SCENES = path.join(ROOT, "scenes");
const timing = JSON.parse(readFileSync(path.join(SCENES, "timing.js"), "utf8").replace(/^[\s\S]*?window\.TIMING = /, "").replace(/;\s*$/, ""));
const FPS = timing.fps;

const argv = process.argv.slice(2);
let jobs = 3;
const ji = argv.indexOf("--jobs");
if (ji >= 0) { jobs = +argv[ji + 1]; argv.splice(ji, 2); }

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

async function renderScene(browser, id) {
  const out = path.join(ROOT, "build", "scenes");
  mkdirSync(out, { recursive: true });
  const dur = timing.scenes[id].duration;
  const frames = Math.round(dur * FPS);
  const { page, errors } = await openScene(browser, id);
  const sfx = await page.evaluate(() => window.__sfx || []);
  writeFileSync(path.join(out, `${id}.sfx.json`), JSON.stringify(sfx));
  const file = path.join(out, `${id}.mp4`);
  const ff = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS), file], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c} for ${id}`)))));
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((x) => window.__seek(x), i / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await done;
  await page.close();
  console.log(`${id}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s${errors.length ? `, ERRORS: ${errors.join(" | ")}` : ""}`);
  if (errors.length) process.exitCode = 1;
}

const browser = await playwright.chromium.launch({ args: ["--font-render-hinting=none", "--disable-lcd-text"] });
try {
  if (argv[0] === "--still") {
    await stills(browser, argv[1], argv.slice(2).map(Number));
  } else {
    const ids = argv.length ? argv : timing.order;
    const queue = [...ids];
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      while (queue.length) await renderScene(browser, queue.shift());
    }));
  }
} finally {
  await browser.close();
}
