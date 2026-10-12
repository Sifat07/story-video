# story-video

An agent skill that explains a topic four ways: **plain writing → one diagram → an interactive page → a narrated vertical video** (1080×1920, 30 fps). The video is rendered from a short `scenes.json`: each scene is voiced, timed to its narration, drawn frame by frame in a headless browser (diagrams build up part by part with the narration) and encoded with ffmpeg.

![Poster frame from the example](examples/reserved-stock/poster.jpg)

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
VOICE=say node ~/.claude/skills/story-video/build.mjs path/to/project   # free draft
node ~/.claude/skills/story-video/build.mjs path/to/project             # final
```

`path/to/project` holds `scenes.json` and `photos/`. Output lands in `path/to/project/out/`: `<project>.mp4`, `poster.jpg`, `sheet.jpg` (a contact sheet for checking every scene) and `storyboard.md`, plus intermediate audio files. `out/` is rebuilt on every run. See `SKILL.md` for every `scenes.json` field, and `examples/` for a complete project.

## Voice and cost

| Voice | When | Cost |
| --- | --- | --- |
| macOS `say` | No key, or `VOICE=say` | Free. macOS only |
| ElevenLabs | `ELEVENLABS_API_KEY` in the environment or `~/.elevenlabs.env` | Text-to-speech is billed **every build** (all scenes are re-voiced) |
| ElevenLabs Music | Key set and `scenes.json` has `music` | Billed once; saved as `music.mp3` and reused |

On Linux or Windows without a key, the build stops with a message: there is no free voice there yet. The key is read, never printed.

## Credits

- The four-form ladder (controlled-English writing, diagrams, HTML pages, explainer videos) comes from [Andrej Karpathy's post on X](https://x.com/karpathy/status/2105819303471976479) (2 October 2026) on understanding language-model output.
- The staged structure was inspired by a "learning studio" prompt shared by @0xCarnagee. The wording here is our own.
- Not affiliated with or endorsed by either.

## License

MIT
