# story-video

An agent skill that explains a topic four ways: **plain writing → one diagram → an interactive page → a narrated video** (vertical 1080×1920 or landscape 1920×1080, 30 fps). The video is rendered from a short `scenes.json`: each scene is voiced, timed to its narration, drawn frame by frame in a headless browser and encoded with ffmpeg. Diagram parts appear on the word that names them (`data-at="five paid"`), and captions come from the same word timings.

<p>
  <img src="examples/reserved-stock/preview.gif" width="300" alt="The example's diagram building up in step with the narration, with captions">
  <img src="examples/reserved-stock/poster.jpg" width="300" alt="Poster frame of the example">
</p>

The full example (84 s, with voice and music) is in [`examples/reserved-stock`](examples/reserved-stock): run the build to get the mp4.

## Install

```bash
git clone https://github.com/Sifat07/story-video ~/.claude/skills/story-video   # or ~/.agents/skills/story-video
cd ~/.claude/skills/story-video
npm install
npx playwright install chromium   # ~150 MB download
```

Needs Node 20+, `ffmpeg` and `ffprobe` on your PATH (`brew install ffmpeg`, `apt install ffmpeg`), and network access (fonts load from Google Fonts).

Then ask your agent to "explain how X works" or "make a reel about Y". It reads `SKILL.md` and runs the stages. For a reel or story it first writes `script.md` with `story.md`: one real moment, three hooks, beats and a draft for you to approve before anything is rendered.

## Render by hand

```bash
VOICE=kokoro node ~/.claude/skills/story-video/build.mjs path/to/project   # free draft
node ~/.claude/skills/story-video/build.mjs path/to/project             # final
```

`path/to/project` holds `scenes.json` and `photos/`. Output lands in `path/to/project/out/`: `<project>.mp4`, `<project>.srt`, `poster.jpg`, `sheet.jpg` (a contact sheet for checking every scene), `review.jpg` (20 evenly spaced frames for a scored review, over the soundtrack's waveform with a tick at each word and a line at each cut) and `storyboard.md`, plus intermediate audio files. `out/` is rebuilt on every run, except `out/versions/`, which keeps every finished video as `v1.mp4`, `v2.mp4`, …; frames render in four browser pages at once (about a minute for a 80 s video on a laptop). Set `"format": "landscape"` for 16:9 and `"captions": true` to burn captions in. See `SKILL.md` for every `scenes.json` field, and `examples/` for a complete project.

Before the long render, each build prints `check:` warnings from one settled frame per scene: text off the frame or crowding the picture, captions over text, photos shown over 1.5× their pixels, reel photos unchanged for over 3 s, a camera that reverses across a hard cut, captions faster than 20 characters a second (17 in a reel) or up for under 0.83 s, and a reel hook over 3 s. With a `music.mp3`: music under 10 dB below the voice while it speaks, and, when the music has a steady beat, cuts that land on it no more often than chance. In a reel, each photo reframes on every sentence. `STILLS=1 VOICE=kokoro node build.mjs examples/check-fixture` shows every one. A full render adds checks measured on the frames (a flash, a two- or three-frame pop, a picture flat black or white for 0.4 s, a still reel screen) and on the file: it is normalised to -14 LUFS in two passes (measured, then one steady gain) and prints its measured loudness and true peak.

## Voice and cost

| Voice | When | Cost |
| --- | --- | --- |
| Kokoro (local, 82M) | No key and `kokoro-js` installed (an optional dependency of `npm install`), or `VOICE=kokoro`. `KOKORO_VOICE` picks the voice (default `bm_george`; others such as `bm_daniel`, `bf_emma`, `am_michael`, `af_heart`) | Free; natural, runs on the CPU (about half real time). First run downloads ~90 MB. Sentence starts are exact, words inside a sentence estimated (exact with the optional aligner) |
| macOS `say` | No key and no Kokoro on macOS, or `VOICE=say` | Free |
| espeak-ng | No key and no Kokoro elsewhere (`apt install espeak-ng`), or `VOICE=espeak` | Free, robotic; fine for drafts |
| ElevenLabs | `ELEVENLABS_API_KEY` in the environment or `~/.elevenlabs.env` | Billed per new line. Lines are cached in `<project>/.voice-cache/`, so rebuilds re-bill only changed text |
| ElevenLabs Music | Key set and `scenes.json` has `music` | Billed once; saved as `music.mp3` and reused (looped if the cut grows) |

ElevenLabs returns exact word times. The free voices estimate them unless the optional aligner is installed. The key is read, never printed.

### Exact word times for the free voices (optional, Apple Silicon)

```bash
sh ~/.claude/skills/story-video/align-setup.sh
```

This installs a forced aligner ([Qwen3-ForcedAligner-0.6B](https://huggingface.co/Qwen/Qwen3-ForcedAligner-0.6B), Apache-2.0, 8-bit MLX build) into `.align/`: about 450 MB for [mlx-audio](https://github.com/Blaizzy/mlx-audio) (MIT) plus about 1.3 GB for the model in the Hugging Face cache. It uses `uv` if present, else `python3 -m venv`. After that, every Kokoro, `say` or espeak build finds when each word is actually said, so `data-at` parts and lit caption words land on the word. It takes about 3 s per build to load, plus half a second per new line, and results are cached in `.voice-cache/`. Builds run with the Hugging Face hub offline, so a build never downloads the model.

Measured on 47 sentence starts across 24 lines, against each sentence's known start:

| Voice | Estimate (before) | Aligned |
| --- | --- | --- |
| Kokoro | 184 ms median, 463 ms p90 | 25 ms median, 49 ms p90 |
| `say` | 239 ms median, 479 ms p90 | 20 ms median, 43 ms p90 |

On 1,678 ElevenLabs words, against ElevenLabs' own timestamps, the aligner's median error was 40 ms.

English (Latin-script) lines only: the model knows 11 languages and Bengali is not one of them, so other lines keep the estimate. A line also keeps its estimate if the aligner's words don't match the script one for one. Kokoro lines are clamped to each sentence's known window. `ALIGN=0` turns it off, `STORY_ALIGN_PYTHON` points at another Python with mlx-audio, and `rm -rf .align` removes it. Only the MLX path (Apple Silicon) is supported and tested.

## Credits

- The four-form ladder (controlled-English writing, diagrams, HTML pages, explainer videos) comes from [Andrej Karpathy's post on X](https://x.com/karpathy/status/2105819303471976479) (2 October 2026) on understanding language-model output.
- The staged structure was inspired by a "learning studio" prompt shared by @0xCarnagee. The wording here is our own.
- Motion rules, the spring, style frames and the avoid list are adapted from [garden-skills](https://github.com/ConardLi/garden-skills) `motion-showreel` (MIT).
- Not affiliated with or endorsed by any of them.

## License

MIT
