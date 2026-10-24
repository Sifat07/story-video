// Checks on the rendered frames, measured rather than predicted from scenes.json:
// - a flash: one frame that differs from both neighbours while they match each other
//   (a part showing a frame early, a stray default between scenes). A hard cut differs on one side only.
// - a still: a stretch where nothing on screen changes (reels change something every 2-3 s).
// Frames are compared as 48x48 greyscale, mean absolute difference on a 0-255 scale.
// Self-test: node frames-check.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const S = 48, N = S * S, FLASH = 2, STILL = 0.15;

// ffmpeg input args (e.g. ["-framerate", "30", "-i", "frames/%05d.jpg"]) → greyscale frames.
export function readFrames(input) {
  const r = spawnSync("ffmpeg", ["-v", "error", ...input, "-vf", `scale=${S}:${S},format=gray`, "-f", "rawvideo", "-"], { maxBuffer: 1 << 28 });
  if (r.status) throw new Error(`frames-check: ffmpeg failed: ${r.stderr}`);
  return Array.from({ length: r.stdout.length / N }, (_, k) => r.stdout.subarray(k * N, (k + 1) * N));
}

const diff = (a, b) => { let s = 0; for (let i = 0; i < N; i++) s += Math.abs(a[i] - b[i]); return s / N; };

// → { flashes: [frame], stills: [[first, last]] } for stills of at least minStill frames.
export function frameChecks(px, minStill) {
  const d = px.map((p, k) => k ? diff(px[k - 1], p) : Infinity);
  const flashes = [], stills = [];
  for (let k = 1; k < px.length - 1; k++)
    if (d[k] > FLASH && d[k + 1] > FLASH && diff(px[k - 1], px[k + 1]) < Math.min(d[k], d[k + 1]) / 3) flashes.push(k);
  for (let k = 1, start = 0; k <= px.length; k++)
    if (k === px.length || d[k] >= STILL) { if (k - start >= minStill) stills.push([start, k - 1]); start = k; }
  return { flashes, stills };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const clip = graph => readFrames(["-f", "lavfi", "-i", graph]);
  // 3 s of black with one white frame at 30: one flash, and a still on each side of it.
  const a = frameChecks(clip("color=black:s=96x96:r=30:d=3,drawbox=c=white:t=fill:enable='eq(n,30)'"), 25);
  assert.deepEqual(a.flashes, [30]);
  assert.deepEqual(a.stills, [[0, 29], [31, 89]]);
  // A hard cut from black to white is not a flash.
  const b = frameChecks(clip("color=black:s=96x96:r=30:d=2,drawbox=c=white:t=fill:enable='gte(n,30)'"), 25);
  assert.deepEqual(b.flashes, []);
  console.log("frames-check: self-test done");
}
