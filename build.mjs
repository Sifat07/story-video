// story-video: renders <project>/scenes.json into <project>/out/<project>.mp4 (30 fps,
// 1080x1920 portrait or 1920x1080 landscape), plus storyboard.md, <project>.srt captions,
// sheet.jpg (visual check) and poster.jpg.
// Voice: ElevenLabs when ELEVENLABS_API_KEY is set (env or ~/.elevenlabs.env), else Kokoro (local,
// free, when kokoro-js is installed), else macOS `say`, else espeak-ng.
// VOICE=kokoro|say|espeak|elevenlabs picks one; any free VOICE forces a free draft.
// Usage: node build.mjs <project-dir>
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { cpus, homedir, platform } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { frameChecks, readFrames } from "./frames-check.mjs";

const skill = dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) throw new Error("usage: node build.mjs <project-dir>");
const here = resolve(process.argv[2]);
const out = join(here, "out");
const FPS = 30, LEAD = 0.25, TAIL = 0.45, END_HOLD = 1.6, MUSIC_TAIL = 8;
const FORMATS = { portrait: [1080, 1920], landscape: [1920, 1080] };
// ElevenLabs "George" (stock voice). Override with ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const { model: MODEL = "eleven_multilingual_v2", music: MUSIC_PROMPT, theme, colors, pronounce = {}, captions, format = "portrait", speed, tempo = 1, foreign = [], mode = "explainer",
  transition, reframe, scenes } = JSON.parse(readFileSync(join(here, "scenes.json"), "utf8"));
// mode "reel": faster pace and hard cuts by default; "explainer": calmer pace and fades.
const [WPM_LO, WPM_HI] = mode === "reel" ? [150, 185] : [130, 165];
for (const s of scenes) s.transition ??= transition ?? (mode === "reel" ? "cut" : "fade");
// Reels reframe each photo on every new sentence (template); explainers keep the slow push-in.
for (const s of scenes) s.reframe ??= reframe ?? mode === "reel";
if (!FORMATS[format]) throw new Error(`format must be one of: ${Object.keys(FORMATS).join(", ")}`);
const [W, H] = FORMATS[format];

const { chromium } = await import("playwright").catch(() => {
  throw new Error(`playwright missing: run \`npm install && npx playwright install chromium\` in ${skill}`);
});

function readKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const f = join(homedir(), ".elevenlabs.env");
  if (!existsSync(f)) return null;
  try { return readFileSync(f, "utf8").match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1].trim() || null; }
  catch (e) { console.warn(`can't read ${f} (${e.code}): no ElevenLabs`); return null; }
}
// A free draft never touches the key, so it can't bill by accident.
const KEY = ["kokoro", "say", "espeak"].includes(process.env.VOICE) ? null : readKey();
const has = cmd => spawnSync("which", [cmd]).status === 0;
// kokoro-js is an optional dependency: a failed install leaves the other voices working.
const kokoroJs = await import("kokoro-js").catch(() => null);
const ENGINE = process.env.VOICE ||
  (KEY ? "elevenlabs" : kokoroJs ? "kokoro" : platform() === "darwin" ? "say" : has("espeak-ng") ? "espeak" : null);
if (!ENGINE) throw new Error("no voice: set ELEVENLABS_API_KEY, or run `npm install` for Kokoro (free)");
if (ENGINE === "elevenlabs" && !KEY) throw new Error("VOICE=elevenlabs needs ELEVENLABS_API_KEY");
if (ENGINE === "kokoro" && !kokoroJs) throw new Error(`VOICE=kokoro needs kokoro-js: run \`npm install\` in ${skill}`);
if (!["elevenlabs", "kokoro", "say", "espeak"].includes(ENGINE)) throw new Error(`unknown VOICE=${ENGINE}`);

// out/ is rebuilt on every run, except out/versions/: every finished video is kept there as v1, v2, ...
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f !== "versions") rmSync(join(out, f), { recursive: true, force: true });
mkdirSync(join(out, "frames"));

const ff = (...args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const duration = f =>
  +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString();
// `pronounce` respells words the voice gets wrong, e.g. { "Gnocchi": "Nyokee" }.
const respell = text => Object.entries(pronounce).reduce((t, [w, say]) => t.replaceAll(w, say), text);
// Audio tags ("[whispers]", "[excited]") steer eleven_v3/v4. They are sent to ElevenLabs but
// never spoken by the free voices, shown in captions, or counted as words.
const TAG = /\[[^\]]*\]/g;
const untag = text => text.replace(TAG, " ").replace(/\s+/g, " ").trim();

// ElevenLabs lines are cached by voice + text in <project>/.voice-cache, so rebuilds that
// only change visuals (or a few lines) don't re-bill.
const cache = join(here, ".voice-cache");
let cachedLines = 0;
async function eleven(spoken, speed, model = MODEL) {
  const id = createHash("sha1").update(JSON.stringify([VOICE_ID, model, speed, spoken])).digest("hex").slice(0, 16);
  const f = join(cache, id + ".json");
  if (existsSync(f)) { cachedLines++; return JSON.parse(readFileSync(f, "utf8")); }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    // speed: 0.7-1.2 (ElevenLabs voice_settings), per scene or project-wide; 1 when unset.
    body: JSON.stringify({ text: spoken, model_id: model, ...(speed && { voice_settings: { speed } }) }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const r = await res.json();
  mkdirSync(cache, { recursive: true });
  writeFileSync(f, JSON.stringify(r));
  return r;
}

// Kokoro (82M, runs locally on the CPU). The model loads once (first run downloads ~90 MB) and
// returns audio only, so each sentence is voiced on its own: sentence starts are exact and the
// words inside a sentence are placed by character position. Returns per-character start times.
// Lines are cached in .voice-cache like ElevenLabs lines, so a visuals-only rebuild skips voicing.
let kokoroModel;
async function kokoro(spoken, file, speed) {
  const voiceName = process.env.KOKORO_VOICE || "bm_george";
  const hit = join(cache, createHash("sha1").update(JSON.stringify(["kokoro", voiceName, speed ?? 1, spoken])).digest("hex").slice(0, 16));
  if (existsSync(hit + ".json")) { cachedLines++; copyFileSync(hit + ".wav", file); return JSON.parse(readFileSync(hit + ".json", "utf8")); }
  kokoroModel ??= await kokoroJs.KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype: "q8", device: "cpu" });
  const pcm = [], starts = [];
  let t = 0, rate = 24000;
  for (const m of spoken.matchAll(/[^.!?]+[.!?]*\s*/g)) {
    const a = await kokoroModel.generate(m[0].trim(), { voice: voiceName, speed: speed ?? 1 });
    rate = a.sampling_rate;
    // Kokoro pads each sentence with ~0.35 s of silence; keep 0.15 s a side so sentences flow.
    const pad = Math.round(0.15 * rate), loud = [...a.audio.keys()].filter(i => Math.abs(a.audio[i]) > 0.01);
    const clip = a.audio.slice(Math.max(0, (loud[0] ?? 0) - pad), (loud.at(-1) ?? a.audio.length) + pad);
    const d = clip.length / rate;
    for (let c = 0; c < m[0].length; c++) starts[m.index + c] = t + c / m[0].length * d;
    pcm.push(clip);
    t += d;
  }
  const all = new Float32Array(pcm.reduce((n, a) => n + a.length, 0));
  pcm.reduce((o, a) => (all.set(a, o), o + a.length), 0);
  writeFileSync(file + ".f32", Buffer.from(all.buffer));
  ff("-f", "f32le", "-ar", String(rate), "-ac", "1", "-i", file + ".f32", "-ar", "44100", file);
  mkdirSync(cache, { recursive: true });
  copyFileSync(file, hit + ".wav");
  writeFileSync(hit + ".json", JSON.stringify(starts));
  return starts;
}

// Voices one scene into `file` (mono wav). Returns its length and when each word starts:
// exact from ElevenLabs timestamps, per sentence from Kokoro, else estimated from the word's character position.
// tempo: speeds up (or slows) the finished line without changing pitch, for models that
// ignore `speed` (eleven_v3/v4). Word times scale with it, so captions stay in sync.
async function voice(text, file, speed, tempo, model) {
  let spoken = respell(text);
  let starts = null;
  if (ENGINE === "elevenlabs") {
    const r = await eleven(spoken, speed, model);
    writeFileSync(file + ".mp3", Buffer.from(r.audio_base64, "base64"));
    ff("-i", file + ".mp3", "-ar", "44100", "-ac", "1", file);
    if (r.alignment?.characters.join("") === spoken) starts = r.alignment.character_start_times_seconds;
  } else spoken = untag(spoken);
  if (ENGINE === "kokoro") starts = await kokoro(spoken, file, speed);
  else if (ENGINE === "say") {
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
  // A sandboxed `say` writes a header and no sound, which would surface later as an ffmpeg NaN.
  if (!(d > 0)) throw new Error(`VOICE=${ENGINE} wrote no audio for "${text.slice(0, 40)}" (sandboxed?); try VOICE=espeak`);
  const spans = [...spoken.matchAll(/\[[^\]]*\]|\S+/g)].filter(m => !m[0].startsWith("["));
  // Show the written words (not respellings) when the word counts line up.
  const shown = untag(text).split(/\s+/).filter(Boolean);
  const words = spans.map((m, k) => ({
    w: shown.length === spans.length ? shown[k] : m[0],
    t: starts?.[m.index] ?? m.index / spoken.length * d,
    sp: m[0], ci: m.index, // the spoken word and where it sits in `spoken`, for alignWords()
  }));
  return { d, words, spoken };
}

// Exact word times for the free voices (optional, Apple Silicon): a forced aligner
// (Qwen3-ForcedAligner-0.6B via align.py, installed by align-setup.sh) finds when each known word
// is said in the finished line, tempo included. One Python process aligns every line not already in
// .voice-cache. A line keeps its estimate when the aligner is missing, the line isn't Latin script
// (the model has no Bangla), or its tokens don't map one-to-one onto our words. Kokoro lines are
// also clamped to each sentence's known window, so the worst case is today's estimate.
// Measured on 47 sentence starts: Kokoro 25 ms median (was 184 ms), say 20 ms (was 239 ms).
const ALIGN_PY = process.env.STORY_ALIGN_PYTHON || join(skill, ".align", "bin", "python");
const ALIGN_ID = "qwen3-forcedaligner-0.6b-8bit";
const alignNorm = w => w.normalize("NFKD").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
function mapTokens(words, tokens) {
  const toks = tokens.map(([w, t]) => [alignNorm(w), t]).filter(([w]) => w);
  let k = 0;
  const times = words.map(x => {
    const want = alignNorm(x.sp);
    if (!want) return null;
    let got = "", t = null;
    while (k < toks.length && got.length < want.length) { t ??= toks[k][1]; got += toks[k++][0]; }
    return got === want ? t : undefined;
  });
  return k === toks.length && !times.includes(undefined) ? times : null;
}
function alignWords(scenes) {
  const done = () => scenes.forEach(s => { delete s.spoken; s.words.forEach(x => { delete x.sp; delete x.ci; }); });
  if (ENGINE === "elevenlabs" || process.env.ALIGN === "0") return done();
  if (!existsSync(ALIGN_PY)) {
    console.log(`words: estimated inside sentences (VOICE=${ENGINE}); for exact word times run \`sh ${join(skill, "align-setup.sh")}\` (Apple Silicon)`);
    return done();
  }
  const latin = /^[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]*$/u;
  const lines = scenes.map(s => {
    if (!latin.test(s.spoken) || s.d > 170) return null;
    const wav = readFileSync(s.raw);
    const f = join(cache, "align-" + createHash("sha1").update(ALIGN_ID).update(s.spoken).update(wav).digest("hex").slice(0, 16) + ".json");
    return { s, f, tokens: existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null };
  });
  const todo = lines.filter(l => l && !l.tokens);
  if (todo.length) {
    const r = spawnSync(ALIGN_PY, [join(skill, "align.py")], {
      input: JSON.stringify({ jobs: todo.map(l => ({ wav: l.s.raw, text: l.s.spoken, language: "English" })) }),
      env: { ...process.env, HF_HUB_OFFLINE: "1" }, maxBuffer: 64 << 20, encoding: "utf8",
    });
    let res = null;
    try { if (r.status === 0) res = JSON.parse(r.stdout); } catch {}
    if (!res) console.log(`check: aligner failed, words estimated: ${(r.stderr || r.error?.message || "").trim().split("\n").at(-1)}`);
    else todo.forEach((l, k) => {
      if (res[k]) { mkdirSync(cache, { recursive: true }); writeFileSync(l.f, JSON.stringify(res[k])); l.tokens = res[k]; }
    });
  }
  let aligned = 0;
  for (const l of lines) {
    const times = l?.tokens && mapTokens(l.s.words, l.tokens);
    if (!times) continue;
    const { words, d } = l.s;
    // A sentence's window runs from its first word's start to the next sentence's. Kokoro voices
    // each sentence on its own, so its estimates there are exact (each clip leads with 0.15 s of
    // silence, which the aligner rightly skips); say and espeak only know the line's length.
    const first = words.map((x, k) => k === 0 || (ENGINE === "kokoro" && /[.!?]$/.test(words[k - 1].sp)));
    const win = words.map((_, k) => {
      let a = k; while (!first[a]) a--;
      let b = k + 1; while (b < words.length && !first[b]) b++;
      return ENGINE === "kokoro" ? [words[a].t, words[b]?.t ?? d] : [0, d];
    });
    const t = times.map((x, k) => x == null ? words[k].t : Math.min(Math.max(x, win[k][0]), win[k][1]));
    if (t.some((x, k) => k && x < t[k - 1])) continue; // out of order: keep the estimate
    words.forEach((x, k) => { x.t = t[k]; });
    l.s.timed = true;
    aligned++;
  }
  console.log(`words: aligned ${aligned}/${scenes.length} lines (forced aligner)`);
  done();
}

// 1. Voice each scene; scene length follows its narration.
console.log(`voice: ${ENGINE}`);
if (ENGINE !== "elevenlabs" && MUSIC_PROMPT && !existsSync(join(here, "music.mp3"))) console.log("music: skipped (needs ElevenLabs)");
let start = 0;
const parts = [];
const tc = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
// Words: "measured" when every word time came from the audio (ElevenLabs, or the aligner),
// "guessed~" when the words inside a sentence were spread by estimate.
const board = ["| Time | Scene | Purpose | Narration | On screen | wpm | Words |", "| --- | --- | --- | --- | --- | --- | --- |"];
for (const [i, s] of scenes.entries()) {
  s.raw = join(out, `vo-${i}.wav`);
  Object.assign(s, await voice(s.vo, s.raw, s.speed ?? speed, s.tempo ?? tempo, s.model ?? MODEL));
}
alignWords(scenes);
for (const [i, s] of scenes.entries()) {
  const raw = s.raw, padded = join(out, `seg-${i}.wav`);
  // Target words per minute (pauses included) by mode, judged on the voices that pace like a
  // final (ElevenLabs, Kokoro); say and espeak are too rough.
  const wpm = Math.round(s.words.length / s.d * 60);
  if (["elevenlabs", "kokoro"].includes(ENGINE) && (wpm < WPM_LO || wpm > WPM_HI)) console.log(`wpm: scene ${s.id} at ${wpm} (aim ${WPM_LO}-${WPM_HI})`);
  // Leave out parts timed (data-in without data-at) to appear after the scene ends: hidden spacers.
  const hidden = /<(\w+)(?![^>]*\sdata-at=)[^>]*\sdata-in="([\d.]+)"[^>]*>.*?<\/\1>/g;
  const shown = [s.kicker, s.title, s.sub].filter(Boolean)
    .map(h => h.replace(hidden, (m, _, t) => +t >= LEAD + s.d ? "" : m).replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").trim()).filter(Boolean).join(" / ");
  board.push(`| ${tc(start)} | ${s.id} | ${s.purpose ?? ""} | ${s.vo} | ${shown} | ${wpm} | ${ENGINE === "elevenlabs" || s.timed ? "measured" : "guessed~"} |`);
  s.start = start;
  // Reframe times from scene start: every sentence start, plus clause starts (after , ; :) that
  // fall 1.5 s or more from any other, so a long sentence still moves. The template uses them.
  const after = re => s.words.filter((_, k) => k && re.test(s.words[k - 1].w)).map(x => +(LEAD + x.t).toFixed(2));
  s.beats = after(/[.!?।]["'”’)»]*$/);
  for (const t of after(/[,;:]["'”’)»]*$/)) if ([0, ...s.beats].every(b => Math.abs(t - b) >= 1.5)) s.beats.push(t);
  s.beats.sort((x, y) => x - y);
  s.dur = LEAD + s.d + (i === scenes.length - 1 ? END_HOLD : TAIL);
  ff("-i", raw, "-af", `adelay=${LEAD * 1000}:all=1,apad=whole_dur=${s.dur}`, padded);
  parts.push(padded);
  start += s.dur;
}
if (cachedLines) console.log(`voice: ${cachedLines}/${scenes.length} lines from .voice-cache${ENGINE === "elevenlabs" ? " (not billed)" : ""}`);
const total = start;
writeFileSync(join(out, "storyboard.md"), board.join("\n") + "\n");
writeFileSync(join(out, "concat.txt"), parts.map(p => `file '${p}'`).join("\n"));
ff("-f", "concat", "-safe", "0", "-i", join(out, "concat.txt"), join(out, "narration.wav"));
console.log(`length: ${total.toFixed(1)} s`);

// 1b. Captions: one cue per clause (split at punctuation); a clause over one line (28
// characters portrait, whose captions keep clear of the Reels buttons; 34 landscape) splits into even parts. Always written as an .srt to upload; burned into
// the frames when scenes.json has "captions": true.
// `foreign`: phrases in another language ("mise en place", "Bon appétit!"), set in italics in captions.
const plain = w => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
for (const s of scenes) for (const f of foreign) {
  const want = f.split(/\s+/).map(plain).filter(Boolean), ws = s.words.map(x => plain(x.w));
  ws.forEach((_, k) => { if (want.length && want.every((w, j) => ws[k + j] === w)) want.forEach((_, j) => s.words[k + j].i = true); });
}
const cues = [], LINE = format === "portrait" ? 28 : 34;
const LEAN = /^(the|a|an|of|to|at|in|on|by|and|or|but|for|with|from|our|my|your|their|his|her|its)$/;
const line = ws => ws.map(x => x.w).join(" ");
for (const s of scenes) {
  const clauses = [[]];
  s.words.forEach((x, k) => { clauses.at(-1).push(x); if (/[.!?।;:,]$/.test(x.w) && k < s.words.length - 1) clauses.push([]); });
  // A tiny clause ("Online,") joins the next one when both fit on one line.
  for (let k = clauses.length - 2; k >= 0; k--)
    if (line(clauses[k]).length < 12 && line([...clauses[k], ...clauses[k + 1]]).length <= LINE)
      clauses.splice(k, 2, [...clauses[k], ...clauses[k + 1]]);
  const parts = clauses.flatMap(c => {
    const n = Math.ceil(line(c).length / LINE), target = line(c).length / n, out = [[]];
    for (const x of c) {
      if (out.at(-1).length && out.length < n && line([...out.at(-1), x]).length > target + 4) {
        // Never end a line on a word that starts the next phrase ("goes down the / far post").
        const prev = out.at(-1), carry = prev.length > 1 && LEAN.test(plain(prev.at(-1).w)) ? [prev.pop()] : [];
        out.push(carry);
      }
      out.at(-1).push(x);
    }
    return out;
  });
  parts.forEach((p, k) => cues.push({ si: scenes.indexOf(s),
    t0: s.start + LEAD + p[0].t, t1: s.start + LEAD + (parts[k + 1]?.[0].t ?? s.d), text: line(p),
    words: p.map(x => ({ w: x.w, t: s.start + LEAD + x.t, ...(x.i && { i: true }) })) }));
}
// A caption on screen under 5/6 s can't be read (Netflix's minimum: 20 frames at 24 fps). A short
// cue joins its neighbour in the same scene when the two fit on one line; a scene's last cue may
// stay up into the pause after it. What's left is a check below.
const MIN_CUE = 5 / 6;
const mate = k => [k + 1, k - 1].find(j => cues[j]?.si === cues[k].si && `${cues[k].text} ${cues[j].text}`.length <= LINE);
for (let k; (k = cues.findIndex((c, i) => c.t1 - c.t0 < MIN_CUE && mate(i) != null)) >= 0;) {
  const a = Math.min(k, mate(k)), b = a + 1;
  cues.splice(a, 2, { ...cues[a], t1: cues[b].t1, text: `${cues[a].text} ${cues[b].text}`, words: [...cues[a].words, ...cues[b].words] });
}
for (const [k, c] of cues.entries()) if (c.t1 - c.t0 < MIN_CUE && cues[k + 1]?.si !== c.si) {
  const s = scenes[c.si];
  c.t1 = Math.min(c.t0 + MIN_CUE, s.start + s.dur);
}
const srtTime = t => new Date(t * 1000).toISOString().slice(11, 23).replace(".", ",");
writeFileSync(join(out, `${basename(here)}.srt`),
  cues.map((c, k) => `${k + 1}\n${srtTime(c.t0)} --> ${srtTime(c.t1)}\n${c.text}\n`).join("\n"));
// 1c. Timing checks on the measured voice. Reel: the first sentence (the hook) is said inside 3 s.
// Captions: at most 20 characters a second, 17 in a reel, where viewers read muted, often in a
// second language (Netflix English Timed Text Style Guide: adults 20, children 17).
if (mode === "reel") {
  const s = scenes[0], k = s.words.findIndex(x => /[.!?।]["'”’)»]*$/.test(x.w));
  const hook = LEAD + (s.words[k + 1]?.t ?? s.d);
  if (hook > 3) console.log(`check: scene ${s.id}: the hook (first sentence) takes ${hook.toFixed(1)} s to say: cut it to land inside 3 s`);
}
const CPS = mode === "reel" ? 17 : 20;
for (const c of cues) {
  const cps = c.text.length / (c.t1 - c.t0);
  if (c.t1 - c.t0 < MIN_CUE - 1 / FPS) console.log(`check: at ${tc(c.t0)} caption "${c.text}" is up for ${(c.t1 - c.t0).toFixed(2)} s (min ${MIN_CUE.toFixed(2)}): too quick to read; join the clause to its neighbour (drop the comma) or say it slower`);
  else if (cps > CPS) console.log(`check: at ${tc(c.t0)} caption "${c.text}" reads at ${Math.round(cps)} characters/s (max ${CPS}): slow the voice (tempo) or say less`);
}

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
  chunks.at(-1).duration_ms += MUSIC_TAIL * 1000;
  return { chunks };
}

// 1c. Music bed: generated once (ElevenLabs Music) and reused, so re-renders cost no credits.
// A track shorter than the cut loops. Delete music.mp3 to regenerate, or drop in your own.
// ElevenLabs fades its last section out whatever the prompt says, so ask for MUSIC_TAIL s more
// than the cut; the mix trims it to the video.
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
      : { prompt: MUSIC_PROMPT, music_length_ms: Math.ceil(total + MUSIC_TAIL) * 1000, force_instrumental: true }),
  });
  if (!res.ok) throw new Error(`ElevenLabs music ${res.status}: ${(await res.text()).slice(0, 200)}`);
  writeFileSync(music, Buffer.from(await res.arrayBuffer()));
  writeFileSync(music + ".id", planId);
}
let soundtrack = join(out, "narration.wav");
if (existsSync(music)) {
  // Generated music can drop to silence mid-track; a hole under the voice is easy to miss.
  const err = spawnSync("ffmpeg", ["-t", String(total - END_HOLD), "-i", music, "-af", "silencedetect=noise=-45dB:d=1", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  for (const [, t] of err.matchAll(/silence_start: ([\d.]+)/g))
    console.log(`music: silent from ${(+t).toFixed(1)} s: regenerate, or splice a bar over it with ffmpeg atrim/acrossfade`);
  // Duck the music under the voice, fade it out over the end hold. The ducked music is kept
  // on its own too (music-ducked.wav), to measure how far under the voice it sits.
  soundtrack = join(out, "mix.wav");
  const ducked = join(out, "music-ducked.wav");
  ff("-i", join(out, "narration.wav"), "-stream_loop", "-1", "-i", music, "-filter_complex",
    "[0]aformat=channel_layouts=stereo,asplit[v][sc];" +
    `[1]volume=0.5,afade=t=out:st=${(total - 2.5).toFixed(2)}:d=2.5[m];` +
    "[m][sc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350,asplit[d][dm];" +
    "[v][d]amix=inputs=2:duration=first:normalize=0[mix]",
    "-map", "[mix]", soundtrack, "-map", "[dm]", "-t", total.toFixed(3), ducked);
  musicChecks(join(out, "narration.wav"), ducked);
}

// Music checks on the measured audio.
// - Margin: while the voice speaks, the ducked music should sit at least 10 dB under it, or
//   words blur on a phone speaker. Per scene, the median over 25 ms steps where the voice is on.
// - Beat, only when the music has a steady pulse (the rise in loudness repeats at one period
//   between 0.3 and 1 s; ambient beds don't, and are left alone): onsets are sudden rises
//   (3 dB+ in 30 ms, a peak within 80 ms); a cut lands on the beat within 70 ms of one. Random
//   cuts would hit as often as the onsets' ±70 ms windows cover the timeline: that is the bar.
function levels(input, step) {
  const r = spawnSync("ffmpeg", ["-v", "error", ...input, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  const x = new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + r.stdout.length));
  const H = Math.round(16000 * step), db = [];
  for (let i = 0; i + H <= x.length; i += H) { let e = 0; for (let j = i; j < i + H; j++) e += x[j] * x[j]; db.push(10 * Math.log10(e / H + 1e-12)); }
  return db;
}
function musicChecks(voiceFile, duckedFile) {
  const STEP = 0.025, MARGIN = 10, TOL = 0.07, PULSE = 0.35;
  const v = levels(["-i", voiceFile], STEP), m = levels(["-i", duckedFile], STEP), on = Math.max(...v) - 25;
  const med = a => a.sort((x, y) => x - y)[a.length >> 1];
  const margins = scenes.map(s => {
    const a = Math.floor((s.start + LEAD) / STEP), b = Math.floor((s.start + LEAD + s.d) / STEP), gaps = [];
    for (let k = a; k < b && k < v.length && k < m.length; k++) if (v[k] > on) gaps.push(v[k] - m[k]);
    return gaps.length ? med(gaps) : null;
  });
  const low = margins.map((g, k) => [g, scenes[k]]).filter(([g]) => g != null).sort((x, y) => x[0] - y[0])[0];
  if (low) console.log(`music: sits ${Math.round(med(margins.filter(g => g != null)))} dB under the voice while it speaks (least: scene ${low[1].id}, ${low[0].toFixed(1)} dB)`);
  for (const [k, g] of margins.entries()) if (g != null && g < MARGIN)
    console.log(`check: scene ${scenes[k].id}: the music sits only ${g.toFixed(1)} dB under the voice (want ${MARGIN}+): lower it, or pick a calmer stretch`);
  // Beat, on the music as it plays (looped, before ducking: ducking itself makes rises).
  const cuts = scenes.slice(1).map(s => s.start);
  if (cuts.length < 3) return;
  const e = levels(["-stream_loop", "-1", "-i", music, "-t", total.toFixed(3)], 0.01);
  const rise = e.map((x, k) => k >= 3 ? Math.max(0, x - e[k - 3]) : 0);
  const mean = rise.reduce((a, b) => a + b, 0) / rise.length;
  const sd = Math.sqrt(rise.reduce((a, b) => a + (b - mean) ** 2, 0) / rise.length);
  const c = rise.map(x => x - mean), z = c.reduce((a, b) => a + b * b, 0) || 1;
  let pulse = 0, period = 0;
  for (let L = 30; L <= 100; L++) {
    let s = 0;
    for (let k = 0; k + L < c.length; k++) s += c[k] * c[k + L];
    if (s / z > pulse) [pulse, period] = [s / z, L / 100];
  }
  if (pulse < PULSE) return console.log(`music: no steady beat (pulse ${pulse.toFixed(2)}, under ${PULSE}), so cuts aren't checked against it`);
  const onsets = [];
  for (let k = 1; k < rise.length; k++)
    if (rise[k] > Math.max(3, mean + 1.5 * sd) && rise.slice(Math.max(0, k - 8), k + 9).every(x => x <= rise[k])) onsets.push(k / 100);
  const hits = cuts.filter(t => onsets.some(o => Math.abs(o - t) <= TOL)).length;
  let cover = 0, edge = 0;
  for (const o of onsets) { const a = Math.max(o - TOL, edge), b = Math.min(o + TOL, total); if (b > a) cover += b - a; edge = Math.max(edge, b); }
  const chance = cover / total * cuts.length;
  console.log(`music: beat every ${period.toFixed(2)} s; ${hits}/${cuts.length} cuts land on one (within ${TOL * 1000} ms), where random cuts would land ${chance.toFixed(1)}`);
  if (hits <= chance && !musicPlan())
    console.log(`check: the cuts ignore the music's beat (${hits}/${cuts.length}, chance ${chance.toFixed(1)}): give scenes "music" lines so the score follows the cuts, or let it be if the music is a bed`);
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
// (scene start when no "at"). Each stops at its scene's end with a short fade, so a long
// roar never plays over the next scene's voice. Free drafts use cached effects only.
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
  const t = s.start + (e.at ? spokenAt(s, e.at) : 0);
  if (existsSync(f)) effects.push({ f, t, len: Math.max(0.5, s.start + s.dur - t), gain: e.gain ?? 0.5 });
}
if (effects.length) {
  const mixed = join(out, "mix-sfx.wav");
  ff("-i", soundtrack, ...effects.flatMap(e => ["-i", e.f]), "-filter_complex",
    effects.map((e, k) => `[${k + 1}]aformat=channel_layouts=stereo,volume=${e.gain},atrim=0:${e.len.toFixed(2)},afade=t=out:st=${Math.max(0, e.len - 0.4).toFixed(2)}:d=0.4,adelay=${Math.round(e.t * 1000)}:all=1[s${k}];`).join("") +
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
// 2a. Checks before the long render: layout on each settled frame (the template's optional
// window.check), and in a reel any photo held still over 3 s. Warnings only.
for (const s of scenes) {
  const warn = [];
  if (await pages[0].evaluate(() => !!window.check)) {
    await pages[0].evaluate(t => window.render(t), settled(s));
    warn.push(...await pages[0].evaluate(() => window.check()));
  }
  // Longest stretch with nothing new: photos switch in equal slices, reframes come on sentences.
  const still = (s.photos ?? []).filter(f => !f.endsWith(".svg"));
  if (mode === "reel" && still.length && still.length === s.photos.length) {
    const at = [0, ...still.map((_, k) => k * s.dur / still.length), ...(s.reframe ? s.beats : []), s.dur].sort((a, b) => a - b);
    const hold = Math.max(...at.slice(1).map((t, k) => t - at[k]));
    if (hold > 3) warn.push(`one photo holds ${hold.toFixed(1)} s unchanged: split the sentence, add a second photo, or put it in an SVG with a data-focus camera`);
  }
  for (const w of warn) console.log(`check: scene ${s.id}: ${w}`);
}
// Match cuts: across a hard cut the camera keeps its direction (a pan doesn't reverse, a push-in
// doesn't cut to a pull-out). Motion over the 3 frames each side; still-to-moving is fine.
if (await pages[0].evaluate(() => !!window.cameraAt)) for (const [i, s] of scenes.slice(0, -1).entries()) {
  const n = scenes[i + 1], end = n.start - 1 / FPS;
  if (n.transition !== "cut") continue;
  const cam = t => pages[0].evaluate(t => window.cameraAt(t), t);
  const [a0, a1, b0, b1] = [await cam(end - 3 / FPS), await cam(end), await cam(n.start), await cam(n.start + 3 / FPS)];
  if (!a0 || !b0) continue;
  // [axis, said when it rises first, said when it falls first]
  const flips = [[0, "pans right then left", "pans left then right"], [1, "tilts down then up", "tilts up then down"], [2, "pushes in then pulls out", "pulls out then pushes in"]]
    .filter(([j]) => Math.abs(a1[j] - a0[j]) > 0.002 && Math.abs(b1[j] - b0[j]) > 0.002 && Math.sign(a1[j] - a0[j]) !== Math.sign(b1[j] - b0[j]))
    .map(([j, rise, fall]) => a1[j] > a0[j] ? rise : fall);
  for (const w of flips) console.log(`check: cut ${s.id}→${n.id}: camera ${w}`);
}
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
// 2d. Review sheet: 20 evenly spaced frames at phone size, for the scored review in SKILL.md.
mkdirSync(join(out, "review"));
for (let k = 0; k < 20; k++)
  copyFileSync(frameFile(Math.floor((k + 0.5) * frames / 20)), join(out, "review", `${String(k).padStart(2, "0")}.jpg`));
// Under it, the soundtrack as a waveform: a tick on top at each word, an accent line at each cut,
// so a gap, a late word or music swamping the voice shows at a glance.
{
  const W = (format === "portrait" ? 270 : 480) * 5, H = 140, x = t => Math.round(t / total * W);
  const ticks = scenes.flatMap(s => s.words.map(w => `drawbox=x=${x(s.start + LEAD + w.t)}:y=0:w=1:h=16:c=white:t=fill`));
  const lines = scenes.slice(1).map(s => `drawbox=x=${x(s.start)}:y=0:w=2:h=${H}:c=0xe0a94f:t=fill`);
  ff("-i", join(out, "review", "%02d.jpg"), "-i", soundtrack, "-filter_complex",
    `[0]scale=${W / 5}:-1,tile=5x4[r];[1]showwavespic=s=${W}x${H}:colors=0x6cc4a1:scale=sqrt,format=rgb24,${[...ticks, ...lines].join(",")}[w];[r][w]vstack`,
    "-frames:v", "1", join(out, "review.jpg"));
}
rmSync(join(out, "review"), { recursive: true });
// 2e. Measured checks on the frames themselves (frames-check.mjs): one-frame flashes, two- or
// three-frame pops, a picture that is one flat colour for 0.4 s or more (black, white or the
// background: something didn't load), and in a reel a screen where nothing changes (captions
// count) for over 2 s before the end hold.
{
  const { flashes, pops, blanks, stills } = frameChecks(readFrames(["-framerate", String(FPS), "-i", join(out, "frames", "%05d.jpg")]), 2 * FPS, Math.round(0.4 * FPS));
  const at = f => `scene ${scenes.findLast(s => s.start <= f / FPS).id}: at ${tc(f / FPS)}`;
  for (const f of flashes) console.log(`check: ${at(f)} one frame differs from both neighbours (a flash): look for a part that shows a frame early`);
  for (const [a, b] of pops) console.log(`check: ${at(a)} ${b - a + 1} frames pop out of what's around them: look for a part that shows early or a photo that flickers`);
  for (const [a, b, mean] of blanks) console.log(`check: ${at(a)} the picture is flat ${mean < 40 ? "black" : mean > 215 ? "white" : "colour"} for ${((b - a + 1) / FPS).toFixed(1)} s: a photo or diagram that didn't load, or an empty gap between scenes`);
  if (mode === "reel") for (const [a, b] of stills) {
    const end = Math.min(b + 1, Math.floor((total - END_HOLD) * FPS));
    if (end - a >= 2 * FPS) console.log(`check: ${at(a)} nothing moves for ${((end - a) / FPS).toFixed(1)} s: add a camera move, a part on a word, or a cut`);
  }
}
copyFileSync(join(out, "poster.jpg"), frameFile(0));

// 3. Encode. Frames are full-range JPEGs; Instagram and Facebook can wash out a full-range
// (yuvj420p) upload, so convert to limited-range BT.709 and tag it, then check the file.
// Loudness in two passes: measure the soundtrack, then apply loudnorm with those numbers as one
// steady gain (linear), so it lands on -14 LUFS without pumping. When one gain can't (peaks would
// pass -1.5 dBTP, or the range is over 11 LU), loudnorm falls back to its dynamic mode by itself;
// a dry run of pass two says which. The file is measured after.
const mp4 = join(out, `${basename(here)}.mp4`);
const LOUD = "I=-14:TP=-1.5:LRA=11";
const loudness = (f, af = `loudnorm=${LOUD}`) => {
  const e = spawnSync("ffmpeg", ["-hide_banner", "-i", f, "-vn", "-af", `${af}:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr;
  try { const j = JSON.parse(e.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]); return isFinite(+j.input_i) ? j : null; } catch { return null; }
};
const m = loudness(soundtrack);
const loudnorm = m ? `loudnorm=${LOUD}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true` : `loudnorm=${LOUD}`;
const loudMode = m ? loudness(soundtrack, loudnorm)?.normalization_type : "dynamic: the soundtrack couldn't be measured";
ff("-framerate", String(FPS), "-i", join(out, "frames", "%05d.jpg"), "-i", soundtrack,
  "-vf", "scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p",
  "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
  "-c:v", "libx264", "-profile:v", "high", "-crf", "18", "-af", loudnorm, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest",
  "-movflags", "+faststart", mp4);
const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_name,pix_fmt,color_range,color_space", "-of", "compact=p=0:nk=1", mp4]).toString().trim().split("\n");
if (!probe[0].startsWith("h264|yuv420p|tv|bt709") || !probe.some(l => l.startsWith("aac")))
  console.log(`check: ${basename(mp4)} is not upload-safe (${probe.join(", ")}): want h264|yuv420p|tv|bt709 plus aac`);
const got = loudness(mp4);
if (got) {
  console.log(`audio: ${(+got.input_i).toFixed(1)} LUFS, true peak ${(+got.input_tp).toFixed(1)} dBTP (aim -14, at most -1), ${loudMode === "linear" ? "one steady gain" : loudMode ?? "mode unknown"}`);
  if (Math.abs(+got.input_i + 14) > 1 || +got.input_tp > -1)
    console.log(`check: ${basename(mp4)} is at ${(+got.input_i).toFixed(1)} LUFS, true peak ${(+got.input_tp).toFixed(1)} dBTP: platforms turn it ${+got.input_i > -14 ? "down" : "up"}; look for one loud effect or a clipped music.mp3`);
}
rmSync(join(out, "frames"), { recursive: true });
const versions = join(out, "versions");
mkdirSync(versions, { recursive: true });
const version = join(versions, `v${readdirSync(versions).filter(f => f.endsWith(".mp4")).length + 1}.mp4`);
copyFileSync(mp4, version);
// A voice that sounds human: some platforms want realistic AI audio labelled, so remind at the end, where it is seen.
if (["elevenlabs", "kokoro"].includes(ENGINE)) console.log(`voice: AI voice (${ENGINE}); say so when you post it (e.g. the platform's AI label or a line in the caption)`);
console.log(`done: ${mp4} (kept as ${version})`);
