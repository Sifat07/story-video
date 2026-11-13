// Checks on the rendered frames, measured rather than predicted from scenes.json:
// - a flash: one frame that differs from both neighbours while they match each other
//   (a part showing a frame early, a stray default between scenes). A hard cut differs on one side only.
// - a pop: two or three frames unlike the median of the seven around them (a flash that lasts
//   longer than one frame). A cut or a part fading in is a step, which a median follows; steady
//   motion changes every frame, so it never makes a short run.
// - a blank: the picture area (top two thirds, above the captions) one flat colour for a stretch:
//   a photo or diagram that didn't load, a black or white hole between scenes.
// - a still: a stretch where nothing on screen changes (reels change something every 2-3 s).
// Frames are compared as 48x48 greyscale, mean absolute difference on a 0-255 scale.
// Self-test: node frames-check.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const S = 48, N = S * S, FLASH = 2, STILL = 0.15, POP = 4, FLAT = 3, TOP = S * 32;

// ffmpeg input args (e.g. ["-framerate", "30", "-i", "frames/%05d.jpg"]) → greyscale frames.
export function readFrames(input) {
  const r = spawnSync("ffmpeg", ["-v", "error", ...input, "-vf", `scale=${S}:${S},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 });
  if (r.status) throw new Error(`frames-check: ffmpeg failed: ${r.stderr}`);
  return Array.from({ length: r.stdout.length / N }, (_, k) => r.stdout.subarray(k * N, (k + 1) * N));
}

const diff = (a, b) => { let s = 0; for (let i = 0; i < N; i++) s += Math.abs(a[i] - b[i]); return s / N; };
// Per-pixel median of frames a..b (inclusive).
function median(px, a, b) {
  const m = new Uint8Array(N), v = new Array(b - a + 1);
  for (let i = 0; i < N; i++) { for (let k = a; k <= b; k++) v[k - a] = px[k][i]; v.sort((x, y) => x - y); m[i] = v[v.length >> 1]; }
  return m;
}
// Mean and spread of the picture area.
function flat(p) {
  let s = 0, q = 0;
  for (let i = 0; i < TOP; i++) { s += p[i]; q += p[i] * p[i]; }
  const mean = s / TOP;
  return Math.sqrt(Math.max(0, q / TOP - mean * mean)) < FLAT ? mean : null;
}
// Runs of k where test(k) holds → [[first, last]].
function runs(n, test) {
  const out = [];
  for (let k = 0, start = -1; k <= n; k++) {
    const on = k < n && test(k);
    if (on && start < 0) start = k;
    if (!on && start >= 0) { out.push([start, k - 1]); start = -1; }
  }
  return out;
}

// → { flashes: [frame], pops: [[first, last]], blanks: [[first, last, mean]], stills: [[first, last]] }
// for stills of at least minStill frames and blanks of at least minBlank.
export function frameChecks(px, minStill, minBlank = minStill) {
  const d = px.map((p, k) => k ? diff(px[k - 1], p) : Infinity);
  const flashes = [], stills = [];
  for (let k = 1; k < px.length - 1; k++)
    if (d[k] > FLASH && d[k + 1] > FLASH && diff(px[k - 1], px[k + 1]) < Math.min(d[k], d[k + 1]) / 3) flashes.push(k);
  for (let k = 1, start = 0; k <= px.length; k++)
    if (k === px.length || d[k] >= STILL) { if (k - start >= minStill) stills.push([start, k - 1]); start = k; }
  // Only frames near a change can pop; the median is the slow part, so skip the rest.
  const near = k => [k - 1, k, k + 1, k + 2].some(j => j > 0 && j < px.length && d[j] > FLASH);
  const popped = px.map((p, k) => k >= 3 && k < px.length - 3 && near(k) && diff(p, median(px, k - 3, k + 3)) > POP);
  const pops = runs(px.length, k => popped[k]).filter(([a, b]) => b > a && b - a < 3);
  const means = px.map(flat);
  const blanks = runs(px.length, k => means[k] != null).filter(([a, b]) => b - a + 1 >= minBlank).map(([a, b]) => [a, b, Math.round(means[a])]);
  return { flashes, pops, blanks, stills };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const clip = graph => readFrames(["-f", "lavfi", "-i", graph]);
  // A grey box on black throughout, so the picture is never flat unless a check means it to be.
  const box = "drawbox=x=20:y=20:w=40:h=40:c=gray:t=fill";
  // 3 s with one white frame at 30: one flash, and a still on each side of it.
  const a = frameChecks(clip(`color=black:s=96x96:r=30:d=3,${box},drawbox=c=white:t=fill:enable='eq(n,30)'`), 25);
  assert.deepEqual(a.flashes, [30]);
  assert.deepEqual(a.pops, []);
  assert.deepEqual(a.stills, [[0, 29], [31, 89]]);
  // A hard cut from black to white is not a flash or a pop; the white half is a blank.
  const b = frameChecks(clip(`color=black:s=96x96:r=30:d=2,${box}:enable='lt(n,30)',drawbox=c=white:t=fill:enable='gte(n,30)'`), 25, 12);
  assert.deepEqual(b.flashes, []);
  assert.deepEqual(b.pops, []);
  assert.deepEqual(b.blanks, [[30, 59, 255]]);
  // Two white frames: a pop, not a flash.
  const c = frameChecks(clip(`color=black:s=96x96:r=30:d=2,${box},drawbox=c=white:t=fill:enable='between(n,30,31)'`), 25);
  assert.deepEqual(c.flashes, []);
  assert.deepEqual(c.pops, [[30, 31]]);
  // A box sliding across, and a box fading in: motion and steps, no pops.
  const e = frameChecks(clip(`color=black:s=96x96:r=30:d=2,${box}[b];color=white:s=20x20:r=30[w];[b][w]overlay=x='mod(n*6\\,96)':y=60:shortest=1`), 25);
  assert.deepEqual([e.flashes, e.pops], [[], []]);
  const f = frameChecks(clip(`color=black:s=96x96:r=30:d=2,${box},drawbox=x=0:y=0:w=30:h=30:c=white:t=fill:enable='gte(n,30)',fade=t=in:st=1:d=0.2`), 25);
  assert.deepEqual([f.flashes, f.pops], [[], []]);
  // Black frames under a caption band still count as a blank picture.
  const g = frameChecks(clip(`color=black:s=96x96:r=30:d=2,drawbox=x=10:y=80:w=76:h=10:c=white:t=fill,${box}:enable='lt(n,20)'`), 25, 12);
  assert.deepEqual(g.blanks, [[20, 59, 0]]);
  console.log("frames-check: self-test done");
}
