---
name: story-video
description: Use when the user wants a topic explained or taught (an explainer, "help me understand X", a learning page), or wants a narrated video, reel, story or short (9:16 or 16:9) about a project, event, history, milestone or how something works.
---

# story-video

## Overview

Understanding climbs a ladder of four forms: **plain writing → one diagram → an interactive page → a narrated video**. Each form is built from the one below and must make the idea clearer, not prettier. Show a concrete case first, name it second. If a detail is missing, decide and continue.

Everything for one piece lives in a project folder (any path; create it): `explanation.md`, `script.md`, `diagram.svg`, `page.html`, `scenes.json`, `photos/`, optional `logo.png` and `music.mp3`, and the build output in `out/`. `<skill>` below means this skill's folder.

**Pick a mode**
- **Explain** (default for "explain / teach X"): all four forms.
- **Just enough** (when asked to keep it light): write first; add the next form only if the idea is still not clear.
- **Reel** (the story is already known, the user wants a video): write `script.md` with `<skill>/story.md`, then go to the video.

## 1. Writing → `explanation.md`

Write in controlled English, a softened form of ASD-STE100: short sentences in active voice, one statement each, the same word for the same thing every time, each term defined before its first use. Keep facts, assumptions and examples visibly apart. No hype.

Walk the reader through: the question → what they already know → what goes wrong → how it works → what happens as a result → the usual wrong belief → why it matters → a short recap.

Deliver: a one-line goal, the explanation (body 150–250 words), five facts, three defined terms, one common misconception, one example (real, or clearly labelled as made up), and sources for every claim. For general practice with no single source, cite reference pages and write "many …" rather than claim it is universal. The diagram's alt text, relationship list and accessibility notes go in this file too.

**Check:** someone skimming finds the main idea within 20 seconds. If not, rewrite.

## 2. Diagram → `diagram.svg`

Choose the shape that fits the idea (flow, states, system map, timeline, comparison, layers, cause and effect) and draw only one. It reads in one direction, has no more than seven main parts, every arrow means one named thing, labels make sense without narration, and it still works in grayscale. Ship the SVG, alt text, and a list of the relationships it shows.

The same SVG feeds the page and the video, so: transparent background, at least 5% margin inside the `viewBox`, `id`s on anything the page changes, real `<text>`, plus `<title>` and `<desc>`.

**Motion (video):** the video inlines SVGs, so tagged parts build up in step with the narration:
- `data-at="five paid"`: fades in (rising slightly) when the scene's narration says that phrase. One word or several, matched against that scene's narration ignoring case and punctuation (so "p.m." is the one word `pm`: `data-at="nine pm"`); use one that occurs once in the scene. A missing phrase stops the build. Add `data-in="0.3"` to delay it by 0.3 s. Put it on a `<g>` to move a group.
- `data-in="2.4"` alone: fades in at 2.4 s from the scene start (for parts no word introduces, like a heading at 0.6).
- `data-out="6"`: fades out at 6 s.
- `data-focus="1.4"` (with `data-at`): the camera zooms to that part (1.4×) and pans to it when its phrase is spoken, then moves on to the next focus. `data-focus="1"` pulls back to the whole diagram. Fit the zoomed part inside the frame: at 1.4× a part may be at most ~70% of the diagram's width.
- `class="draw"` on a `path`, `line`, `polyline`, `rect` or `circle`: the stroke traces itself from its `data-at` (or `data-in`) time over `data-dur` (default 0.8 s). Arrowheads fade in with it.
- `data-from="dx dy scale rotate"` (with `data-at` or `data-in`): springs the part in from that offset, e.g. `"0 0 1.9 4"` slams a stamp down, `"-420 40 1 -9"` slides a print in.
- `data-wipe="left|up|iris"` (with `data-at` or `data-in`): reveals the part through a moving edge over `data-dur` (default 0.8 s). Good for a letter line or a quote being read out. A wiped group is isolated, so put `mix-blend-mode` on the group, not on the image inside it.
- `data-stagger="0.03"` on a `<g>` with `data-at`/`data-in`: its children appear one after another, 0.03 s apart, in document order (sort them, e.g. west to east, for a sweep). Keep the total under ~2.5 s.
- **Camera on a photo:** wrap the photo in an SVG (`<image href="x.jpg">` at the photo's pixel size; `href` is relative to the SVG, so a photo beside it in `photos/` is just its name) and add invisible `<rect data-at="…" data-focus="1.6" fill="none">` over the faces or the flag; the camera moves there when the phrase is spoken. No template change.

Word times are exact with ElevenLabs, exact per sentence with Kokoro, and estimated with `say` and espeak, so drafts are close but not exact. Keep a static copy for the page and for recap scenes. Untagged SVGs are shown whole.

**Check:** after one glance, a viewer can say the main relationship out loud.

## 3. Interactive page → `page.html`

One self-contained responsive file: semantic HTML, visible focus, respects `prefers-reduced-motion`, no needless libraries. It holds the opening question, the diagram, the explanation revealed step by step, **one** interaction, a reset, a text-only alternative and a recap. The interaction moves one real input, makes the mechanism visible, puts two states side by side and says why they differ. Controls that teach nothing do not belong.

**Check:** usable on a phone and a desktop, by keyboard alone, at the smallest, typical and largest input, after many resets, and still teaches with motion turned off.

## 4. Video → `out/<folder>.mp4`

Set `"mode"` to match where the video plays. The two are paced differently, and a reel paced like an explainer is boring.

| | Explainer (`"mode": "explainer"`, default) | Reel (`"mode": "reel"`) |
| --- | --- | --- |
| Length | 60–90 s, 140–200 words, 5–7 scenes | 30–60 s, 100–160 words, 5–7 scenes |
| Pace | 130–165 wpm | 150–185 wpm (`tempo` ~1.15 on `eleven_v4`, which reads slowly) |
| Cuts | Fades | Hard cuts (`transition: "cut"`, the reel default) |
| Opening | The question | A hook inside 2 s: the most surprising fact or picture, in a `"type": "big"` scene. Hook on what the viewer wants, not on correcting them: "Not quite" or "No guarantee" reads as negative |
| Screen | Calm; diagrams build up | Something changes every 2–3 s: a title word pops in, a diagram part appears, the camera moves, the scene cuts |

End a reel on a question or a send ("Send this to the friend you'd go with"), not "tag a friend" (platforms demote engagement bait) and not a sign-up: a join line turns the video into an ad. Arc: hook → a situation the viewer knows → the problem made visible → how it works → the turn → what follows → recap (reel: end on one question or a send). Close the loop the hook opened: a reel that ends on its opening picture or line ("Only 3 left?" … "Only 3 left") replays without a seam, and replays count as watch time. Diagram parts build up with the narration (see Motion), and every diagram in a reel moves; page states become before/after scenes. One idea per sentence; the screen supports the voice rather than repeating it word for word. Put `data-at` on title and sub words too, so the key word lands as it is spoken.

Vertical 1080×1920 by default; `"format": "landscape"` gives 1920×1080 for YouTube and slides. Most social video plays muted, so set `"captions": true` for reels; every build also writes `out/<folder>.srt` for platforms that take a caption file. The mp4 is H.264, limited-range BT.709 with AAC, which Instagram and Facebook take without washing out the colours; the build checks it with ffprobe and warns if not. Re-encode any file edited outside the build the same way before upload.

**Steps**
0. Reel, story, or an explainer built on one event: run `<skill>/story.md` first. It writes `<project>/script.md` (brief, story bank, hooks, beats, draft, checks); the owner reviews it before any render, and `scenes.json` narration comes from its draft.
1. Write `scenes.json` (below). Put images, including `diagram.svg`, in `photos/`.
2. Style frames before any full render: `STILLS=1 VOICE=kokoro node <skill>/build.mjs <project>` writes one settled frame per scene to `out/stills/` and stops (no video, no paid music or effects). With no fixed look yet, make three directions (say, different `colors`, `theme` or art) and pick one by eye; with a fixed look, check three key scenes in it. Every build (stills included) first prints `check:` lines: text off the frame, text crowding or covering the picture, captions over the text, a photo shown over 1.5× its pixels (it looks soft), and in a reel a photo unchanged for over 3 s (reframes count as a change, so split a long sentence). A full render adds two measured on the frames themselves (`frames-check.mjs`): a one-frame flash (a frame unlike both neighbours), and in a reel a screen where nothing changes, captions included, for over 2 s before the end hold. Fix each before the full render; they are warnings, so the build goes on. `examples/check-fixture` trips every one.
3. Draft for free: `VOICE=kokoro node <skill>/build.mjs <project>` (local Kokoro voice, any OS; `KOKORO_VOICE` picks it, default `bm_george`; first run downloads ~90 MB). Kokoro paces close to a final; `scenes.json` `speed` also sets its pace. Without Kokoro: `VOICE=say` on macOS, `VOICE=espeak` with espeak-ng on Linux, whose pacing is rough; `SAY_RATE` (default 120 for `say`, 140 for espeak), `SAY_VOICE` (default Daniel) and `ESPEAK_VOICE` (default en-gb) tune it. A free `VOICE` never reads the ElevenLabs key, so a draft cannot bill. Inside a command sandbox `say` writes silence and the build stops with "wrote no audio": run it outside the sandbox or use `VOICE=espeak`.
4. Review `out/sheet.jpg` (one row per scene: fading in, settled, fading out): fix overflow, collisions, weak contrast, muddy half-faded frames. Read `out/storyboard.md` (timecodes, narration, on-screen text, wpm). Watch the mp4.
5. Final: the same command without `VOICE` (uses ElevenLabs when a key is set). It prints any scene outside the mode's wpm range (also with Kokoro): set `tempo` (free, reuses cached lines) or, on `eleven_multilingual_v2` only, `speed` (re-voices and bills every changed line), for the whole video or one scene, and rebuild. Voiced lines are cached in `.voice-cache/`, so a rebuild bills only lines whose text or speed changed.
6. Scored review, after every full render, by someone other than the builder, who tends to pass its own work. Start two read-only subagents (no edits, no builds); without subagents, do each as a fresh pass that reads only the files named.
   - **Critic:** reads `out/review.jpg` (20 evenly spaced frames at phone size), `out/sheet.jpg`, `out/storyboard.md` and the brief in `script.md`, and starts from reject. Scores each out of 10, and every 8 or more names the frame that earns it: **readability on a phone** (every word read at that size, nothing under platform buttons), **continuity** (one look, the next picture grows from the last), **sync** (from the storyboard: words land as they are spoken), **polish** (no muddy frames, no collisions, no stray defaults). Returns the three biggest weaknesses with scene and time. Tell it the frames are samples: a caption cut mid-phrase or a title word not yet in is normal in a still; judge those from the storyboard timings.
   - **Message test:** a fresh agent sees `out/review.jpg` only (no script, no storyboard) and says in one sentence what the video tells the viewer. It fails when it can't, or when the sentence misses the brief's feeling or subject.

   The builder fixes what scored 7 or less and the message test, leaves 9 and 10 alone, rebuilds, and asks again. Stop when every score is 8 or more and the message test passes. Write one line per version in `out/versions/changes.md` (`v3: critic 7/8/8/6, message ok; shortened scene 4 title, moved captions up`).

### scenes.json

```json
{
  "theme": "light",
  "music": "Instrumental, warm and curious, light piano and pizzicato strings. No vocals. Sits under narration.",
  "scenes": [
    { "id": "hook", "purpose": "Make the viewer ask why",
      "vo": "The shop says only three left. But ten are on the shelf.",
      "kicker": "The question", "title": "Only <em>3</em> left?", "sub": "Ten are on the shelf." }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `mode` | `"explainer"` (default) or `"reel"`: sets the wpm check and the default transition |
| `transition` | `"fade"` or `"cut"`, for the whole video or one scene |
| `type: "big"` | One huge centred line (hooks, numbers). Pair with `bleed` for a photo behind |
| `theme` | `"light"` (cream paper, charcoal, coral accent, teal kicker) for explainers. Omit for dark |
| `format` | `"portrait"` (default, 1080×1920) or `"landscape"` (1920×1080) |
| `captions` | `true` burns captions into the video. The `.srt` is written either way |
| `speed` | ElevenLabs pace, 0.7–1.2 (default 1). Also allowed on a single scene. `eleven_v3`/`eleven_v4` ignore it: use `tempo` |
| `foreign` | Phrases in another language, e.g. `["mise en place", "Bon appétit!"]`: set in italics in the captions wherever spoken. Mark them on screen with `<em>` |
| `model` | ElevenLabs voice model (default `eleven_multilingual_v2`). `eleven_v4` is the most expressive and reads audio tags in `vo`: `[whispers]`, `[excited]`. Tags steer the voice; captions, `data-at` and the free voices ignore them. Also allowed on a single scene: a foreign phrase voiced alone on `eleven_multilingual_v2` keeps its own accent (inside an English sentence it is read in English) |
| `tempo` | Speeds the finished voice up (or down) without changing pitch, e.g. `1.2`; word times follow. Also per scene (an `[excited]` line is already fast: set that scene to `1`) |
| `colors` | Override theme colors: `bg`, `ink`, `muted`, `kicker`, `accent`, `line`, `scrim`, and `card` (behind `fit: "contain"` images) |
| `music` | ElevenLabs Music prompt, generated once into `music.mp3` with 8 s more than the cut (ElevenLabs fades its last section out; the mix trims it). Omit for voice only, or supply your own `music.mp3`. On a scene: that scene's part of the score ("near silence, low pulse"); any scene `music` turns the track into sections timed to the scenes (sections under 3 s join the next). After timing changes the build warns: delete `music.mp3` to regenerate (billed) |
| `sfx` | On a scene: `[{ "prompt": "crowd roar", "at": "phrase", "dur": 4, "gain": 0.5 }]`. Made once (ElevenLabs sound effects) into `.sfx-cache/`, laid in when the phrase is spoken (scene start without `at`). Free drafts use cached effects only |
| `pronounce` | Respellings for the voice, e.g. `{ "Gnocchi": "Nyokee" }` |
| `id`, `purpose` | Scene name and what the viewer should understand after it (storyboard) |
| `vo` | Narration. Write numbers and dates the way they are spoken |
| `kicker` | Small mono line above the title |
| `title` | HTML, about three short words. `<em>` = accent italic; `<span data-count="110">110</span>` counts up from the scene start, so add `data-at` to start it on its spoken number; `<span data-at="phrase">` pops in on that phrase (a count starts there) |
| `sub` | Line under the title; HTML, `data-at` works here too |
| `photos` | Paths relative to `photos/` (jpg, png, svg); `../diagram.svg` reuses the root diagram without a copy. Several crossfade. SVGs are inlined, so an `<image href="x.jpg">` inside one resolves next to the SVG file (so `x.jpg`, not `photos/x.jpg`) |
| `fit: "contain"` | Whole image on a card (`colors.card`): diagrams, documents, wide group photos |
| `pos` | CSS `object-position`, e.g. `"center 22%"` to keep faces in frame. With `pos` set, reframes only zoom, so the faces stay in |
| `reframe` | Reels (default `true`): each photo pans to a new framing on every sentence, and on a comma, semicolon or colon at least 1.5 s from other changes. Pans use the part a full-frame crop hides, so they cost no sharpness. `false` for the whole video or one scene; `true` to use it in an explainer |
| `bleed: true` | Image fills the frame behind a scrim |
| `logo: true` | Show `logo.png` from the project folder above the text |
| `poster: true` | This scene's settled frame becomes `out/poster.jpg` and frame 0 (the thumbnail). Default: last scene. Pick a scene with an image |
| `year` | Draws a timeline across the scenes' years. Omit for no timeline |

**Layout:** with an image, a card fills the frame from the top down to just above the text (landscape: the right half) and the text sits below it (landscape: left of it); without one, the text is centred alone (looks sparse, give most scenes an image); `bleed` puts the text over a full-frame image. Captions sit under the text. Portrait keeps clear of the Reels apps (measured on Instagram and Facebook, October 2026): nothing right of x 900 below the middle (like, comment, share buttons) and nothing below y 1700 (account name, post text); the build warns when text goes there, and captions split at 28 characters to stay on one line. The text block grows upward and the portrait card shrinks to make room, so a short text block means a big picture: keep kicker, title and sub to about three lines on card scenes (put photo credits in `<small>`, drop a sub that repeats the voice). The landscape card is close to square (800×830), so draw landscape diagrams square-ish with labels large enough to read at that size.

**Own template:** a project `index.html` replaces the template. It must define `window.setup({ scenes, base, theme, colors, format, cues })` (scenes carry `start`, `dur` in seconds and `transition`; `base` is the project folder URL; `cues` is `[{ t0, t1, text, words: [{ w, t }] }]`, empty unless captions are on; may be async) and `window.render(t, { poster })`, which draws the frame at `t` seconds as a pure function of time (`poster` is true for the thumbnail: leave captions out).

## Look

Explainers: a light editorial page: cream paper, charcoal ink, one coral accent, a little teal, monospaced labels, plenty of space, calm motion. Reels: the dark theme plus the brand's `colors`, big type, full-bleed photos, hard cuts and a camera that follows the narration (`data-focus`). Calm is right for an explainer and wrong for a reel. In both, leave out stock AI gradients, floating particles, glossy 3D and neon interfaces.

## Motion

The template animates with a closed-form spring (title words with `data-at` settle with a slight overshoot; a count-up kicks when it lands) and a glide for the camera. Rules for scenes and SVGs:

- **One main move at a time.** Everything else is still or follows it.
- **Exits are quicker than entries:** in over 0.4–0.6 s, out over 0.2–0.3 s.
- **Stagger groups** 30–60 ms apart, in reading order or from the centre out (`data-in` delays on a `data-at` part).
- **Text stays long enough to read:** at least letters ÷ 15 + 1.5 s once it is fully in. Fast pace comes from fewer words, not shorter holds.
- **The next picture grows out of the last one** where it can (match cut: the chalk line becomes the map border). Keep to two or three kinds of transition per video.
- **One signature moment** per video, at the emotional peak, that can be described in a sentence.

Avoid the default "AI look":

| Default | Instead |
| --- | --- |
| Everything fades in together | Stagger, spring, entry on the word |
| Centred big text on every scene | Mix `big`, card and `bleed` scenes |
| Purple–blue gradients, glow everywhere | The brand's two colours plus one accent; glow only on things that give light |
| Generic particles, lens flares | Motion with a job: forming, following, pointing |
| Linear moves | Spring or glide |
| Corner labels, thin frames, fake data | Labels only where they carry information |
| Emoji icons, SVG faces | Abstract shapes; real photos for people |
| Generated "archive" pictures | Real photos with credit, or drawings that are plainly drawings |

**No photo for a moment?** In this order:
1. A real photo from someone who was there, credited. Ask the people who were there before moving on. For a public event (a match, a launch), check the organiser's own galleries first: they often carry the exact moment, used with their credit.
2. Drawn art (an SVG): plainly a drawing, so it claims nothing. Label it illustration. For a drawn re-creation of a real moment (a goal, a route), take its shape from written reports and from reference frames of the official footage (ask the owner for screenshots); the footage stays reference only. Claim only what a source states, and label it `ILLUSTRATION · POSITIONS APPROXIMATE`.
3. A generated (AI) image, only for scenery that claims nothing: a texture, a mood, a generic place or object with no one identifiable in it. Label it on screen (`<small>Illustration (AI)</small>`).

Never generate a realistic picture of a real person, or of a moment that happened (it reads as a record of the event). Never generate a logo, crest, kit, product or document, and don't redraw a logo or crest by hand either: use the official file unchanged, or a credited photo of it. A screenshot or repost drops the on-screen label, and the video may outlive its makers, so a generated image is never reused as evidence of anything. Platforms ask for disclosure of photorealistic AI video or audio: Meta requires its AI-disclosure tool when posting it to Facebook or Instagram and may penalise content that isn't disclosed ([Meta, Misinformation policy](https://transparency.meta.com/policies/community-standards/misinformation/)).

## Final review

Check each form alone: the text alone, the diagram alone, the page with motion off, the video muted. All four must leave the same correct picture in the viewer's head. List every mismatch and fix it.

**Deliver:** `script.md` (reels and stories), explanation, diagram (+ source and alt text), `page.html`, `out/storyboard.md`, the mp4, the four review scores, the message-test sentence and `out/versions/changes.md`, `out/poster.jpg` and the `.srt`, accessibility notes, and the folder listing. A concept, moodboard or mockup is not a delivery.

## Common mistakes

- **A flat reel:** the same layout scene after scene, one long sentence over a static picture (reframes come on sentences and clauses), a slow voice, a quiet first second. Vary `type`, `bleed` and card scenes; tag diagrams and titles with `data-at`.
- **Paying for drafts:** draft with a free voice. The cache saves unchanged lines, but every new wording of a line is billed.
- **Losing a good render:** every build is kept in `out/versions/` as v1, v2, … Deleting `out/` deletes them too; copy a version you post somewhere safe.
- **Music shorter than the cut:** it loops, which can be audible. Delete `music.mp3` to regenerate at the new length (paid).
- **Holes in the music:** generated music can drop to silence mid-track; the build prints `music: silent from …`. Regenerate, or splice a bar from elsewhere in the track over the hole (ffmpeg `atrim` + `acrossfade`). For a paid voice pass while the music is still open, a silent `music.mp3` stops the build paying for a track you will replace.
- **Trusting speech-to-text on pronunciation:** speech-to-text hears the word it expects, so it can't judge an accent. Make two to five short samples (respellings, the phrase alone on another `model`) and let the owner pick by listening.
- **The same picture, a jumping card:** consecutive scenes on one photo with text blocks of different heights resize the card at each cut. Pad the shorter text blocks (a `<span data-in="99">` that never shows) so the card stays one size.
- **Motion off after a rewrite:** `data-at` follows the words, `data-in` times do not. Prefer `data-at`; a build that stops on a missing phrase means the narration changed.
- **Guessed facts:** check claims against the source (code, docs, records) and cite them in `explanation.md`.
