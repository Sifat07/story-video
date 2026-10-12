// story-video: renders <project>/scenes.json into <project>/out/<project>.mp4 (1080x1920, 30 fps),
// plus storyboard.md, sheet.jpg (visual check) and poster.jpg.
// Voice: ElevenLabs when ELEVENLABS_API_KEY is set (env or ~/.elevenlabs.env), else macOS `say`.
// VOICE=say forces `say` for free drafts.
// Usage: node build.mjs <project-dir>
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const skill = dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) throw new Error("usage: node build.mjs <project-dir>");
const here = resolve(process.argv[2]);
const out = join(here, "out");
const FPS = 30, LEAD = 0.25, TAIL = 0.45, END_HOLD = 1.6;
// ElevenLabs "George" (stock voice). Override with ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const { music: MUSIC_PROMPT, theme, colors, pronounce = {}, scenes } =
  JSON.parse(readFileSync(join(here, "scenes.json"), "utf8"));

const { chromium } = await import("playwright").catch(() => {
  throw new Error(`playwright missing: run \`npm install && npx playwright install chromium\` in ${skill}`);
});

function elevenKey() {
  if (process.env.VOICE === "say") return null;
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const f = join(homedir(), ".elevenlabs.env");
  if (!existsSync(f)) return null;
  return readFileSync(f, "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1].trim() || null;
}
if (!elevenKey() && platform() !== "darwin")
  throw new Error("no voice: set ELEVENLABS_API_KEY (the free `say` fallback is macOS only)");

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "frames"), { recursive: true });

const ff = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const duration = f =>
  +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString();

async function voice(text, file) {
  // `pronounce` respells words the voice gets wrong, e.g. { "Peña": "Penya" }.
  const spoken = Object.entries(pronounce).reduce((t, [w, say]) => t.replaceAll(w, say), text);
  const key = elevenKey();
  if (key) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({ text: spoken, model_id: "eleven_multilingual_v2" }),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    writeFileSync(file + ".mp3", Buffer.from(await res.arrayBuffer()));
    ff("-i", file + ".mp3", "-ar", "44100", "-ac", "1", file);
  } else {
    execFileSync("say", ["-v", process.env.SAY_VOICE || "Daniel", "-r", process.env.SAY_RATE || "120", "-o", file + ".aiff", spoken]);
    ff("-i", file + ".aiff", "-ar", "44100", "-ac", "1", file);
  }
}

// 1. Voice each scene; scene length follows its narration.
console.log(`voice: ${elevenKey() ? "ElevenLabs" : "macOS say"}`);
if (!elevenKey() && MUSIC_PROMPT && !existsSync(join(here, "music.mp3"))) console.log("music: skipped (needs ElevenLabs)");
let start = 0;
const parts = [];
const tc = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const board = ["| Time | Scene | Purpose | Narration | On screen | wpm |", "| --- | --- | --- | --- | --- | --- |"];
for (const [i, s] of scenes.entries()) {
  const raw = join(out, `vo-${i}.wav`), padded = join(out, `seg-${i}.wav`);
  await voice(s.vo, raw);
  // Target 125-145 words per minute. Only the final voice is judged; `say` pacing differs.
  const wpm = Math.round(s.vo.split(/\s+/).length / duration(raw) * 60);
  if (elevenKey() && (wpm < 125 || wpm > 145)) console.log(`wpm: scene ${s.id} at ${wpm}`);
  const shown = [s.kicker, s.title?.replace(/<[^>]+>/g, ""), s.sub].filter(Boolean).join(" / ");
  board.push(`| ${tc(start)} | ${s.id} | ${s.purpose ?? ""} | ${s.vo} | ${shown} | ${wpm} |`);
  s.start = start;
  s.dur = LEAD + duration(raw) + (i === scenes.length - 1 ? END_HOLD : TAIL);
  ff("-i", raw, "-af", `adelay=${LEAD * 1000}:all=1,apad=whole_dur=${s.dur}`, padded);
  parts.push(padded);
  start += s.dur;
}
const total = start;
writeFileSync(join(out, "storyboard.md"), board.join("\n") + "\n");
writeFileSync(join(out, "concat.txt"), parts.map(p => `file '${p}'`).join("\n"));
ff("-f", "concat", "-safe", "0", "-i", join(out, "concat.txt"), join(out, "narration.wav"));
console.log(`length: ${total.toFixed(1)} s`);

// 1b. Music bed: generated once (ElevenLabs Music) and reused, so re-renders cost no credits.
// Delete music.mp3 to regenerate, e.g. after the cut gets longer. Or drop in your own music.mp3.
const music = join(here, "music.mp3");
if (!existsSync(music) && elevenKey() && MUSIC_PROMPT) {
  console.log("music: generating");
  const res = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: { "xi-api-key": elevenKey(), "content-type": "application/json" },
    body: JSON.stringify({ prompt: MUSIC_PROMPT, music_length_ms: Math.ceil(total + 1) * 1000, force_instrumental: true }),
  });
  if (!res.ok) throw new Error(`ElevenLabs music ${res.status}: ${(await res.text()).slice(0, 200)}`);
  writeFileSync(music, Buffer.from(await res.arrayBuffer()));
}
let soundtrack = join(out, "narration.wav");
if (existsSync(music)) {
  // Duck the music under the voice, fade it out over the end hold.
  soundtrack = join(out, "mix.wav");
  ff("-i", join(out, "narration.wav"), "-i", music, "-filter_complex",
    "[0]aformat=channel_layouts=stereo,asplit[v][sc];" +
    `[1]volume=0.5,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5[m];` +
    "[m][sc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350[d];" +
    "[v][d]amix=inputs=2:duration=first:normalize=0", soundtrack);
}

// 2. Frames: every frame is window.render(t), a pure function of time. A project's own
// index.html replaces the template (same setup/render contract).
const html = existsSync(join(here, "index.html")) ? join(here, "index.html") : join(skill, "template/index.html");
// SVGs are inlined (file:// pages can't fetch) so their parts can animate.
for (const s of scenes)
  s.svgs = Object.fromEntries((s.photos || []).filter(f => f.endsWith(".svg"))
    .map(f => [f, readFileSync(join(here, "photos", f), "utf8")]));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
await page.evaluate(cfg => window.setup(cfg), { scenes, base: pathToFileURL(here).href + "/", theme, colors });
const frames = Math.ceil(total * FPS);
for (let f = 0; f < frames; f++) {
  await page.evaluate(t => window.render(t), f / FPS);
  await page.screenshot({ path: join(out, "frames", `${String(f).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
  if (f % 150 === 0) console.log(`frame ${f}/${frames}`);
}
await browser.close();

// 2b. Check sheet: per scene, mid fade-in | settled | mid fade-out. Look at it before posting.
const frame = t => join(out, "frames", `${String(Math.min(frames - 1, Math.round(t * FPS))).padStart(5, "0")}.jpg`);
// "Settled" = just before the fade-out, so animated diagrams are fully built.
const settled = s => s.start + Math.max(s.dur - 0.5, Math.min(2, s.dur - 0.45));
mkdirSync(join(out, "check"));
scenes.flatMap(s => [s.start + 0.4, settled(s), s.start + s.dur - 0.17])
  .forEach((t, k) => copyFileSync(frame(t), join(out, "check", `${String(k).padStart(3, "0")}.jpg`)));
ff("-i", join(out, "check", "%03d.jpg"), "-vf", `scale=270:-1,tile=3x${scenes.length}`, "-frames:v", "1", join(out, "sheet.jpg"));
rmSync(join(out, "check"), { recursive: true });

// 2c. Poster: settled frame of the `poster: true` scene (else the last), also baked in as frame 0
// so platform thumbnails show it. Replaces the frame, so duration and audio sync are unchanged.
const poster = frame(settled(scenes.find(s => s.poster) ?? scenes.at(-1)));
copyFileSync(poster, join(out, "poster.jpg"));
copyFileSync(poster, frame(0));

// 3. Encode.
const mp4 = join(out, `${basename(here)}.mp4`);
ff("-framerate", String(FPS), "-i", join(out, "frames", "%05d.jpg"), "-i", soundtrack,
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest",
  "-movflags", "+faststart", mp4);
rmSync(join(out, "frames"), { recursive: true });
console.log(`done: ${mp4}`);
