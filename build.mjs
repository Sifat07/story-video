// story-video: renders <project>/scenes.json into <project>/out/<project>.mp4 (30 fps,
// 1080x1920 portrait or 1920x1080 landscape), plus storyboard.md, <project>.srt captions,
// sheet.jpg (visual check) and poster.jpg.
// Voice: ElevenLabs when ELEVENLABS_API_KEY is set (env or ~/.elevenlabs.env), else macOS `say`,
// else espeak-ng. VOICE=say|espeak|elevenlabs picks one; VOICE=say forces a free draft.
// Usage: node build.mjs <project-dir>
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { cpus, homedir, platform } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const skill = dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) throw new Error("usage: node build.mjs <project-dir>");
const here = resolve(process.argv[2]);
const out = join(here, "out");
const FPS = 30, LEAD = 0.25, TAIL = 0.45, END_HOLD = 1.6;
const FORMATS = { portrait: [1080, 1920], landscape: [1920, 1080] };
// ElevenLabs "George" (stock voice). Override with ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const { model: MODEL = "eleven_multilingual_v2", music: MUSIC_PROMPT, theme, colors, pronounce = {}, captions, format = "portrait", speed, tempo = 1, foreign = [], mode = "explainer",
  transition, scenes } = JSON.parse(readFileSync(join(here, "scenes.json"), "utf8"));
// mode "reel": faster pace and hard cuts by default; "explainer": calmer pace and fades.
const [WPM_LO, WPM_HI] = mode === "reel" ? [150, 185] : [130, 165];
for (const s of scenes) s.transition ??= transition ?? (mode === "reel" ? "cut" : "fade");
if (!FORMATS[format]) throw new Error(`format must be one of: ${Object.keys(FORMATS).join(", ")}`);
const [W, H] = FORMATS[format];

const { chromium } = await import("playwright").catch(() => {
  throw new Error(`playwright missing: run \`npm install && npx playwright install chromium\` in ${skill}`);
});

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const f = join(homedir(), ".elevenlabs.env");
  if (!existsSync(f)) return null;
  return readFileSync(f, "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1].trim() || null;
}
const KEY = readKey();
const has = cmd => spawnSync("which", [cmd]).status === 0;
const ENGINE = process.env.VOICE ||
  (KEY ? "elevenlabs" : platform() === "darwin" ? "say" : has("espeak-ng") ? "espeak" : null);
if (!ENGINE) throw new Error("no voice: set ELEVENLABS_API_KEY, or install espeak-ng (free)");
if (ENGINE === "elevenlabs" && !KEY) throw new Error("VOICE=elevenlabs needs ELEVENLABS_API_KEY");
if (!["elevenlabs", "say", "espeak"].includes(ENGINE)) throw new Error(`unknown VOICE=${ENGINE}`);

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "frames"), { recursive: true });

const ff = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const duration = f =>
  +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString();
// `pronounce` respells words the voice gets wrong, e.g. { "Peña": "Penya" }.
const respell = text => Object.entries(pronounce).reduce((t, [w, say]) => t.replaceAll(w, say), text);
// Audio tags ("[whispers]", "[excited]") steer eleven_v3/v4. They are sent to ElevenLabs but
// never spoken by the free voices, shown in captions, or counted as words.
const TAG = /\[[^\]]*\]/g;
const untag = text => text.replace(TAG, " ").replace(/\s+/g, " ").trim();

// ElevenLabs lines are cached by voice + text in <project>/.voice-cache, so rebuilds that
// only change visuals (or a few lines) don't re-bill.
const cache = join(here, ".voice-cache");
let cachedLines = 0;
async function eleven(spoken, speed) {
  const id = createHash("sha1").update(JSON.stringify([VOICE_ID, MODEL, speed, spoken])).digest("hex").slice(0, 16);
  const f = join(cache, id + ".json");
  if (existsSync(f)) { cachedLines++; return JSON.parse(readFileSync(f, "utf8")); }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    // speed: 0.7-1.2 (ElevenLabs voice_settings), per scene or project-wide; 1 when unset.
    body: JSON.stringify({ text: spoken, model_id: MODEL, ...(speed && { voice_settings: { speed } }) }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const r = await res.json();
  mkdirSync(cache, { recursive: true });
  writeFileSync(f, JSON.stringify(r));
  return r;
}

// Voices one scene into `file` (mono wav). Returns its length and when each word starts:
// exact from ElevenLabs timestamps, else estimated from the word's character position.
// tempo: speeds up (or slows) the finished line without changing pitch, for models that
// ignore `speed` (eleven_v3/v4). Word times scale with it, so captions stay in sync.
async function voice(text, file, speed, tempo) {
  let spoken = respell(text);
  let starts = null;
  if (ENGINE === "elevenlabs") {
    const r = await eleven(spoken, speed);
    writeFileSync(file + ".mp3", Buffer.from(r.audio_base64, "base64"));
    ff("-i", file + ".mp3", "-ar", "44100", "-ac", "1", file);
    if (r.alignment?.characters.join("") === spoken) starts = r.alignment.character_start_times_seconds;
  } else spoken = untag(spoken);
  if (ENGINE === "say") {
    execFileSync("say", ["-v", process.env.SAY_VOICE || "Daniel", "-r", process.env.SAY_RATE || "120", "-o", file + ".aiff", spoken]);
    ff("-i", file + ".aiff", "-ar", "44100", "-ac", "1", file);
  } else if (ENGINE === "espeak") {
    execFileSync("espeak-ng", ["-v", process.env.ESPEAK_VOICE || "en-gb", "-s", process.env.SAY_RATE || "140", "-w", file + ".raw.wav", spoken]);
    ff("-i", file + ".raw.wav", "-ar", "44100", "-ac", "1", file);
  }
  if (tempo !== 1) {
    ff("-i", file, "-af", `atempo=${tempo}`, file + ".t.wav");
    renameSync(file + ".t.wav", file);
    starts &&= starts.map(x => x / tempo);
  }
  const d = duration(file);
  const spans = [...spoken.matchAll(/\[[^\]]*\]|\S+/g)].filter(m => !m[0].startsWith("["));
  // Show the written words (not respellings) when the word counts line up.
  const shown = untag(text).split(/\s+/).filter(Boolean);
  const words = spans.map((m, k) => ({
    w: shown.length === spans.length ? shown[k] : m[0],
    t: starts ? starts[m.index] : m.index / spoken.length * d,
  }));
  return { d, words };
}

// 1. Voice each scene; scene length follows its narration.
console.log(`voice: ${ENGINE}`);
if (ENGINE !== "elevenlabs" && MUSIC_PROMPT && !existsSync(join(here, "music.mp3"))) console.log("music: skipped (needs ElevenLabs)");
let start = 0;
const parts = [];
const tc = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const board = ["| Time | Scene | Purpose | Narration | On screen | wpm |", "| --- | --- | --- | --- | --- | --- |"];
for (const [i, s] of scenes.entries()) {
  const raw = join(out, `vo-${i}.wav`), padded = join(out, `seg-${i}.wav`);
  Object.assign(s, await voice(s.vo, raw, s.speed ?? speed, s.tempo ?? tempo));
  // Target words per minute (pauses included) by mode. Only the final voice is judged.
  const wpm = Math.round(s.words.length / s.d * 60);
  if (ENGINE === "elevenlabs" && (wpm < WPM_LO || wpm > WPM_HI)) console.log(`wpm: scene ${s.id} at ${wpm} (aim ${WPM_LO}-${WPM_HI})`);
  const shown = [s.kicker, s.title?.replace(/<[^>]+>/g, ""), s.sub].filter(Boolean).join(" / ");
  board.push(`| ${tc(start)} | ${s.id} | ${s.purpose ?? ""} | ${s.vo} | ${shown} | ${wpm} |`);
  s.start = start;
  s.dur = LEAD + s.d + (i === scenes.length - 1 ? END_HOLD : TAIL);
  ff("-i", raw, "-af", `adelay=${LEAD * 1000}:all=1,apad=whole_dur=${s.dur}`, padded);
  parts.push(padded);
  start += s.dur;
}
if (cachedLines) console.log(`voice: ${cachedLines}/${scenes.length} lines from .voice-cache (not billed)`);
const total = start;
writeFileSync(join(out, "storyboard.md"), board.join("\n") + "\n");
writeFileSync(join(out, "concat.txt"), parts.map(p => `file '${p}'`).join("\n"));
ff("-f", "concat", "-safe", "0", "-i", join(out, "concat.txt"), join(out, "narration.wav"));
console.log(`length: ${total.toFixed(1)} s`);

// 1b. Captions: one cue per clause (split at punctuation); a clause over 34 characters
// (one line) splits into even parts. Always written as an .srt to upload; burned into
// the frames when scenes.json has "captions": true.
// `foreign`: phrases in another language ("Remontada", "¡Hala Madrid!"), set in italics in captions.
const plain = w => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
for (const s of scenes) for (const f of foreign) {
  const want = f.split(/\s+/).map(plain).filter(Boolean), ws = s.words.map(x => plain(x.w));
  ws.forEach((_, k) => { if (want.length && want.every((w, j) => ws[k + j] === w)) want.forEach((_, j) => s.words[k + j].i = true); });
}
const cues = [];
const line = ws => ws.map(x => x.w).join(" ");
for (const s of scenes) {
  const clauses = [[]];
  s.words.forEach((x, k) => { clauses.at(-1).push(x); if (/[.!?;:,]$/.test(x.w) && k < s.words.length - 1) clauses.push([]); });
  // A tiny clause ("Online,") joins the next one when both fit on one line.
  for (let k = clauses.length - 2; k >= 0; k--)
    if (line(clauses[k]).length < 12 && line([...clauses[k], ...clauses[k + 1]]).length <= 34)
      clauses.splice(k, 2, [...clauses[k], ...clauses[k + 1]]);
  const parts = clauses.flatMap(c => {
    const n = Math.ceil(line(c).length / 34), target = line(c).length / n, out = [[]];
    for (const x of c) {
      if (out.at(-1).length && out.length < n && line([...out.at(-1), x]).length > target + 4) out.push([]);
      out.at(-1).push(x);
    }
    return out;
  });
  parts.forEach((p, k) => cues.push({
    t0: s.start + LEAD + p[0].t, t1: s.start + LEAD + (parts[k + 1]?.[0].t ?? s.d), text: line(p),
    words: p.map(x => ({ w: x.w, t: s.start + LEAD + x.t, ...(x.i && { i: true }) })) }));
}
const srtTime = t => new Date(t * 1000).toISOString().slice(11, 23).replace(".", ",");
writeFileSync(join(out, `${basename(here)}.srt`),
  cues.map((c, k) => `${k + 1}\n${srtTime(c.t0)} --> ${srtTime(c.t1)}\n${c.text}\n`).join("\n"));

// Scenes with a "music" line get their own section, timed to the scene, so the score follows
// the cuts (ElevenLabs composition plan, music_v2_5). Sections under 3 s join the next one.
function musicPlan() {
  if (!scenes.some(s => s.music)) return null;
  const chunks = [];
  for (const s of scenes) {
    const last = chunks.at(-1), ms = Math.round(s.dur * 1000);
    if (last && last.duration_ms < 3000) { last.duration_ms += ms; if (s.music) last.positive_styles.push(s.music); }
    else chunks.push({ text: "", duration_ms: ms, positive_styles: [MUSIC_PROMPT, s.music].filter(Boolean),
      negative_styles: ["vocals", "singing", "lyrics"], context_adherence: "high" });
  }
  if (chunks.length > 1 && chunks.at(-1).duration_ms < 3000) chunks.at(-2).duration_ms += chunks.pop().duration_ms;
  return { chunks };
}

// 1c. Music bed: generated once (ElevenLabs Music) and reused, so re-renders cost no credits.
// A track shorter than the cut loops. Delete music.mp3 to regenerate, or drop in your own.
const music = join(here, "music.mp3");
const planId = createHash("sha1").update(JSON.stringify(musicPlan() ?? MUSIC_PROMPT ?? "")).digest("hex").slice(0, 16);
if (existsSync(music) && existsSync(music + ".id") && readFileSync(music + ".id", "utf8") !== planId)
  console.log("music: scenes or prompts changed since music.mp3 was made; delete it to regenerate (billed)");
if (!existsSync(music) && ENGINE === "elevenlabs" && !process.env.STILLS && (MUSIC_PROMPT || musicPlan())) {
  console.log("music: generating");
  const res = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify(musicPlan()
      ? { composition_plan: musicPlan(), model_id: "music_v2_5" }
      : { prompt: MUSIC_PROMPT, music_length_ms: Math.ceil(total + 1) * 1000, force_instrumental: true }),
  });
  if (!res.ok) throw new Error(`ElevenLabs music ${res.status}: ${(await res.text()).slice(0, 200)}`);
  writeFileSync(music, Buffer.from(await res.arrayBuffer()));
  writeFileSync(music + ".id", planId);
}
let soundtrack = join(out, "narration.wav");
if (existsSync(music)) {
  // Duck the music under the voice, fade it out over the end hold.
  soundtrack = join(out, "mix.wav");
  ff("-i", join(out, "narration.wav"), "-stream_loop", "-1", "-i", music, "-filter_complex",
    "[0]aformat=channel_layouts=stereo,asplit[v][sc];" +
    `[1]volume=0.5,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5[m];` +
    "[m][sc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350[d];" +
    "[v][d]amix=inputs=2:duration=first:normalize=0", soundtrack);
}

// 2. Frames: every frame is window.render(t), a pure function of time. A project's own
// index.html replaces the template (same setup/render contract).
const html = existsSync(join(here, "index.html")) ? join(here, "index.html") : join(skill, "template/index.html");

// SVGs are inlined (file:// pages can't fetch) so their parts can animate. data-at="phrase", in an
// SVG or in title/sub HTML, becomes data-in = when that phrase is spoken (+ data-in, if set, as a delay).
const norm = w => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
function spokenAt(s, phrase) {
  const ws = s.words.map(x => norm(x.w));
  for (const p of new Set([phrase, respell(phrase)])) {
    const want = p.split(/\s+/).map(norm).filter(Boolean);
    const k = ws.findIndex((_, i) => want.every((w, j) => ws[i + j] === w));
    if (want.length && k >= 0) return LEAD + s.words[k].t;
  }
  throw new Error(`scene ${s.id}: data-at "${phrase}" is not in its narration`);
}
// 1d. Sound effects: per scene "sfx": [{ prompt, at?, dur?, gain? }]. Each is made once
// (ElevenLabs sound generation) into .sfx-cache and laid in when its phrase is spoken
// (scene start when no "at"). Free drafts use cached effects only.
const sfxCache = join(here, ".sfx-cache"), effects = [];
for (const s of scenes) for (const e of s.sfx ?? []) {
  const f = join(sfxCache, createHash("sha1").update(JSON.stringify([e.prompt, e.dur])).digest("hex").slice(0, 16) + ".mp3");
  if (!existsSync(f) && ENGINE === "elevenlabs" && !process.env.STILLS) {
    const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: { "xi-api-key": KEY, "content-type": "application/json" },
      body: JSON.stringify({ text: e.prompt, ...(e.dur && { duration_seconds: e.dur }) }),
    });
    if (!res.ok) throw new Error(`ElevenLabs sfx ${res.status}: ${(await res.text()).slice(0, 200)}`);
    mkdirSync(sfxCache, { recursive: true });
    writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  }
  if (existsSync(f)) effects.push({ f, t: s.start + (e.at ? spokenAt(s, e.at) : 0), gain: e.gain ?? 0.5 });
}
if (effects.length) {
  const mixed = join(out, "mix-sfx.wav");
  ff("-i", soundtrack, ...effects.flatMap(e => ["-i", e.f]), "-filter_complex",
    effects.map((e, k) => `[${k + 1}]aformat=channel_layouts=stereo,volume=${e.gain},adelay=${Math.round(e.t * 1000)}:all=1[s${k}];`).join("") +
    `[0]aformat=channel_layouts=stereo[base];[base]${effects.map((_, k) => `[s${k}]`).join("")}amix=inputs=${effects.length + 1}:duration=first:normalize=0`,
    mixed);
  soundtrack = mixed;
  console.log(`sfx: ${effects.length} effect(s)`);
}

const resolveAt = (s, html) => html.replace(/<[^>]*\sdata-at="[^"]*"[^>]*>/g, tag => {
  const at = tag.match(/\sdata-at="([^"]*)"/)[1], delay = +(tag.match(/\sdata-in="([^"]*)"/)?.[1] ?? 0);
  const t = (spokenAt(s, at) + delay).toFixed(2);
  return tag.replace(/\sdata-in="[^"]*"/, "").replace(/\sdata-at="[^"]*"/, ` data-in="${t}"`);
});
for (const s of scenes) {
  if (s.title) s.title = resolveAt(s, s.title);
  if (s.sub) s.sub = resolveAt(s, s.sub);
  s.svgs = Object.fromEntries((s.photos || []).filter(f => f.endsWith(".svg"))
    .map(f => [f, resolveAt(s, readFileSync(join(here, "photos", f), "utf8"))]));
}

const frames = Math.ceil(total * FPS);
const frameFile = f => join(out, "frames", `${String(Math.min(frames - 1, f)).padStart(5, "0")}.jpg`);
const cfg = { scenes, base: pathToFileURL(here).href + "/", theme, colors, format, cues: captions ? cues : [] };
// Several pages render interleaved frames in parallel; each frame only depends on t.
const browser = await chromium.launch();
const pages = await Promise.all(Array.from({ length: Math.min(4, Math.max(1, cpus().length - 1)) }, async () => {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(pathToFileURL(html).href, { waitUntil: "networkidle" });
  await page.evaluate(c => window.setup(c), cfg);
  return page;
}));
// "Settled" = just before the fade-out, so animated diagrams are fully built.
const settled = s => s.start + Math.max(s.dur - 0.5, Math.min(2, s.dur - 0.45));
// STILLS=1: style frames only, one settled frame per scene in out/stills/, no video.
// Cheap way to compare looks (colors, theme, art) before a full render.
if (process.env.STILLS) {
  mkdirSync(join(out, "stills"));
  for (const [k, s] of scenes.entries()) {
    await pages[0].evaluate(t => window.render(t, { poster: true }), settled(s));
    await pages[0].screenshot({ path: join(out, "stills", `${String(k + 1).padStart(2, "0")}-${s.id ?? "scene"}.jpg`), type: "jpeg", quality: 92 });
  }
  await browser.close();
  console.log(`stills: ${join(out, "stills")}`);
  process.exit(0);
}
let done = 0;
await Promise.all(pages.map(async (page, k) => {
  for (let f = k; f < frames; f += pages.length) {
    await page.evaluate(t => window.render(t), f / FPS);
    await page.screenshot({ path: frameFile(f), type: "jpeg", quality: 92 });
    if (++done % 300 === 0) console.log(`frame ${done}/${frames}`);
  }
}));

// 2b. Poster: settled frame of the `poster: true` scene (else the last), rendered without
// captions. Also baked in as frame 0 so platform thumbnails show it.
await pages[0].evaluate(t => window.render(t, { poster: true }), settled(scenes.find(s => s.poster) ?? scenes.at(-1)));
await pages[0].screenshot({ path: join(out, "poster.jpg"), type: "jpeg", quality: 92 });
await browser.close();

// 2c. Check sheet: per scene, mid fade-in | settled | mid fade-out. Look at it before posting.
mkdirSync(join(out, "check"));
scenes.flatMap(s => [s.start + 0.4, settled(s), s.start + s.dur - 0.17])
  .forEach((t, k) => copyFileSync(frameFile(Math.round(t * FPS)), join(out, "check", `${String(k).padStart(3, "0")}.jpg`)));
ff("-i", join(out, "check", "%03d.jpg"), "-vf", `scale=${format === "portrait" ? 270 : 480}:-1,tile=3x${scenes.length}`, "-frames:v", "1", join(out, "sheet.jpg"));
rmSync(join(out, "check"), { recursive: true });
copyFileSync(join(out, "poster.jpg"), frameFile(0));

// 3. Encode.
const mp4 = join(out, `${basename(here)}.mp4`);
ff("-framerate", String(FPS), "-i", join(out, "frames", "%05d.jpg"), "-i", soundtrack,
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest",
  "-movflags", "+faststart", mp4);
rmSync(join(out, "frames"), { recursive: true });
console.log(`done: ${mp4}`);
