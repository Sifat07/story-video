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

Then ask your agent to "explain how X works" or "make a reel about Y". It reads `SKILL.md` and runs the stages.

## Render by hand

```bash
VOICE=kokoro node ~/.claude/skills/story-video/build.mjs path/to/project   # free draft
node ~/.claude/skills/story-video/build.mjs path/to/project             # final
```

`path/to/project` holds `scenes.json` and `photos/`. Output lands in `path/to/project/out/`: `<project>.mp4`, `<project>.srt`, `poster.jpg`, `sheet.jpg` (a contact sheet for checking every scene) and `storyboard.md`, plus intermediate audio files. `out/` is rebuilt on every run; frames render in four browser pages at once (about a minute for a 80 s video on a laptop). Set `"format": "landscape"` for 16:9 and `"captions": true` to burn captions in. See `SKILL.md` for every `scenes.json` field, and `examples/` for a complete project.

Before the long render, each build prints `check:` warnings from one settled frame per scene: text off the frame or crowding the picture, captions over text, photos shown over 1.5× their pixels, and reel photos held over 3 s. `STILLS=1 VOICE=kokoro node build.mjs examples/check-fixture` shows every one.

## Voice and cost

| Voice | When | Cost |
| --- | --- | --- |
| Kokoro (local, 82M) | No key and `kokoro-js` installed (an optional dependency of `npm install`), or `VOICE=kokoro`. `KOKORO_VOICE` picks the voice (default `bm_george`; others such as `bm_daniel`, `bf_emma`, `am_michael`, `af_heart`) | Free; natural, runs on the CPU (about half real time). First run downloads ~90 MB. Sentence starts are exact, words inside a sentence estimated |
| macOS `say` | No key and no Kokoro on macOS, or `VOICE=say` | Free |
| espeak-ng | No key and no Kokoro elsewhere (`apt install espeak-ng`), or `VOICE=espeak` | Free, robotic; fine for drafts |
| ElevenLabs | `ELEVENLABS_API_KEY` in the environment or `~/.elevenlabs.env` | Billed per new line. Lines are cached in `<project>/.voice-cache/`, so rebuilds re-bill only changed text |
| ElevenLabs Music | Key set and `scenes.json` has `music` | Billed once; saved as `music.mp3` and reused (looped if the cut grows) |

Free voices estimate word timings; ElevenLabs returns exact ones. The key is read, never printed.

## Credits

- The four-form ladder (controlled-English writing, diagrams, HTML pages, explainer videos) comes from [Andrej Karpathy's post on X](https://x.com/karpathy/status/2105819303471976479) (2 October 2026) on understanding language-model output.
- The staged structure was inspired by a "learning studio" prompt shared by @0xCarnagee. The wording here is our own.
- Motion rules, the spring, style frames and the avoid list are adapted from [garden-skills](https://github.com/ConardLi/garden-skills) `motion-showreel` (MIT).
- Not affiliated with or endorsed by any of them.

## License

MIT
